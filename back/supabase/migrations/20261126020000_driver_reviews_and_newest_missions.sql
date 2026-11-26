-- Driver reviews & ratings table + newest-first open missions ordering

create table if not exists public.driver_reviews (
  id uuid primary key default gen_random_uuid(),
  mission_type text not null check (mission_type in ('delivery', 'scooter_ride')),
  delivery_order_id uuid unique references public.delivery_orders(id) on delete cascade,
  scooter_ride_id uuid unique references public.scooter_rides(id) on delete cascade,
  driver_id uuid not null,
  customer_id uuid not null,
  rating integer not null check (rating between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now(),
  constraint driver_reviews_target_check check (
    (mission_type = 'delivery' and delivery_order_id is not null and scooter_ride_id is null)
    or
    (mission_type = 'scooter_ride' and scooter_ride_id is not null and delivery_order_id is null)
  )
);

create index if not exists driver_reviews_driver_created_idx
  on public.driver_reviews (driver_id, created_at desc);

alter table public.driver_reviews enable row level security;

grant select, insert on public.driver_reviews to authenticated;

drop policy if exists "Customers and drivers read relevant reviews" on public.driver_reviews;
create policy "Customers and drivers read relevant reviews"
  on public.driver_reviews for select to authenticated
  using (customer_id = auth.uid() or driver_id = auth.uid());

drop policy if exists "Customers insert their own reviews" on public.driver_reviews;
create policy "Customers insert their own reviews"
  on public.driver_reviews for insert to authenticated
  with check (customer_id = auth.uid());

create or replace function public.submit_driver_review(
  target_type text,
  target_id uuid,
  p_rating integer,
  p_comment text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_driver_id uuid;
  v_status text;
  v_paid boolean := false;
  v_review_id uuid;
  v_avg numeric(3, 2);
begin
  if current_user_id is null then
    raise exception 'Session authentifiée requise.';
  end if;

  if p_rating < 1 or p_rating > 5 then
    raise exception 'La note doit être comprise entre 1 et 5.';
  end if;

  if target_type = 'delivery' then
    select o.driver_id, o.status
    into v_driver_id, v_status
    from public.delivery_orders o
    where o.id = target_id
      and o.customer_id = current_user_id;

    if not found or v_driver_id is null then
      raise exception 'Commande introuvable ou sans livreur assigné.';
    end if;

    v_paid := exists (
      select 1
      from public.driver_missions m
      join public.cash_payments cp on cp.mission_id = m.id
      where m.delivery_order_id = target_id
        and cp.status = 'paid'
    );

    if v_status not in ('delivered', 'cash_collected') and not v_paid then
      raise exception 'Commande non encore livrée.';
    end if;

    insert into public.driver_reviews (
      mission_type, delivery_order_id, driver_id, customer_id, rating, comment
    )
    values (
      'delivery', target_id, v_driver_id, current_user_id, p_rating, left(trim(coalesce(p_comment, '')), 500)
    )
    on conflict (delivery_order_id) do update
      set rating = excluded.rating,
          comment = excluded.comment
    returning id into v_review_id;

  elsif target_type = 'scooter_ride' then
    select r.driver_id, r.status
    into v_driver_id, v_status
    from public.scooter_rides r
    where r.id = target_id
      and r.customer_id = current_user_id;

    if not found or v_driver_id is null then
      raise exception 'Course introuvable ou sans chauffeur assigné.';
    end if;

    v_paid := exists (
      select 1
      from public.driver_missions m
      join public.cash_payments cp on cp.mission_id = m.id
      where m.scooter_ride_id = target_id
        and cp.status = 'paid'
    );

    if v_status <> 'ride_completed' and not v_paid then
      raise exception 'Course non encore terminée.';
    end if;

    insert into public.driver_reviews (
      mission_type, scooter_ride_id, driver_id, customer_id, rating, comment
    )
    values (
      'scooter_ride', target_id, v_driver_id, current_user_id, p_rating, left(trim(coalesce(p_comment, '')), 500)
    )
    on conflict (scooter_ride_id) do update
      set rating = excluded.rating,
          comment = excluded.comment
    returning id into v_review_id;
  else
    raise exception 'Type de mission invalide.';
  end if;

  select round(avg(rating)::numeric, 2) into v_avg
  from public.driver_reviews
  where driver_id = v_driver_id;

  if v_avg is not null then
    update public.driver_profiles
    set rating = v_avg, updated_at = now()
    where user_id = v_driver_id;
  end if;

  return v_review_id;
end;
$$;

grant execute on function public.submit_driver_review(text, uuid, integer, text) to authenticated;

-- Ensure list_open_driver_missions orders newest first (created_at desc)
drop function if exists public.list_open_driver_missions();
create or replace function public.list_open_driver_missions()
returns table (
  mission_id uuid,
  mission_type text,
  target_id uuid,
  reference text,
  pickup_address text,
  destination_address text,
  mission_status text,
  service_status text,
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
  select
    m.id,
    m.mission_type,
    coalesce(m.delivery_order_id, m.scooter_ride_id),
    case when m.mission_type = 'delivery' then o.reference else r.reference end,
    case when m.mission_type = 'delivery' then first_stop.address else r.pickup_address end,
    case when m.mission_type = 'delivery' then o.destination_address else r.destination_address end,
    m.status,
    case when m.mission_type = 'delivery' then o.status else r.status end,
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
    and (
      (m.mission_type = 'delivery' and d.deliveries_enabled and o.id is not null and o.status not in ('cancelled', 'delivered', 'cash_collected'))
      or
      (m.mission_type = 'scooter_ride' and d.scooter_taxi_enabled and r.id is not null and r.status not in ('cancelled', 'ride_completed'))
    )
  order by m.created_at desc;
end;
$$;

revoke all on function public.list_open_driver_missions() from public, anon, authenticated;
grant execute on function public.list_open_driver_missions() to authenticated;

notify pgrst, 'reload schema';
