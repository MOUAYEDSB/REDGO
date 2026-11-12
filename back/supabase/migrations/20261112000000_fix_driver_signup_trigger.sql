-- Migration : Chauffeur direct approved après OTP + onboarding 2 étapes
-- 1. Le trigger crée automatiquement le rôle 'driver' et driver_applications 'approved' dès l'inscription
-- 2. Ajout de la colonne city à driver_profiles
-- 3. Mise à jour de save_driver_application_profile (city + scooter photo)

create or replace function public.handle_new_redgo_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role text;
begin
  requested_role := coalesce(new.raw_user_meta_data ->> 'requested_role', 'client');
  if requested_role not in ('client', 'driver') then
    requested_role := 'client';
  end if;

  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do update
  set full_name = excluded.full_name,
      email     = excluded.email,
      phone     = coalesce(excluded.phone, public.profiles.phone);

  if requested_role = 'client' then
    insert into public.user_roles (user_id, role)
    values (new.id, 'client')
    on conflict (user_id, role) do nothing;
  else
    -- CHAUFFEUR : statut 'approved' direct + rôle 'driver' accordé automatiquement !
    -- L'administrateur peut toujours révoquer/suspendre depuis le dashboard admin.
    insert into public.user_roles (user_id, role)
    values (new.id, 'driver')
    on conflict (user_id, role) do nothing;

    insert into public.driver_applications (user_id, status, reviewed_at)
    values (new.id, 'approved', now())
    on conflict (user_id) do update
    set status = 'approved',
        reviewed_at = now();
  end if;

  return new;
end;
$$;

revoke all on function public.handle_new_redgo_user() from public, anon, authenticated;

-- Add city column to driver_profiles
alter table public.driver_profiles
  add column if not exists city text not null default 'Msaken';

-- Drop previous function signatures
drop function if exists public.save_driver_application_profile(text, text, text);
drop function if exists public.save_driver_application_profile(text, text, text, text);

-- Save driver application profile with city (Msaken / Messadine) and optional face photo
create or replace function public.save_driver_application_profile(
  scooter_brand text,
  scooter_photo_path text,
  profile_photo_path text default '',
  city text default 'Msaken'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_city text := trim(coalesce(city, 'Msaken'));
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if length(trim(scooter_brand)) not between 1 and 80 then
    raise exception 'Saisissez une marque de scooter valide.';
  end if;

  if normalized_city not in ('Msaken', 'Messadine') then
    normalized_city := 'Msaken';
  end if;

  insert into public.driver_profiles (user_id, scooter_brand, scooter_photo_path, city)
  values (current_user_id, trim(scooter_brand), scooter_photo_path, normalized_city)
  on conflict (user_id) do update
  set scooter_brand = excluded.scooter_brand,
      scooter_photo_path = excluded.scooter_photo_path,
      city = excluded.city;

  if profile_photo_path is not null and profile_photo_path <> '' then
    update public.profiles
    set avatar_path = profile_photo_path
    where id = current_user_id;
  end if;
end;
$$;

revoke all on function public.save_driver_application_profile(text, text, text, text) from public, anon;
grant execute on function public.save_driver_application_profile(text, text, text, text) to authenticated;

-- Drop previous submit_driver_application
drop function if exists public.submit_driver_application();

create or replace function public.submit_driver_application()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  -- Ensure driver role is active
  insert into public.user_roles (user_id, role)
  values (current_user_id, 'driver')
  on conflict (user_id, role) do nothing;

  update public.driver_applications
  set status = 'approved',
      reviewed_at = now()
  where user_id = current_user_id;

  return 'approved';
end;
$$;

revoke all on function public.submit_driver_application() from public, anon;
grant execute on function public.submit_driver_application() to authenticated;
