alter table public.profiles
  add column email text,
  add column avatar_path text;

update public.profiles p
set email = u.email,
    phone = coalesce(p.phone, nullif(u.raw_user_meta_data ->> 'phone', ''))
from auth.users u
where u.id = p.id;

alter table public.driver_profiles
  add column scooter_brand text not null default '',
  add column scooter_photo_path text;

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
      email = excluded.email,
      phone = coalesce(excluded.phone, public.profiles.phone);

  if requested_role = 'client' then
    insert into public.user_roles (user_id, role)
    values (new.id, 'client')
    on conflict (user_id, role) do nothing;
  end if;

  return new;
end;
$$;

create or replace function public.handle_redgo_email_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles
    set email = new.email
    where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated_redgo on auth.users;
create trigger on_auth_user_email_updated_redgo
  after update of email on auth.users
  for each row execute function public.handle_redgo_email_update();

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
    from public.profiles p
    join public.driver_profiles d on d.user_id = p.id
    where p.id = current_user_id
      and length(trim(d.scooter_brand)) > 0
      and p.avatar_path = current_user_id::text || '/profile.jpg'
      and d.scooter_photo_path = current_user_id::text || '/scooter.jpg'
      and exists (
        select 1 from storage.objects
        where bucket_id = 'redgo-driver-documents' and name = p.avatar_path
      )
      and exists (
        select 1 from storage.objects
        where bucket_id = 'redgo-driver-documents' and name = d.scooter_photo_path
      )
  ) then
    raise exception 'Complete the driver profile and upload both required photos before submitting.';
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

create or replace function public.save_driver_application_profile(
  scooter_brand text,
  profile_photo_path text,
  scooter_photo_path text
)
returns void
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
  if length(trim(scooter_brand)) not between 1 and 80 then
    raise exception 'Saisissez une marque de scooter valide.';
  end if;
  if profile_photo_path <> current_user_id::text || '/profile.jpg'
    or scooter_photo_path <> current_user_id::text || '/scooter.jpg' then
    raise exception 'Invalid driver photo path.';
  end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'redgo-driver-documents' and name = profile_photo_path
  ) or not exists (
    select 1 from storage.objects
    where bucket_id = 'redgo-driver-documents' and name = scooter_photo_path
  ) then
    raise exception 'Upload both required photos before saving the driver profile.';
  end if;

  insert into public.driver_profiles (user_id, scooter_brand, scooter_photo_path)
  values (current_user_id, trim(scooter_brand), scooter_photo_path)
  on conflict (user_id) do update
  set scooter_brand = excluded.scooter_brand,
      scooter_photo_path = excluded.scooter_photo_path;

  update public.profiles
  set avatar_path = profile_photo_path
  where id = current_user_id;
end;
$$;

create or replace function public.review_driver_application(
  application_user_id uuid,
  decision text,
  note text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') not in ('admin', 'service_role') then
    raise exception 'Administrator authorization required';
  end if;
  if decision not in ('approved', 'rejected', 'suspended') then
    raise exception 'Invalid driver application decision';
  end if;
  if decision = 'rejected' and nullif(trim(note), '') is null then
    raise exception 'A rejection reason is required.';
  end if;

  update public.driver_applications
  set status = decision,
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      review_note = left(note, 1000)
  where user_id = application_user_id;

  if not found then
    raise exception 'Driver application not found';
  end if;

  if decision = 'approved' then
    insert into public.user_roles (user_id, role, granted_by)
    values (application_user_id, 'driver', auth.uid())
    on conflict (user_id, role) do nothing;
  else
    delete from public.user_roles
    where user_id = application_user_id and role = 'driver';
  end if;

  return decision;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'redgo-driver-documents',
  'redgo-driver-documents',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Driver applicants upload their own documents" on storage.objects;
create policy "Driver applicants upload their own documents"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'redgo-driver-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Applicants and admins read driver documents" on storage.objects;
create policy "Applicants and admins read driver documents"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'redgo-driver-documents'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    )
  );

drop policy if exists "Driver applicants replace their own documents" on storage.objects;
create policy "Driver applicants replace their own documents"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'redgo-driver-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'redgo-driver-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Driver applicants delete their own documents" on storage.objects;
create policy "Driver applicants delete their own documents"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'redgo-driver-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

revoke all on function public.handle_new_redgo_user() from public, anon, authenticated;
revoke all on function public.handle_redgo_email_update() from public, anon, authenticated;
revoke all on function public.save_driver_application_profile(text, text, text) from public, anon;
revoke all on function public.submit_driver_application() from public, anon;
revoke all on function public.review_driver_application(uuid, text, text) from public, anon, authenticated;
grant execute on function public.save_driver_application_profile(text, text, text) to authenticated;
grant execute on function public.submit_driver_application() to authenticated;
grant execute on function public.review_driver_application(uuid, text, text) to authenticated, service_role;
