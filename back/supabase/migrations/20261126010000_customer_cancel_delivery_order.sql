-- Allow customers to cancel their own delivery order ONLY before a driver accepts/is assigned

grant select, update on public.delivery_orders to authenticated;

drop policy if exists "Customers can cancel pending delivery orders" on public.delivery_orders;
create policy "Customers can cancel pending delivery orders"
  on public.delivery_orders
  for update
  to authenticated
  using (
    customer_id = auth.uid()
    and status in ('confirmed', 'searching_driver')
  )
  with check (
    customer_id = auth.uid()
    and status = 'cancelled'
  );

create or replace function public.cancel_customer_delivery_order(target_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  order_row record;
begin
  if current_user_id is null then
    raise exception 'Session authentifiée requise.';
  end if;

  select id, customer_id, status, driver_id
  into order_row
  from public.delivery_orders
  where id = target_order_id
  for update;

  if not found then
    raise exception 'Commande introuvable.';
  end if;

  if order_row.customer_id <> current_user_id then
    raise exception 'Vous ne pouvez pas annuler cette commande.';
  end if;

  if order_row.driver_id is not null or order_row.status not in ('confirmed', 'searching_driver') then
    raise exception 'Annulation impossible : un livreur a déjà accepté cette commande.';
  end if;

  update public.delivery_orders
  set status = 'cancelled', updated_at = now()
  where id = target_order_id;

  update public.driver_missions
  set status = 'cancelled', updated_at = now()
  where delivery_order_id = target_order_id
    and status = 'searching';

  return true;
end;
$$;

grant execute on function public.cancel_customer_delivery_order(uuid) to authenticated;

-- Also update list_open_driver_missions to exclude cancelled/completed orders & rides at DB level
-- and return target_id, mission_status, service_status matching OpenDriverMissionRow.
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
  order by m.created_at;
end;
$$;

revoke all on function public.list_open_driver_missions() from public, anon, authenticated;
grant execute on function public.list_open_driver_missions() to authenticated;

notify pgrst, 'reload schema';
