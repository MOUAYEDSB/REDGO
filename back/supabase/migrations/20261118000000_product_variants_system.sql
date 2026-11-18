-- ====================================================================
-- Migration: 20261118000000_product_variants_system.sql
-- Système complet de variantes de produits pour REDGO (Admin & Client)
-- ====================================================================

-- 1. Ajout de la colonne has_variants sur la table products
alter table public.products
  add column if not exists has_variants boolean not null default false;

-- 2. Création de la table product_variants
create table if not exists public.product_variants (
  id text primary key check (length(trim(id)) between 1 and 100),
  product_id text not null references public.products(id) on update cascade on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  price_millimes bigint not null check (price_millimes >= 0),
  is_available boolean not null default true,
  max_quantity integer not null default 30 check (max_quantity between 1 and 100),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_variants_product_name_unique unique (product_id, name)
);

-- Index pour performances de recherche
create index if not exists product_variants_product_idx
  on public.product_variants (product_id, sort_order, is_available);

-- 3. Mise à jour automatique de updated_at
create or replace trigger set_product_variants_updated_at
  before update on public.product_variants
  for each row execute function public.redgo_set_updated_at();

-- 4. Permissions PostgREST & RLS sur product_variants
grant select on public.product_variants to anon, authenticated;
grant all on public.product_variants to authenticated, service_role;

alter table public.product_variants enable row level security;

-- Lecture publique pour les variantes du catalogue
drop policy if exists "Anyone can read available product variants" on public.product_variants;
drop policy if exists "Variants are viewable in catalog" on public.product_variants;
create policy "Variants are viewable in catalog"
  on public.product_variants
  for select to anon, authenticated
  using (true);

-- Gestion complète réservée à l'administrateur et au service_role
drop policy if exists "Admins can insert product variants" on public.product_variants;
drop policy if exists "Admins manage product variants insert" on public.product_variants;
create policy "Admins manage product variants insert"
  on public.product_variants
  for insert to authenticated
  with check (
    auth.role() = 'service_role'
    or public.redgo_is_admin()
  );

drop policy if exists "Admins can update product variants" on public.product_variants;
drop policy if exists "Admins manage product variants update" on public.product_variants;
create policy "Admins manage product variants update"
  on public.product_variants
  for update to authenticated
  using (
    auth.role() = 'service_role'
    or public.redgo_is_admin()
  )
  with check (
    auth.role() = 'service_role'
    or public.redgo_is_admin()
  );

drop policy if exists "Admins can delete product variants" on public.product_variants;
drop policy if exists "Admins manage product variants delete" on public.product_variants;
create policy "Admins manage product variants delete"
  on public.product_variants
  for delete to authenticated
  using (
    auth.role() = 'service_role'
    or public.redgo_is_admin()
  );

-- 5. Mise à jour de delivery_order_items pour stocker la variante choisie
alter table public.delivery_order_items
  add column if not exists variant_id text references public.product_variants(id) on update cascade on delete set null,
  add column if not exists variant_name text;

-- 6. Mise à jour de la fonction RPC place_delivery_order avec contrôle strict des prix et variantes
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
  item_variant public.product_variants%rowtype;
  item_quantity integer;
  item_unit_price bigint;
  item_variant_id text;
  item_variant_name text;
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

    select b.* into item_business
    from public.businesses b
    where b.id = item_product.business_id
      and b.is_active
    for share;

    -- Gestion et vérification stricte de la variante côté serveur
    item_variant_id := trim(coalesce(item ->> 'variant_id', ''));
    if item_product.has_variants or exists (select 1 from public.product_variants pv where pv.product_id = item_product.id and pv.is_available) then
      if item_variant_id = '' then
        raise exception 'Une variante doit obligatoirement être sélectionnée pour le produit %.', item_product.name;
      end if;

      select * into item_variant
      from public.product_variants pv
      where pv.id = item_variant_id
        and pv.product_id = item_product.id
        and pv.is_available;

      if not found then
        raise exception 'La variante sélectionnée pour % est introuvable ou indisponible.', item_product.name;
      end if;

      if item_quantity > item_variant.max_quantity then
        raise exception 'La quantité demandée pour la variante % dépasse la limite autorisée (% max).', item_variant.name, item_variant.max_quantity;
      end if;

      item_unit_price := item_variant.price_millimes;
      item_variant_name := item_variant.name;
    else
      -- Produit simple sans variante
      if item_quantity > item_product.max_quantity then
        raise exception 'Requested quantity exceeds the product limit.';
      end if;
      item_unit_price := item_product.price_millimes;
      item_variant_id := null;
      item_variant_name := null;
    end if;

    -- Options configurables
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
      order_id, product_id, variant_id, variant_name, business_id,
      product_name, business_name, quantity,
      unit_price_millimes, options_price_millimes, selected_options, notes
    )
    values (
      new_order_id, item_product.id, item_variant_id, item_variant_name, item_business.id,
      item_product.name, item_business.name, item_quantity,
      item_unit_price, option_price,
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
