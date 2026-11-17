-- ====================================================================
-- Migration: 20261117000000_driver_manual_cash_and_transitions.sql
-- Validation d'encaissement espèces direct & transitions fluides chauffeur
-- ====================================================================

-- 1. Clôture manuelle d'encaissement espèces direct (sans QR obligatoire)
create or replace function public.confirm_manual_cash_payment(target_mission_id uuid)
returns table (
  payment_status text,
  mission_type text,
  amount_millimes bigint,
  paid_at timestamptz,
  mission_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_mission public.driver_missions%rowtype;
  target_payment public.cash_payments%rowtype;
  payment_time timestamptz := now();
begin
  if current_user_id is null or not public.redgo_has_role('driver') then
    raise exception 'An approved driver session is required.';
  end if;

  select m.* into target_mission
  from public.driver_missions m
  where m.id = target_mission_id
  for update;
  if not found or target_mission.driver_id <> current_user_id then
    raise exception 'This mission is not assigned to the authenticated driver.';
  end if;

  select p.* into target_payment
  from public.cash_payments p
  where p.mission_id = target_mission_id
  for update;

  if target_mission.status = 'completed' then
    return query
    select 'paid'::text, target_mission.mission_type,
      coalesce(target_payment.amount_millimes, 3500::bigint),
      coalesce(target_payment.paid_at, payment_time),
      target_mission.id;
    return;
  end if;

  -- Mettre à jour la ligne de paiement si elle existe
  if found then
    update public.cash_payments p
    set status = 'paid',
        paid_at = payment_time,
        collected_by = current_user_id,
        payment_method = 'cash'
    where p.id = target_payment.id;
  end if;

  -- Marquer la mission terminée
  update public.driver_missions
  set status = 'completed', completed_at = payment_time
  where id = target_mission.id;

  -- Mettre à jour la commande livraison ou la course scooter
  if target_mission.mission_type = 'delivery' then
    update public.delivery_orders
    set status = 'cash_collected',
        delivered_at = coalesce(delivered_at, payment_time)
    where id = target_mission.delivery_order_id;
  else
    update public.scooter_rides
    set status = 'ride_completed',
        completed_at = coalesce(completed_at, payment_time)
    where id = target_mission.scooter_ride_id;
  end if;

  -- Incrémenter les courses réussies du chauffeur
  update public.driver_profiles
  set completed_missions_count = completed_missions_count + 1
  where user_id = current_user_id;

  return query
  select 'paid'::text, target_mission.mission_type,
    coalesce(target_payment.amount_millimes, 3500::bigint),
    payment_time,
    target_mission.id;
end;
$$;

revoke all on function public.confirm_manual_cash_payment(uuid) from public, anon;
grant execute on function public.confirm_manual_cash_payment(uuid) to authenticated;

-- 2. Transitions d'état fluides et sans blocage
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

  select m.* into selected_mission
  from public.driver_missions m
  where m.id = target_mission_id and m.driver_id = current_user_id
  for update;
  if not found then
    raise exception 'Assigned mission not found.';
  end if;

  -- Si next_status = 'completed', déléguer à confirm_manual_cash_payment
  if next_status = 'completed' then
    perform public.confirm_manual_cash_payment(target_mission_id);
    return 'completed';
  end if;

  -- Autorise assigned -> accepted, assigned -> in_progress, accepted -> in_progress
  if not (
    (selected_mission.status = 'assigned' and next_status in ('accepted', 'in_progress', 'cancelled'))
    or (selected_mission.status = 'accepted' and next_status in ('in_progress', 'cancelled'))
    or (selected_mission.status = 'in_progress' and next_status in ('completed', 'cancelled'))
  ) then
    raise exception 'Invalid mission status transition from % to %.', selected_mission.status, next_status;
  end if;

  update public.driver_missions
  set status = next_status
  where id = selected_mission.id;

  if selected_mission.mission_type = 'delivery' then
    update public.delivery_orders
    set status = case next_status
      when 'accepted' then 'driver_assigned'
      when 'in_progress' then 'on_the_way'
      else 'cancelled'
    end
    where id = selected_mission.delivery_order_id;
  else
    update public.scooter_rides
    set status = case next_status
      when 'accepted' then 'driver_assigned'
      when 'in_progress' then 'ride_started'
      else 'cancelled'
    end
    where id = selected_mission.scooter_ride_id;
  end if;

  return next_status;
end;
$$;

-- 3. Sécurisation de get_my_active_driver_mission avec LEFT JOIN
create or replace function public.get_my_active_driver_mission()
returns table (
  mission_id uuid,
  mission_type text,
  target_id uuid,
  reference text,
  mission_status text,
  service_status text,
  pickup_address text,
  destination_address text,
  amount_millimes bigint,
  payment_status text
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

  return query
  select m.id, m.mission_type,
    case when m.mission_type = 'delivery' then m.delivery_order_id else m.scooter_ride_id end,
    case when m.mission_type = 'delivery' then coalesce(o.reference, 'CMD') else coalesce(r.reference, 'TAX') end,
    m.status,
    case when m.mission_type = 'delivery' then coalesce(o.status, 'driver_assigned') else coalesce(r.status, 'driver_assigned') end,
    case when m.mission_type = 'delivery' then coalesce(first_stop.address, 'M''Saken') else coalesce(r.pickup_address, 'M''Saken') end,
    case when m.mission_type = 'delivery' then coalesce(o.destination_address, 'M''Saken') else coalesce(r.destination_address, 'M''Saken') end,
    coalesce(p.amount_millimes, 3500::bigint),
    coalesce(p.status, 'pending')
  from public.driver_missions m
  left join public.cash_payments p on p.mission_id = m.id
  left join public.delivery_orders o on o.id = m.delivery_order_id
  left join public.scooter_rides r on r.id = m.scooter_ride_id
  left join lateral (
    select s.address from public.delivery_order_stops s
    where s.order_id = o.id order by s.sequence_number limit 1
  ) first_stop on true
  where m.driver_id = auth.uid()
    and m.status in ('assigned', 'accepted', 'in_progress')
  order by m.created_at desc
  limit 1;
end;
$$;
