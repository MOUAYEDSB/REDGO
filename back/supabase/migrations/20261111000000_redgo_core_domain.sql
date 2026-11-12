create sequence if not exists public.redgo_reference_seq;

create or replace function public.redgo_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.redgo_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

create or replace function public.redgo_has_role(requested_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = requested_role
  );
$$;

create or replace function public.redgo_is_in_service_area(latitude double precision, longitude double precision)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(latitude between -90 and 90
    and longitude between -180 and 180
    and (
      2 * 6371 * asin(sqrt(least(1, greatest(0,
        sin(radians(latitude - 35.7273) / 2) ^ 2
        + cos(radians(35.7273)) * cos(radians(latitude))
        * sin(radians(longitude - 10.5815) / 2) ^ 2
      )))) <= 2.6
      or
      2 * 6371 * asin(sqrt(least(1, greatest(0,
        sin(radians(latitude - 35.7551) / 2) ^ 2
        + cos(radians(35.7551)) * cos(radians(latitude))
        * sin(radians(longitude - 10.5921) / 2) ^ 2
      )))) <= 2.2
    ), false);
$$;

create table public.businesses (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  kind text not null check (kind in ('courses', 'restaurant')),
  name text not null check (length(trim(name)) between 1 and 120),
  description text not null default '',
  phone text,
  address text not null default '',
  latitude double precision,
  longitude double precision,
  cover_image_url text,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint businesses_location_pair check (
    (latitude is null and longitude is null)
    or (latitude between -90 and 90 and longitude between -180 and 180)
  )
);

create table public.products (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9_-]{1,95}$'),
  business_id text not null references public.businesses(id) on update cascade on delete restrict,
  name text not null check (length(trim(name)) between 1 and 180),
  description text not null default '',
  category text not null default '',
  price_millimes bigint not null check (price_millimes > 0),
  image_url text,
  max_quantity integer not null default 30 check (max_quantity between 1 and 100),
  is_available boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_options (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9_-]{1,95}$'),
  product_id text not null references public.products(id) on update cascade on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  price_millimes bigint not null default 0 check (price_millimes >= 0),
  is_available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (product_id, id)
);

create table public.delivery_orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  driver_id uuid references public.profiles(id) on delete set null,
  status text not null default 'searching_driver'
    check (status in (
      'confirmed', 'searching_driver', 'driver_assigned',
      'driver_shopping_courses', 'collecting_restaurant',
      'on_the_way', 'delivered', 'cash_collected', 'cancelled'
    )),
  destination_address text not null check (length(trim(destination_address)) between 1 and 300),
  destination_instructions text not null default '',
  recipient_phone text not null check (length(trim(recipient_phone)) between 6 and 32),
  destination_latitude double precision not null check (destination_latitude between -90 and 90),
  destination_longitude double precision not null check (destination_longitude between -180 and 180),
  products_subtotal_millimes bigint not null default 0 check (products_subtotal_millimes >= 0),
  delivery_fee_millimes bigint not null default 0 check (delivery_fee_millimes >= 0),
  service_fee_millimes bigint not null default 0 check (service_fee_millimes >= 0),
  total_millimes bigint not null default 0 check (total_millimes >= 0),
  payment_method text not null default 'cash' check (payment_method = 'cash'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  assigned_at timestamptz,
  delivered_at timestamptz
);

create table public.delivery_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.delivery_orders(id) on delete cascade,
  product_id text references public.products(id) on update cascade on delete set null,
  business_id text not null references public.businesses(id) on update cascade on delete restrict,
  product_name text not null,
  business_name text not null,
  quantity integer not null check (quantity between 1 and 100),
  unit_price_millimes bigint not null check (unit_price_millimes > 0),
  options_price_millimes bigint not null default 0 check (options_price_millimes >= 0),
  selected_options jsonb not null default '[]'::jsonb check (jsonb_typeof(selected_options) = 'array'),
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table public.delivery_order_stops (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.delivery_orders(id) on delete cascade,
  business_id text not null references public.businesses(id) on update cascade on delete restrict,
  business_name text not null,
  stop_type text not null check (stop_type in ('courses', 'restaurant')),
  address text not null default '',
  latitude double precision,
  longitude double precision,
  sequence_number integer not null check (sequence_number > 0),
  status text not null default 'pending' check (status in ('pending', 'reached', 'completed')),
  created_at timestamptz not null default now(),
  unique (order_id, business_id),
  unique (order_id, sequence_number),
  constraint delivery_order_stops_location_pair check (
    (latitude is null and longitude is null)
    or (latitude between -90 and 90 and longitude between -180 and 180)
  )
);

create table public.scooter_tariffs (
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

create unique index scooter_tariffs_one_active_idx
  on public.scooter_tariffs ((is_active))
  where is_active;

create table public.scooter_rides (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  driver_id uuid references public.profiles(id) on delete set null,
  tariff_id text references public.scooter_tariffs(id) on update cascade on delete set null,
  status text not null default 'searching'
    check (status in (
      'searching', 'driver_assigned', 'approaching_pickup',
      'arrived_at_pickup', 'ride_started', 'ride_completed', 'cancelled'
    )),
  pickup_address text not null check (length(trim(pickup_address)) between 1 and 300),
  pickup_latitude double precision not null check (pickup_latitude between -90 and 90),
  pickup_longitude double precision not null check (pickup_longitude between -180 and 180),
  destination_address text not null check (length(trim(destination_address)) between 1 and 300),
  destination_latitude double precision not null check (destination_latitude between -90 and 90),
  destination_longitude double precision not null check (destination_longitude between -180 and 180),
  estimated_distance_km numeric(7, 2) not null check (estimated_distance_km >= 0),
  estimated_duration_minutes integer,
  fare_millimes bigint not null check (fare_millimes > 0),
  payment_method text not null default 'cash' check (payment_method = 'cash'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  assigned_at timestamptz,
  completed_at timestamptz
);

create table public.driver_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  is_online boolean not null default false,
  deliveries_enabled boolean not null default true,
  scooter_taxi_enabled boolean not null default true,
  vehicle_model text not null default '',
  plate_number text not null default '',
  rating numeric(3, 2) not null default 0 check (rating between 0 and 5),
  completed_missions_count integer not null default 0 check (completed_missions_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.driver_missions (
  id uuid primary key default gen_random_uuid(),
  mission_type text not null check (mission_type in ('delivery', 'scooter_ride')),
  delivery_order_id uuid unique references public.delivery_orders(id) on delete cascade,
  scooter_ride_id uuid unique references public.scooter_rides(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  driver_id uuid references public.profiles(id) on delete set null,
  status text not null default 'searching'
    check (status in ('searching', 'assigned', 'accepted', 'in_progress', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_at timestamptz,
  completed_at timestamptz,
  constraint driver_missions_one_target check (
    (mission_type = 'delivery' and delivery_order_id is not null and scooter_ride_id is null)
    or (mission_type = 'scooter_ride' and scooter_ride_id is not null and delivery_order_id is null)
  ),
  constraint driver_missions_assignment_state check (
    (status = 'searching' and driver_id is null)
    or (status <> 'searching' and driver_id is not null)
  )
);

create unique index driver_missions_one_active_per_driver_idx
  on public.driver_missions (driver_id)
  where driver_id is not null and status in ('assigned', 'accepted', 'in_progress');

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 160),
  body text not null default '',
  category text not null default 'general'
    check (category in ('general', 'delivery', 'scooter_ride', 'account')),
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index products_business_available_order_idx
  on public.products (business_id, is_available, sort_order);
create index delivery_orders_customer_created_idx
  on public.delivery_orders (customer_id, created_at desc);
create index delivery_orders_driver_created_idx
  on public.delivery_orders (driver_id, created_at desc);
create index delivery_order_items_order_idx
  on public.delivery_order_items (order_id);
create index delivery_order_stops_order_sequence_idx
  on public.delivery_order_stops (order_id, sequence_number);
create index scooter_rides_customer_created_idx
  on public.scooter_rides (customer_id, created_at desc);
create index scooter_rides_driver_created_idx
  on public.scooter_rides (driver_id, created_at desc);
create index driver_missions_driver_created_idx
  on public.driver_missions (driver_id, created_at desc);
create index notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create trigger businesses_set_updated_at
  before update on public.businesses
  for each row execute function public.redgo_set_updated_at();
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.redgo_set_updated_at();
create trigger delivery_orders_set_updated_at
  before update on public.delivery_orders
  for each row execute function public.redgo_set_updated_at();
create trigger scooter_tariffs_set_updated_at
  before update on public.scooter_tariffs
  for each row execute function public.redgo_set_updated_at();
create trigger scooter_rides_set_updated_at
  before update on public.scooter_rides
  for each row execute function public.redgo_set_updated_at();
create trigger driver_profiles_set_updated_at
  before update on public.driver_profiles
  for each row execute function public.redgo_set_updated_at();
create trigger driver_missions_set_updated_at
  before update on public.driver_missions
  for each row execute function public.redgo_set_updated_at();

create or replace function public.redgo_create_driver_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role = 'driver' then
    insert into public.driver_profiles (user_id)
    values (new.user_id)
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger user_roles_create_driver_profile
  after insert on public.user_roles
  for each row execute function public.redgo_create_driver_profile();

insert into public.driver_profiles (user_id)
select user_id from public.user_roles where role = 'driver'
on conflict (user_id) do nothing;

alter table public.businesses enable row level security;
alter table public.products enable row level security;
alter table public.product_options enable row level security;
alter table public.delivery_orders enable row level security;
alter table public.delivery_order_items enable row level security;
alter table public.delivery_order_stops enable row level security;
alter table public.scooter_tariffs enable row level security;
alter table public.scooter_rides enable row level security;
alter table public.driver_profiles enable row level security;
alter table public.driver_missions enable row level security;
alter table public.notifications enable row level security;

revoke all on public.businesses, public.products, public.product_options,
  public.delivery_orders, public.delivery_order_items, public.delivery_order_stops,
  public.scooter_tariffs, public.scooter_rides, public.driver_profiles,
  public.driver_missions, public.notifications
  from anon, authenticated;

grant select on public.businesses, public.products, public.product_options to anon, authenticated;
grant select on public.scooter_tariffs to authenticated;
grant select on public.delivery_orders, public.delivery_order_items,
  public.delivery_order_stops, public.scooter_rides, public.driver_profiles,
  public.driver_missions, public.notifications to authenticated;
grant update (is_online, deliveries_enabled, scooter_taxi_enabled, vehicle_model, plate_number)
  on public.driver_profiles to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant insert, update, delete on public.businesses, public.products,
  public.product_options, public.scooter_tariffs to authenticated;
grant insert, update, delete on public.delivery_orders, public.delivery_order_items,
  public.delivery_order_stops, public.scooter_rides, public.driver_profiles,
  public.driver_missions, public.notifications to service_role;

create policy "Active businesses are visible in the catalog"
  on public.businesses for select to anon, authenticated
  using (is_active or public.redgo_is_admin());
create policy "Admins manage businesses"
  on public.businesses for all to authenticated
  using (public.redgo_is_admin()) with check (public.redgo_is_admin());

create policy "Available products in active businesses are visible"
  on public.products for select to anon, authenticated
  using (
    (is_available and exists (
      select 1 from public.businesses b
      where b.id = business_id and b.is_active
    ))
    or public.redgo_is_admin()
  );
create policy "Admins manage products"
  on public.products for all to authenticated
  using (public.redgo_is_admin()) with check (public.redgo_is_admin());

create policy "Available product options are visible"
  on public.product_options for select to anon, authenticated
  using (
    (is_available and exists (
      select 1 from public.products p
      join public.businesses b on b.id = p.business_id
      where p.id = product_id and p.is_available and b.is_active
    ))
    or public.redgo_is_admin()
  );
create policy "Admins manage product options"
  on public.product_options for all to authenticated
  using (public.redgo_is_admin()) with check (public.redgo_is_admin());

create or replace function public.redgo_can_read_delivery_order(target_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.redgo_is_admin()
    or exists (
      select 1 from public.delivery_orders o
      where o.id = target_order_id
        and (o.customer_id = auth.uid() or o.driver_id = auth.uid())
    );
$$;

create or replace function public.redgo_can_read_scooter_ride(target_ride_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.redgo_is_admin()
    or exists (
      select 1 from public.scooter_rides r
      where r.id = target_ride_id
        and (r.customer_id = auth.uid() or r.driver_id = auth.uid())
    );
$$;

create policy "Customers and assigned drivers read delivery orders"
  on public.delivery_orders for select to authenticated
  using (public.redgo_can_read_delivery_order(id));
create policy "Admins manage delivery orders"
  on public.delivery_orders for all to authenticated
  using (public.redgo_is_admin()) with check (public.redgo_is_admin());

create policy "Order participants read order items"
  on public.delivery_order_items for select to authenticated
  using (public.redgo_can_read_delivery_order(order_id));
create policy "Admins manage order items"
  on public.delivery_order_items for all to authenticated
  using (public.redgo_is_admin()) with check (public.redgo_is_admin());

create policy "Order participants read pickup stops"
  on public.delivery_order_stops for select to authenticated
  using (public.redgo_can_read_delivery_order(order_id));
create policy "Admins manage pickup stops"
  on public.delivery_order_stops for all to authenticated
  using (public.redgo_is_admin()) with check (public.redgo_is_admin());

create policy "Active scooter tariff is visible"
  on public.scooter_tariffs for select to authenticated
  using (is_active or public.redgo_is_admin());
create policy "Admins manage scooter tariffs"
  on public.scooter_tariffs for all to authenticated
  using (public.redgo_is_admin()) with check (public.redgo_is_admin());

create policy "Customers and assigned drivers read scooter rides"
  on public.scooter_rides for select to authenticated
  using (public.redgo_can_read_scooter_ride(id));
create policy "Admins manage scooter rides"
  on public.scooter_rides for all to authenticated
  using (public.redgo_is_admin()) with check (public.redgo_is_admin());

create policy "Drivers and admins read driver profiles"
  on public.driver_profiles for select to authenticated
  using (user_id = auth.uid() or public.redgo_is_admin());
create policy "Drivers update their own availability and vehicle"
  on public.driver_profiles for update to authenticated
  using (user_id = auth.uid() and public.redgo_has_role('driver'))
  with check (user_id = auth.uid() and public.redgo_has_role('driver'));
create policy "Admins manage driver profiles"
  on public.driver_profiles for all to authenticated
  using (public.redgo_is_admin()) with check (public.redgo_is_admin());

create policy "Drivers read their assigned missions"
  on public.driver_missions for select to authenticated
  using (driver_id = auth.uid() or public.redgo_is_admin());
create policy "Admins manage missions"
  on public.driver_missions for all to authenticated
  using (public.redgo_is_admin()) with check (public.redgo_is_admin());

create policy "Users read their notifications"
  on public.notifications for select to authenticated
  using (user_id = auth.uid() or public.redgo_is_admin());
create policy "Users mark their notifications as read"
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "Admins manage notifications"
  on public.notifications for all to authenticated
  using (public.redgo_is_admin()) with check (public.redgo_is_admin());

create or replace function public.place_delivery_order(
  cart_items jsonb,
  destination_address text,
  destination_instructions text,
  recipient_phone text,
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
  new_order_id uuid;
  item jsonb;
  item_product public.products%rowtype;
  item_business public.businesses%rowtype;
  item_quantity integer;
  requested_options jsonb;
  selected_options_snapshot jsonb;
  option_price bigint;
  option_count integer;
  requested_option_count integer;
  products_total bigint;
  vendor_stop_count integer;
  delivery_fee bigint;
  service_fee constant bigint := 500;
  final_total bigint;
  stop_sequence integer := 0;
begin
  if current_user_id is null or not public.redgo_has_role('client') then
    raise exception 'An authorized client session is required.';
  end if;
  if jsonb_typeof(cart_items) is distinct from 'array' then
    raise exception 'The cart must be a JSON array.';
  end if;
  if jsonb_array_length(cart_items) not between 1 and 50 then
    raise exception 'The cart must contain between 1 and 50 lines.';
  end if;
  if destination_address is null or length(trim(destination_address)) not between 1 and 300 then
    raise exception 'A valid delivery address is required.';
  end if;
  if recipient_phone is null or length(trim(recipient_phone)) not between 6 and 32 then
    raise exception 'A valid recipient phone number is required.';
  end if;
  if not public.redgo_is_in_service_area(destination_latitude, destination_longitude) then
    raise exception 'The delivery location is outside the REDGO service area.';
  end if;

  insert into public.delivery_orders (
    reference, customer_id, destination_address, destination_instructions,
    recipient_phone, destination_latitude, destination_longitude
  )
  values (
    'RG-' || to_char(now(), 'YYMMDD') || '-' || lpad(nextval('public.redgo_reference_seq')::text, 6, '0'),
    current_user_id, trim(destination_address), left(coalesce(destination_instructions, ''), 1000),
    trim(recipient_phone), destination_latitude, destination_longitude
  )
  returning id into new_order_id;

  for item in select value from jsonb_array_elements(cart_items) as entries(value)
  loop
    if jsonb_typeof(item -> 'quantity') is distinct from 'number'
      or (item ->> 'quantity') !~ '^[0-9]{1,3}$' then
      raise exception 'Each cart line must include a valid quantity.';
    end if;
    item_quantity := (item ->> 'quantity')::integer;
    if item_quantity not between 1 and 100 then
      raise exception 'Cart quantity must be between 1 and 100.';
    end if;

    select p.* into item_product
    from public.products p
    join public.businesses b on b.id = p.business_id
    where p.id = item ->> 'product_id'
      and p.is_available
      and b.is_active
    for share of p, b;
    if not found then
      raise exception 'A cart product is missing or unavailable.';
    end if;
    if item_quantity > item_product.max_quantity then
      raise exception 'Requested quantity exceeds the product limit.';
    end if;

    select b.* into item_business
    from public.businesses b
    where b.id = item_product.business_id
      and b.is_active
    for share;

    requested_options := coalesce(item -> 'option_ids', '[]'::jsonb);
    if jsonb_typeof(requested_options) <> 'array' then
      raise exception 'Product options must be supplied as an array of option IDs.';
    end if;
    select count(*)::integer into requested_option_count
    from jsonb_array_elements_text(requested_options);
    if requested_option_count > 20 then
      raise exception 'Too many options were selected for a cart line.';
    end if;

    select coalesce(sum(o.price_millimes), 0)::bigint,
      count(*)::integer,
      coalesce(jsonb_agg(jsonb_build_object(
        'id', o.id, 'name', o.name, 'priceMillimes', o.price_millimes
      ) order by o.sort_order, o.id), '[]'::jsonb)
    into option_price, option_count, selected_options_snapshot
    from public.product_options o
    where o.product_id = item_product.id
      and o.is_available
      and o.id in (
        select distinct option_id
        from jsonb_array_elements_text(requested_options) as selected(option_id)
      );
    if option_count <> requested_option_count then
      raise exception 'A selected product option is invalid or unavailable.';
    end if;

    insert into public.delivery_order_items (
      order_id, product_id, business_id, product_name, business_name, quantity,
      unit_price_millimes, options_price_millimes, selected_options, notes
    )
    values (
      new_order_id, item_product.id, item_business.id, item_product.name, item_business.name,
      item_quantity, item_product.price_millimes, option_price,
      selected_options_snapshot, left(coalesce(item ->> 'notes', ''), 500)
    );
  end loop;

  select
    coalesce(sum((i.unit_price_millimes + i.options_price_millimes) * i.quantity), 0)::bigint,
    (count(distinct i.business_id) filter (where b.kind = 'restaurant')
      + case when count(*) filter (where b.kind = 'courses') > 0 then 1 else 0 end)::integer
  into products_total, vendor_stop_count
  from public.delivery_order_items i
  join public.businesses b on b.id = i.business_id
  where i.order_id = new_order_id;

  delivery_fee := 2500 + greatest(vendor_stop_count - 1, 0) * 1000;
  final_total := products_total + delivery_fee + service_fee;

  update public.delivery_orders
  set products_subtotal_millimes = products_total,
      delivery_fee_millimes = delivery_fee,
      service_fee_millimes = service_fee,
      total_millimes = final_total
  where id = new_order_id;

  for item_business in
    select distinct b.*
    from public.delivery_order_items i
    join public.businesses b on b.id = i.business_id
    where i.order_id = new_order_id
    order by b.kind, b.name
  loop
    stop_sequence := stop_sequence + 1;
    insert into public.delivery_order_stops (
      order_id, business_id, business_name, stop_type, address,
      latitude, longitude, sequence_number
    )
    values (
      new_order_id, item_business.id, item_business.name, item_business.kind,
      item_business.address, item_business.latitude, item_business.longitude, stop_sequence
    );
  end loop;

  insert into public.driver_missions (mission_type, delivery_order_id, customer_id)
  values ('delivery', new_order_id, current_user_id);

  return new_order_id;
end;
$$;

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
    distance_km, active_tariff.fare_millimes
  )
  returning id into new_ride_id;

  insert into public.driver_missions (mission_type, scooter_ride_id, customer_id)
  values ('scooter_ride', new_ride_id, current_user_id);

  return new_ride_id;
end;
$$;

create or replace function public.list_open_driver_missions()
returns table (
  mission_id uuid,
  mission_type text,
  reference text,
  pickup_address text,
  destination_address text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.redgo_has_role('driver') then
    raise exception 'An approved driver session is required.';
  end if;
  if not exists (
    select 1 from public.driver_profiles d
    where d.user_id = auth.uid() and d.is_online
  ) then
    raise exception 'Driver must be online to view available missions.';
  end if;

  return query
  select m.id, m.mission_type,
    case when m.mission_type = 'delivery' then o.reference else r.reference end,
    case when m.mission_type = 'delivery' then first_stop.address else r.pickup_address end,
    case when m.mission_type = 'delivery' then o.destination_address else r.destination_address end,
    m.created_at
  from public.driver_missions m
  left join public.delivery_orders o on o.id = m.delivery_order_id
  left join public.scooter_rides r on r.id = m.scooter_ride_id
  left join lateral (
    select s.address from public.delivery_order_stops s
    where s.order_id = o.id order by s.sequence_number limit 1
  ) first_stop on true
  join public.driver_profiles d on d.user_id = auth.uid()
  where m.status = 'searching'
    and m.driver_id is null
    and ((m.mission_type = 'delivery' and d.deliveries_enabled)
      or (m.mission_type = 'scooter_ride' and d.scooter_taxi_enabled))
  order by m.created_at;
end;
$$;

create or replace function public.accept_driver_mission(target_mission_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  selected_mission public.driver_missions%rowtype;
begin
  if current_user_id is null or not public.redgo_has_role('driver') then
    raise exception 'An approved driver session is required.';
  end if;
  if not exists (
    select 1 from public.driver_profiles d
    where d.user_id = current_user_id and d.is_online
  ) then
    raise exception 'Driver must be online to accept a mission.';
  end if;
  if exists (
    select 1 from public.driver_missions m
    where m.driver_id = current_user_id and m.status in ('assigned', 'accepted', 'in_progress')
  ) then
    raise exception 'A driver can have only one active mission.';
  end if;

  select * into selected_mission
  from public.driver_missions
  where id = target_mission_id
  for update;
  if not found or selected_mission.status <> 'searching' or selected_mission.driver_id is not null then
    raise exception 'This mission is no longer available.';
  end if;
  if (selected_mission.mission_type = 'delivery'
      and not exists (select 1 from public.driver_profiles where user_id = current_user_id and deliveries_enabled))
    or (selected_mission.mission_type = 'scooter_ride'
      and not exists (select 1 from public.driver_profiles where user_id = current_user_id and scooter_taxi_enabled)) then
    raise exception 'This type of mission is disabled for this driver.';
  end if;

  begin
    update public.driver_missions
    set driver_id = current_user_id, status = 'assigned', accepted_at = now()
    where id = selected_mission.id;
  exception when unique_violation then
    raise exception 'A driver can have only one active mission.';
  end;

  if selected_mission.mission_type = 'delivery' then
    update public.delivery_orders
    set driver_id = current_user_id, status = 'driver_assigned', assigned_at = now()
    where id = selected_mission.delivery_order_id;
  else
    update public.scooter_rides
    set driver_id = current_user_id, status = 'driver_assigned', assigned_at = now()
    where id = selected_mission.scooter_ride_id;
  end if;
  return selected_mission.id;
end;
$$;

create or replace function public.update_driver_mission_status(
  target_mission_id uuid,
  next_status text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  selected_mission public.driver_missions%rowtype;
begin
  if current_user_id is null or not public.redgo_has_role('driver') then
    raise exception 'An approved driver session is required.';
  end if;

  select * into selected_mission
  from public.driver_missions
  where id = target_mission_id and driver_id = current_user_id
  for update;
  if not found then
    raise exception 'Assigned mission not found.';
  end if;

  if not (
    (selected_mission.status = 'assigned' and next_status in ('accepted', 'cancelled'))
    or (selected_mission.status = 'accepted' and next_status in ('in_progress', 'cancelled'))
    or (selected_mission.status = 'in_progress' and next_status = 'completed')
  ) then
    raise exception 'Invalid mission status transition.';
  end if;

  update public.driver_missions
  set status = next_status,
      completed_at = case when next_status = 'completed' then now() else completed_at end
  where id = selected_mission.id;

  if selected_mission.mission_type = 'delivery' then
    update public.delivery_orders
    set status = case next_status
      when 'accepted' then 'driver_assigned'
      when 'in_progress' then 'on_the_way'
      when 'completed' then 'delivered'
      else 'cancelled'
    end,
    delivered_at = case when next_status = 'completed' then now() else delivered_at end
    where id = selected_mission.delivery_order_id;
  else
    update public.scooter_rides
    set status = case next_status
      when 'accepted' then 'driver_assigned'
      when 'in_progress' then 'ride_started'
      when 'completed' then 'ride_completed'
      else 'cancelled'
    end,
    completed_at = case when next_status = 'completed' then now() else completed_at end
    where id = selected_mission.scooter_ride_id;
  end if;

  if next_status = 'completed' then
    update public.driver_profiles
    set completed_missions_count = completed_missions_count + 1
    where user_id = current_user_id;
  end if;
  return next_status;
end;
$$;

revoke all on function public.redgo_set_updated_at() from public, anon, authenticated;
revoke all on function public.redgo_create_driver_profile() from public, anon, authenticated;
revoke all on function public.redgo_is_admin() from public, anon;
revoke all on function public.redgo_has_role(text) from public, anon;
revoke all on function public.redgo_is_in_service_area(double precision, double precision) from public, anon, authenticated;
revoke all on function public.redgo_can_read_delivery_order(uuid) from public, anon;
revoke all on function public.redgo_can_read_scooter_ride(uuid) from public, anon;
revoke all on function public.place_delivery_order(jsonb, text, text, text, double precision, double precision) from public, anon, authenticated;
revoke all on function public.create_scooter_ride(text, double precision, double precision, text, double precision, double precision) from public, anon, authenticated;
revoke all on function public.list_open_driver_missions() from public, anon, authenticated;
revoke all on function public.accept_driver_mission(uuid) from public, anon, authenticated;
revoke all on function public.update_driver_mission_status(uuid, text) from public, anon, authenticated;
grant execute on function public.redgo_is_admin() to anon, authenticated;
grant execute on function public.redgo_has_role(text) to authenticated;
grant execute on function public.redgo_is_in_service_area(double precision, double precision) to authenticated;
grant execute on function public.redgo_can_read_delivery_order(uuid) to authenticated;
grant execute on function public.redgo_can_read_scooter_ride(uuid) to authenticated;
grant execute on function public.place_delivery_order(jsonb, text, text, text, double precision, double precision) to authenticated;
grant execute on function public.create_scooter_ride(text, double precision, double precision, text, double precision, double precision) to authenticated;
grant execute on function public.list_open_driver_missions() to authenticated;
grant execute on function public.accept_driver_mission(uuid) to authenticated;
grant execute on function public.update_driver_mission_status(uuid, text) to authenticated;
