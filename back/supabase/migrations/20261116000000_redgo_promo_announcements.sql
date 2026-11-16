-- ====================================================================
-- Migration: 20261116000000_redgo_promo_announcements.sql
-- Table des bannières et annonces promotionnelles (en arabe et français)
-- ====================================================================

-- 0. Garantir l'existence de la fonction redgo_is_admin()
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

grant execute on function public.redgo_is_admin() to authenticated, anon;

create table if not exists public.promo_announcements (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  title text not null check (length(trim(title)) between 1 and 160),
  title_ar text check (title_ar is null or length(trim(title_ar)) between 1 and 160),
  subtitle text not null check (length(trim(subtitle)) between 1 and 240),
  subtitle_ar text check (subtitle_ar is null or length(trim(subtitle_ar)) between 1 and 240),
  badge_text text not null default 'PROMO' check (length(trim(badge_text)) between 1 and 40),
  image_url text not null,
  target_route text not null default '/food',
  cta_text text not null default 'Découvrir',
  cta_text_ar text default 'اطلب الآن',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Activation RLS
alter table public.promo_announcements enable row level security;

-- Permissions
grant select on public.promo_announcements to anon, authenticated;
grant insert, update, delete on public.promo_announcements to authenticated;

-- Politiques (recréées proprement en toute idempotence)
drop policy if exists "promo_announcements_read_public" on public.promo_announcements;
create policy "promo_announcements_read_public"
  on public.promo_announcements for select to anon, authenticated
  using (
    is_active = true
    and (starts_at <= now())
    and (ends_at is null or ends_at > now())
  );

drop policy if exists "promo_announcements_admin_all" on public.promo_announcements;
create policy "promo_announcements_admin_all"
  on public.promo_announcements for all to authenticated
  using (public.redgo_is_admin())
  with check (public.redgo_is_admin());

-- Bannières d'exemple initiales avec arabe et français
insert into public.promo_announcements (
  id,
  title,
  title_ar,
  subtitle,
  subtitle_ar,
  badge_text,
  image_url,
  target_route,
  cta_text,
  cta_text_ar,
  is_active,
  sort_order
) values
  (
    'promo_weekend_msaken',
    'Offre Spéciale Restos & Fast-Food',
    'عروض خاصة لنهاية الأسبوع في مساكن ومصادين',
    'Commandez vos plats préférés et profitez de la livraison express par scooter.',
    'أشهى البيتزا والبرغر والمأكولات التونسية لباب دارك في أقل من 30 دقيقة',
    'تخفيض 20% · عرض خاص',
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=900',
    '/food',
    'Commander maintenant',
    'اطلب توا',
    true,
    0
  ),
  (
    'promo_courses_direct',
    'Courses REDGO à Prix Fixes',
    'قضية الدار لباب الدار بدون تعب',
    'Eau, lait, produits locaux et pharmacie livrés chez vous en direct sans majoration.',
    'ماء، حليب، مواد غذائية وصيدلية بأسعار قارة وتوصيل سريع بـ 2.500 دت فقط',
    'قضية سريعة · 2.500 DT',
    'https://images.unsplash.com/photo-1542838132-92c53300491e?w=900',
    '/market',
    'Faire mes courses',
    'قضي توا',
    true,
    1
  ),
  (
    'promo_scooter_taxi',
    'Scooter Taxi Express M''Saken',
    'أسرع تاكسي سكوتر في مساكن',
    'Déplacez-vous rapidement à M''Saken et Messaadine sans embouteillages.',
    'تنقل سريع واقتصادي لشخص واحد مع خوذة معقمة وسائق محترف',
    'SCOOTER TAXI · سريع',
    'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=900',
    '/booking/pickup',
    'Réserver une course',
    'اطلب كورس',
    true,
    2
  )
on conflict (id) do update set
  title = excluded.title,
  title_ar = excluded.title_ar,
  subtitle = excluded.subtitle,
  subtitle_ar = excluded.subtitle_ar,
  badge_text = excluded.badge_text,
  image_url = excluded.image_url,
  target_route = excluded.target_route,
  cta_text = excluded.cta_text,
  cta_text_ar = excluded.cta_text_ar,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;

-- Rechargement immédiat du cache de schéma PostgREST / Supabase API
notify pgrst, 'reload schema';
