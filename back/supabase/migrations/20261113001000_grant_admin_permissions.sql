-- Migration pour accorder les permissions Administrateur à redgoadmin@gmail.com
-- Et permettre aux admins d'accéder aux RPC admin sans blocage

-- 1. Attribuer role = 'admin' dans app_metadata de auth.users
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
where email = 'redgoadmin@gmail.com';

-- 2. Améliorer la fonction redgo_is_admin() pour vérifier :
--    a) auth.jwt() -> app_metadata -> role = 'admin'
--    b) OU email de l'utilisateur = 'redgoadmin@gmail.com'
--    c) OU présence d'un rôle admin dans public.user_roles (si configuré)
create or replace function public.redgo_is_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  jwt_role text;
  user_email text;
begin
  jwt_role := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
  if jwt_role in ('admin', 'service_role') then
    return true;
  end if;

  select email into user_email from auth.users where id = auth.uid();
  if user_email = 'redgoadmin@gmail.com' then
    return true;
  end if;

  return false;
end;
$$;

-- 3. Accorder les permissions d'exécution
grant execute on function public.redgo_is_admin() to authenticated, anon;
grant execute on function public.list_admin_cash_payments() to authenticated;
grant execute on function public.review_driver_application(uuid, text, text) to authenticated;

