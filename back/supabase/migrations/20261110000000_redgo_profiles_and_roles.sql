create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('client', 'driver')),
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id) on delete set null,
  primary key (user_id, role)
);

create table public.driver_applications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'suspended')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_note text
);

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.driver_applications enable row level security;

revoke all on public.profiles, public.user_roles, public.driver_applications from anon, authenticated;
grant select on public.profiles, public.user_roles, public.driver_applications to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

create policy "Users and administrators can read profiles"
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

create policy "Users can update their own contact profile"
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Users and administrators can read role grants"
  on public.user_roles
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

create policy "Applicants and administrators can read driver applications"
  on public.driver_applications
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

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

  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.phone
  )
  on conflict (id) do nothing;

  if requested_role = 'client' then
    insert into public.user_roles (user_id, role)
    values (new.id, 'client')
    on conflict (user_id, role) do nothing;
  else
    insert into public.driver_applications (user_id, status)
    values (new.id, 'pending')
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_redgo on auth.users;
create trigger on_auth_user_created_redgo
  after insert on auth.users
  for each row execute function public.handle_new_redgo_user();

insert into public.profiles (id, full_name, phone)
select
  id,
  coalesce(raw_user_meta_data ->> 'full_name', ''),
  phone
from auth.users
on conflict (id) do nothing;

create or replace function public.request_client_access()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.user_roles (user_id, role)
  values (auth.uid(), 'client')
  on conflict (user_id, role) do nothing;
end;
$$;

create or replace function public.submit_driver_application()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  application_status text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'driver'
  ) then
    return 'approved';
  end if;

  insert into public.driver_applications (user_id, status)
  values (auth.uid(), 'pending')
  on conflict (user_id) do nothing;

  select status into application_status
  from public.driver_applications
  where user_id = auth.uid();

  return application_status;
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

revoke all on function public.handle_new_redgo_user() from public, anon, authenticated;
revoke all on function public.request_client_access() from public, anon;
revoke all on function public.submit_driver_application() from public, anon;
revoke all on function public.review_driver_application(uuid, text, text) from public, anon, authenticated;
grant execute on function public.request_client_access() to authenticated;
grant execute on function public.submit_driver_application() to authenticated;
grant execute on function public.review_driver_application(uuid, text, text) to authenticated, service_role;
