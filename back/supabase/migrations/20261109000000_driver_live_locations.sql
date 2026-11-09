create table if not exists public.delivery_driver_locations (
  order_id text primary key,
  driver_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  latitude double precision,
  longitude double precision,
  heading double precision,
  updated_at timestamptz not null default now(),
  constraint delivery_driver_locations_latitude_range check (latitude is null or latitude between -90 and 90),
  constraint delivery_driver_locations_longitude_range check (longitude is null or longitude between -180 and 180),
  constraint delivery_driver_locations_heading_range check (heading is null or heading between 0 and 360)
);

alter table public.delivery_driver_locations enable row level security;

revoke all on public.delivery_driver_locations from anon, authenticated;
grant select on public.delivery_driver_locations to authenticated;
grant update (latitude, longitude, heading)
  on public.delivery_driver_locations to authenticated;

create or replace function public.set_delivery_driver_location_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_delivery_driver_location_updated_at
  before update on public.delivery_driver_locations
  for each row
  execute function public.set_delivery_driver_location_updated_at();

create policy "Customers and assigned drivers can read delivery locations"
  on public.delivery_driver_locations
  for select
  to authenticated
  using (customer_id = (select auth.uid()) or driver_id = (select auth.uid()));

create policy "Assigned drivers can update their delivery location"
  on public.delivery_driver_locations
  for update
  to authenticated
  using (driver_id = (select auth.uid()))
  with check (driver_id = (select auth.uid()));

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'delivery_driver_locations'
  ) then
    alter publication supabase_realtime add table public.delivery_driver_locations;
  end if;
end
$$;
