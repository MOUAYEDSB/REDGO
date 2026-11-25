-- Self-contained setup for scooter_tariffs, scooter_rides, and driver_missions
-- Safe to run even if earlier core domain migrations were only partially applied.

-- 1. scooter_tariffs
create table if not exists public.scooter_tariffs (
  id text primary key,
  name text not null,
  description text not null default '',
  fare_millimes bigint not null check (fare_millimes > 0),
  passenger_capacity smallint not null default 1,
  helmet_provided boolean not null default true,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.scooter_tariffs (
  id, name, description, fare_millimes, passenger_capacity, helmet_provided, is_active
)
values (
  'scooter_standard',
  'Scooter Taxi & Colis REDGO',
  'Trajet express 1 passager ou envoi de colis à M''Saken et Messaadine',
  2500,
  1,
  true,
  true
)
on conflict (id) do update
set
  fare_millimes = excluded.fare_millimes,
  is_active = true,
  updated_at = now();

-- 2. scooter_rides
create table if not exists public.scooter_rides (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  customer_id uuid not null,
  driver_id uuid,
  tariff_id text references public.scooter_tariffs(id) on update cascade on delete set null,
  status text not null default 'searching'
    check (status in (
      'searching', 'driver_assigned', 'approaching_pickup',
      'arrived_at_pickup', 'ride_started', 'ride_completed', 'cancelled'
    )),
  pickup_address text not null,
  pickup_latitude double precision not null,
  pickup_longitude double precision not null,
  destination_address text not null,
  destination_latitude double precision not null,
  destination_longitude double precision not null,
  estimated_distance_km numeric(7, 2) not null default 0,
  estimated_duration_minutes integer,
  fare_millimes bigint not null check (fare_millimes > 0),
  payment_method text not null default 'cash',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  assigned_at timestamptz,
  completed_at timestamptz
);

create index if not exists scooter_rides_customer_created_idx
  on public.scooter_rides (customer_id, created_at desc);
create index if not exists scooter_rides_driver_created_idx
  on public.scooter_rides (driver_id, created_at desc);

-- 3. driver_missions
create table if not exists public.driver_missions (
  id uuid primary key default gen_random_uuid(),
  mission_type text not null check (mission_type in ('delivery', 'scooter_ride')),
  delivery_order_id uuid unique,
  scooter_ride_id uuid unique references public.scooter_rides(id) on delete cascade,
  customer_id uuid not null,
  driver_id uuid,
  status text not null default 'searching'
    check (status in ('searching', 'assigned', 'accepted', 'in_progress', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_at timestamptz,
  completed_at timestamptz
);

create index if not exists driver_missions_driver_created_idx
  on public.driver_missions (driver_id, created_at desc);

-- 4. Enable RLS & Grants
alter table public.scooter_tariffs enable row level security;
alter table public.scooter_rides enable row level security;
alter table public.driver_missions enable row level security;

grant select on public.scooter_tariffs to anon, authenticated;
grant select, insert, update on public.scooter_rides to authenticated;
grant select, insert, update on public.driver_missions to authenticated;

-- 5. RLS policies (self-contained)
drop policy if exists "Active scooter tariff is visible" on public.scooter_tariffs;
create policy "Active scooter tariff is visible"
  on public.scooter_tariffs for select to anon, authenticated
  using (is_active);

drop policy if exists "Customers read their own scooter rides" on public.scooter_rides;
create policy "Customers read their own scooter rides"
  on public.scooter_rides for select to authenticated
  using (customer_id = auth.uid() or driver_id = auth.uid() or status = 'searching');

drop policy if exists "Customers insert their own scooter rides" on public.scooter_rides;
create policy "Customers insert their own scooter rides"
  on public.scooter_rides for insert to authenticated
  with check (customer_id = auth.uid());

drop policy if exists "Customers update their own scooter rides" on public.scooter_rides;
create policy "Customers update their own scooter rides"
  on public.scooter_rides for update to authenticated
  using (customer_id = auth.uid() or driver_id = auth.uid() or status = 'searching')
  with check (true);

drop policy if exists "Customers insert scooter ride missions" on public.driver_missions;
create policy "Customers insert scooter ride missions"
  on public.driver_missions for insert to authenticated
  with check (mission_type = 'scooter_ride' and customer_id = auth.uid());

drop policy if exists "Users read relevant missions" on public.driver_missions;
create policy "Users read relevant missions"
  on public.driver_missions for select to authenticated
  using (customer_id = auth.uid() or driver_id = auth.uid() or status = 'searching');

drop policy if exists "Drivers update missions" on public.driver_missions;
create policy "Drivers update missions"
  on public.driver_missions for update to authenticated
  using (driver_id = auth.uid() or status = 'searching' or customer_id = auth.uid())
  with check (true);

-- 6. Make create_scooter_ride RPC permissive for any authenticated user and fallback to 2500 millimes
create or replace function public.create_scooter_ride(
  pickup_address text,
  pickup_latitude double precision,
  pickup_longitude double precision,
  destination_address text,
  destination_latitude double precision,
  destination_longitude double precision
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  active_tariff_id text;
  base_fare bigint;
  new_ride_id uuid;
  distance_km numeric(7, 2);
  computed_fare bigint;
begin
  if current_user_id is null then
    raise exception 'An authenticated session is required.';
  end if;

  select id, fare_millimes into active_tariff_id, base_fare
  from public.scooter_tariffs
  where is_active
  limit 1;

  if base_fare is null then
    base_fare := 2500;
  end if;

  computed_fare := base_fare;
  if position('[ALLER-RETOUR]' in upper(trim(destination_address))) = 1 then
    computed_fare := computed_fare + 1000;
  end if;

  distance_km := round((
    2 * 6371 * asin(sqrt(least(1, greatest(0,
      sin(radians(destination_latitude - pickup_latitude) / 2) ^ 2
      + cos(radians(pickup_latitude)) * cos(radians(destination_latitude))
      * sin(radians(destination_longitude - pickup_longitude) / 2) ^ 2
    ))))
  )::numeric, 2);

  insert into public.scooter_rides (
    reference, customer_id, tariff_id, pickup_address, pickup_latitude, pickup_longitude,
    destination_address, destination_latitude, destination_longitude,
    estimated_distance_km, fare_millimes
  )
  values (
    'TX-' || to_char(now(), 'YYMMDD') || '-' || lpad(floor(100000 + random() * 900000)::text, 6, '0'),
    current_user_id, active_tariff_id, trim(pickup_address), pickup_latitude, pickup_longitude,
    trim(destination_address), destination_latitude, destination_longitude,
    distance_km, computed_fare
  )
  returning id into new_ride_id;

  insert into public.driver_missions (mission_type, scooter_ride_id, customer_id)
  values ('scooter_ride', new_ride_id, current_user_id);

  return new_ride_id;
end;
$$;

notify pgrst, 'reload schema';
