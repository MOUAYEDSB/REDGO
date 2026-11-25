-- Active le tarif Scooter Taxi par défaut (2.500 DT) et gère le supplément Aller-Retour (+1.000 DT).

create table if not exists public.scooter_tariffs (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  name text not null check (length(trim(name)) between 1 and 120),
  description text not null default '',
  fare_millimes bigint not null check (fare_millimes > 0),
  passenger_capacity smallint not null default 1 check (passenger_capacity = 1),
  helmet_provided boolean not null default true,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.scooter_tariffs (
  id,
  name,
  description,
  fare_millimes,
  passenger_capacity,
  helmet_provided,
  is_active
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
  name = excluded.name,
  description = excluded.description,
  fare_millimes = excluded.fare_millimes,
  is_active = true,
  updated_at = now();

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
  active_tariff public.scooter_tariffs%rowtype;
  new_ride_id uuid;
  distance_km numeric(7, 2);
  computed_fare bigint;
begin
  if current_user_id is null or not public.redgo_has_role('client') then
    raise exception 'An authorized client session is required.';
  end if;
  if pickup_address is null or length(trim(pickup_address)) not between 1 and 300
    or destination_address is null or length(trim(destination_address)) not between 1 and 300 then
    raise exception 'Valid pickup and destination addresses are required.';
  end if;
  if not public.redgo_is_in_service_area(pickup_latitude, pickup_longitude)
    or not public.redgo_is_in_service_area(destination_latitude, destination_longitude) then
    raise exception 'Pickup and destination must be inside the REDGO service area.';
  end if;

  select * into active_tariff
  from public.scooter_tariffs
  where is_active
  limit 1
  for share;

  if not found then
    raise exception 'No active scooter fare is configured.';
  end if;

  -- Aller simple / Colis = 2.500 DT | Aller-retour = +1.000 DT (3.500 DT)
  computed_fare := active_tariff.fare_millimes;
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
    'TX-' || to_char(now(), 'YYMMDD') || '-' || lpad(nextval('public.redgo_reference_seq')::text, 6, '0'),
    current_user_id, active_tariff.id, trim(pickup_address), pickup_latitude, pickup_longitude,
    trim(destination_address), destination_latitude, destination_longitude,
    distance_km, computed_fare
  )
  returning id into new_ride_id;

  insert into public.driver_missions (mission_type, scooter_ride_id, customer_id)
  values ('scooter_ride', new_ride_id, current_user_id);

  return new_ride_id;
end;
$$;
