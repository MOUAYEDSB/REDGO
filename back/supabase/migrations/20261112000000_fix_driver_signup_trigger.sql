-- Fix: restore driver_applications insert in handle_new_redgo_user
-- The migration 20261111150000 inadvertently removed the else branch
-- that creates a driver_application row when requested_role = 'driver'.
-- This migration restores the correct behaviour, removes the face photo
-- requirement from driver onboarding, and adds the city/zone field (Msaken / Messadine).

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
    -- Driver: create a pending driver_application so loadRedgoAccess
    -- finds it immediately after OTP verification.
    insert into public.driver_applications (user_id, status)
    values (new.id, 'pending')
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.handle_new_redgo_user() from public, anon, authenticated;

-- Add city column to driver_profiles
alter table public.driver_profiles
  add column if not exists city text not null default 'Msaken';

-- Drop previous function signatures before replacing
drop function if exists public.save_driver_application_profile(text, text, text);
drop function if exists public.save_driver_application_profile(text, text, text, text);

-- Save driver application profile with optional face photo and city selection (Msaken / Messadine)
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
  if scooter_photo_path <> current_user_id::text || '/scooter.jpg' then
    raise exception 'Invalid scooter photo path.';
  end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'redgo-driver-documents' and name = scooter_photo_path
  ) then
    raise exception 'Téléversez la photo requise du scooter avant de continuer.';
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

  -- Profile photo is optional during onboarding; update avatar if provided
  if profile_photo_path is not null and profile_photo_path <> '' then
    if profile_photo_path = current_user_id::text || '/profile.jpg' and exists (
      select 1 from storage.objects
      where bucket_id = 'redgo-driver-documents' and name = profile_photo_path
    ) then
      update public.profiles
      set avatar_path = profile_photo_path
      where id = current_user_id;
    end if;
  end if;
end;
$$;

revoke all on function public.save_driver_application_profile(text, text, text, text) from public, anon;
grant execute on function public.save_driver_application_profile(text, text, text, text) to authenticated;

-- Drop previous submit_driver_application before replacing
drop function if exists public.submit_driver_application();

-- Submit driver application requiring only scooter brand and scooter photo
create or replace function public.submit_driver_application()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  application_status text;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if not exists (
    select 1 from auth.users
    where id = current_user_id and email_confirmed_at is not null
  ) then
    raise exception 'Verify your email before submitting a driver application.';
  end if;
  if exists (
    select 1 from public.user_roles
    where user_id = current_user_id and role = 'driver'
  ) then
    return 'approved';
  end if;
  if not exists (
    select 1
    from public.driver_profiles d
    where d.user_id = current_user_id
      and length(trim(d.scooter_brand)) > 0
      and d.scooter_photo_path = current_user_id::text || '/scooter.jpg'
      and exists (
        select 1 from storage.objects
        where bucket_id = 'redgo-driver-documents' and name = d.scooter_photo_path
      )
  ) then
    raise exception 'Renseignez la marque du scooter et téléversez la photo du scooter.';
  end if;

  insert into public.driver_applications (user_id, status)
  values (current_user_id, 'pending')
  on conflict (user_id) do update
  set status = case
        when public.driver_applications.status = 'rejected' then 'pending'
        else public.driver_applications.status
      end,
      requested_at = case
        when public.driver_applications.status = 'rejected' then now()
        else public.driver_applications.requested_at
      end,
      reviewed_at = case
        when public.driver_applications.status = 'rejected' then null
        else public.driver_applications.reviewed_at
      end,
      reviewed_by = case
        when public.driver_applications.status = 'rejected' then null
        else public.driver_applications.reviewed_by
      end,
      review_note = case
        when public.driver_applications.status = 'rejected' then null
        else public.driver_applications.review_note
      end;

  select status into application_status
  from public.driver_applications
  where user_id = current_user_id;
  return application_status;
end;
$$;

revoke all on function public.submit_driver_application() from public, anon;
grant execute on function public.submit_driver_application() to authenticated;
