create extension if not exists pgcrypto with schema extensions;

create table public.cash_payments (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null unique references public.driver_missions(id) on delete restrict,
  amount_millimes bigint not null check (amount_millimes > 0),
  payment_method text not null default 'cash' check (payment_method = 'cash'),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'cancelled')),
  qr_token_hash bytea unique,
  qr_issued_at timestamptz,
  qr_expires_at timestamptz,
  qr_used_at timestamptz,
  paid_at timestamptz,
  collected_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cash_payments_qr_pair check (
    (qr_token_hash is null) = (qr_expires_at is null)
  ),
  constraint cash_payments_qr_issue check (
    qr_token_hash is null or qr_issued_at is not null
  ),
  constraint cash_payments_paid_fields check (
    (status = 'paid' and paid_at is not null and collected_by is not null and qr_used_at is not null)
    or (status <> 'paid' and paid_at is null and collected_by is null and qr_used_at is null)
  ),
  constraint cash_payments_cancelled_qr check (
    status <> 'cancelled' or qr_token_hash is null
  )
);

create index cash_payments_status_created_idx
  on public.cash_payments (status, created_at desc);
create index cash_payments_collector_paid_idx
  on public.cash_payments (collected_by, paid_at desc)
  where collected_by is not null;

create trigger cash_payments_set_updated_at
  before update on public.cash_payments
  for each row execute function public.redgo_set_updated_at();

create or replace function public.redgo_initialize_cash_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_amount bigint;
begin
  if new.mission_type = 'delivery' then
    select o.total_millimes into payment_amount
    from public.delivery_orders o
    where o.id = new.delivery_order_id and o.payment_method = 'cash';
  else
    select r.fare_millimes into payment_amount
    from public.scooter_rides r
    where r.id = new.scooter_ride_id and r.payment_method = 'cash';
  end if;

  if payment_amount is null or payment_amount <= 0 then
    raise exception 'A valid cash amount is required before creating a mission.';
  end if;

  insert into public.cash_payments (mission_id, amount_millimes)
  values (new.id, payment_amount);
  return new;
end;
$$;

create trigger driver_missions_initialize_cash_payment
  after insert on public.driver_missions
  for each row execute function public.redgo_initialize_cash_payment();

insert into public.cash_payments (mission_id, amount_millimes)
select m.id,
  case
    when m.mission_type = 'delivery' then o.total_millimes
    else r.fare_millimes
  end
from public.driver_missions m
left join public.delivery_orders o on o.id = m.delivery_order_id
left join public.scooter_rides r on r.id = m.scooter_ride_id
where m.status in ('searching', 'assigned', 'accepted', 'in_progress')
  and case
    when m.mission_type = 'delivery' then o.total_millimes > 0
    else r.fare_millimes > 0
  end
on conflict (mission_id) do nothing;

alter table public.cash_payments enable row level security;
revoke all on public.cash_payments from anon, authenticated;
grant select on public.cash_payments to authenticated;

create or replace function public.redgo_can_read_cash_payment(target_payment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.redgo_is_admin()
    or exists (
      select 1
      from public.cash_payments p
      join public.driver_missions m on m.id = p.mission_id
      where p.id = target_payment_id
        and (m.customer_id = auth.uid() or m.driver_id = auth.uid())
    );
$$;

create policy "Mission participants and admins read cash payments"
  on public.cash_payments for select to authenticated
  using (public.redgo_can_read_cash_payment(id));

create or replace function public.redgo_cash_qr_hash(token_value text)
returns bytea
language sql
immutable
set search_path = ''
as $$
  select extensions.digest(convert_to(token_value, 'UTF8'), 'sha256');
$$;

create or replace function public.redgo_new_cash_qr_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select encode(extensions.gen_random_bytes(32), 'hex');
$$;

create or replace function public.issue_cash_payment_qr(
  target_type text,
  target_id uuid
)
returns table (
  token text,
  amount_millimes bigint,
  expires_at timestamptz,
  payment_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_mission public.driver_missions%rowtype;
  target_payment public.cash_payments%rowtype;
  raw_token text;
  expiry timestamptz;
begin
  if current_user_id is null or not public.redgo_has_role('client') then
    raise exception 'An authorized client session is required.';
  end if;
  if target_type not in ('delivery', 'scooter_ride') or target_id is null then
    raise exception 'A valid delivery or scooter ride ID is required.';
  end if;

  if target_type = 'delivery' then
    select m.* into target_mission
    from public.driver_missions m
    join public.delivery_orders o on o.id = m.delivery_order_id
    where o.id = target_id and m.customer_id = current_user_id
      and m.mission_type = 'delivery'
    for update of m;
  else
    select m.* into target_mission
    from public.driver_missions m
    join public.scooter_rides r on r.id = m.scooter_ride_id
    where r.id = target_id and m.customer_id = current_user_id
      and m.mission_type = 'scooter_ride'
    for update of m;
  end if;

  if not found then
    raise exception 'Payment mission not found for this customer.';
  end if;
  if target_mission.status <> 'in_progress' or target_mission.driver_id is null then
    raise exception 'Cash QR is available only for an active assigned mission.';
  end if;

  if target_type = 'delivery' then
    perform 1 from public.delivery_orders
    where id = target_id and status = 'delivered'
    for update;
  else
    perform 1 from public.scooter_rides
    where id = target_id and status = 'ride_completed'
    for update;
  end if;
  if not found then
    raise exception 'The mission must reach its delivery or ride destination before payment.';
  end if;

  select p.* into target_payment
  from public.cash_payments p
  where p.mission_id = target_mission.id
  for update;
  if not found then
    raise exception 'Cash payment record not found.';
  end if;
  if target_payment.status = 'paid' then
    raise exception 'Cash payment has already been received.';
  end if;
  if target_payment.status <> 'pending' then
    raise exception 'Cash payment is no longer available.';
  end if;

  raw_token := public.redgo_new_cash_qr_token();
  expiry := now() + interval '2 minutes';

  update public.cash_payments p
  set qr_token_hash = public.redgo_cash_qr_hash(raw_token),
      qr_issued_at = now(),
      qr_expires_at = expiry,
      qr_used_at = null
  where p.id = target_payment.id;

  return query
  select raw_token, target_payment.amount_millimes, expiry, 'pending'::text;
end;
$$;

create or replace function public.mark_mission_ready_for_cash(target_mission_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_mission public.driver_missions%rowtype;
  target_status text;
begin
  if current_user_id is null or not public.redgo_has_role('driver') then
    raise exception 'An approved driver session is required.';
  end if;

  select m.* into target_mission
  from public.driver_missions m
  where m.id = target_mission_id and m.driver_id = current_user_id
  for update;
  if not found then
    raise exception 'Assigned mission not found.';
  end if;
  if target_mission.status <> 'in_progress' then
    raise exception 'Only an in-progress mission can be marked ready for cash.';
  end if;

  if target_mission.mission_type = 'delivery' then
    select o.status into target_status
    from public.delivery_orders o
    where o.id = target_mission.delivery_order_id
    for update;
    if target_status = 'on_the_way' then
      update public.delivery_orders set status = 'delivered'
      where id = target_mission.delivery_order_id;
    elsif target_status <> 'delivered' then
      raise exception 'Delivery order cannot be marked ready for cash from its current status.';
    end if;
  else
    select r.status into target_status
    from public.scooter_rides r
    where r.id = target_mission.scooter_ride_id
    for update;
    if target_status = 'ride_started' then
      update public.scooter_rides set status = 'ride_completed'
      where id = target_mission.scooter_ride_id;
    elsif target_status <> 'ride_completed' then
      raise exception 'Scooter ride cannot be marked ready for cash from its current status.';
    end if;
  end if;

  return 'ready_for_cash';
end;
$$;

create or replace function public.validate_cash_payment_qr(scanned_token text)
returns table (
  mission_type text,
  target_id uuid,
  reference text,
  amount_millimes bigint,
  payment_status text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  token_hash bytea;
  target_mission_id uuid;
  target_mission public.driver_missions%rowtype;
  target_payment public.cash_payments%rowtype;
  mission_reference text;
begin
  if current_user_id is null or not public.redgo_has_role('driver') then
    raise exception 'An approved driver session is required.';
  end if;
  if scanned_token is null or scanned_token !~ '^[0-9a-f]{64}$' then
    raise exception 'QR token is invalid.';
  end if;
  token_hash := public.redgo_cash_qr_hash(scanned_token);

  select p.mission_id into target_mission_id
  from public.cash_payments p
  where p.qr_token_hash = token_hash;
  if not found then
    raise exception 'QR token is invalid or has been replaced.';
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
  if not found or target_payment.qr_token_hash <> token_hash then
    raise exception 'QR token is invalid or has been replaced.';
  end if;
  if target_payment.status = 'paid' then
    payment_status := 'paid';
  elsif target_payment.status <> 'pending' then
    raise exception 'Cash payment is no longer available.';
  elsif target_payment.qr_expires_at <= now() then
    raise exception 'QR token has expired.';
  elsif target_mission.status <> 'in_progress' then
    raise exception 'The mission is no longer active.';
  elsif target_mission.mission_type = 'delivery' and not exists (
    select 1 from public.delivery_orders o
    where o.id = target_mission.delivery_order_id and o.status = 'delivered'
  ) then
    raise exception 'Delivery is not ready for cash collection.';
  elsif target_mission.mission_type = 'scooter_ride' and not exists (
    select 1 from public.scooter_rides r
    where r.id = target_mission.scooter_ride_id and r.status = 'ride_completed'
  ) then
    raise exception 'Scooter ride is not ready for cash collection.';
  else
    payment_status := 'pending';
  end if;

  if target_mission.mission_type = 'delivery' then
    select o.reference into mission_reference
    from public.delivery_orders o where o.id = target_mission.delivery_order_id;
  else
    select r.reference into mission_reference
    from public.scooter_rides r where r.id = target_mission.scooter_ride_id;
  end if;

  return query
  select target_mission.mission_type,
    case when target_mission.mission_type = 'delivery'
      then target_mission.delivery_order_id
      else target_mission.scooter_ride_id
    end,
    mission_reference,
    target_payment.amount_millimes,
    payment_status,
    target_payment.qr_expires_at;
end;
$$;

create or replace function public.confirm_cash_payment(scanned_token text)
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
  token_hash bytea;
  target_mission_id uuid;
  target_mission public.driver_missions%rowtype;
  target_payment public.cash_payments%rowtype;
  payment_time timestamptz;
begin
  if current_user_id is null or not public.redgo_has_role('driver') then
    raise exception 'An approved driver session is required.';
  end if;
  if scanned_token is null or scanned_token !~ '^[0-9a-f]{64}$' then
    raise exception 'QR token is invalid.';
  end if;
  token_hash := public.redgo_cash_qr_hash(scanned_token);

  select p.mission_id into target_mission_id
  from public.cash_payments p
  where p.qr_token_hash = token_hash;
  if not found then
    raise exception 'QR token is invalid or has been replaced.';
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
  if not found or target_payment.qr_token_hash <> token_hash then
    raise exception 'QR token is invalid or has been replaced.';
  end if;

  if target_payment.status = 'paid' then
    return query
    select 'paid'::text, target_mission.mission_type,
      target_payment.amount_millimes, target_payment.paid_at, target_mission.id;
    return;
  end if;
  if target_payment.status <> 'pending' then
    raise exception 'Cash payment is no longer available.';
  end if;
  if target_payment.qr_expires_at <= now() then
    raise exception 'QR token has expired.';
  end if;
  if target_mission.status <> 'in_progress' then
    raise exception 'The mission is no longer active.';
  end if;

  if target_mission.mission_type = 'delivery' then
    perform 1 from public.delivery_orders
    where id = target_mission.delivery_order_id and status = 'delivered'
    for update;
  else
    perform 1 from public.scooter_rides
    where id = target_mission.scooter_ride_id and status = 'ride_completed'
    for update;
  end if;
  if not found then
    raise exception 'The mission is not ready for cash collection.';
  end if;

  payment_time := now();
  update public.cash_payments p
  set status = 'paid',
      paid_at = payment_time,
      collected_by = current_user_id,
      qr_used_at = payment_time
  where p.id = target_payment.id;

  update public.driver_missions
  set status = 'completed', completed_at = payment_time
  where id = target_mission.id;

  if target_mission.mission_type = 'delivery' then
    update public.delivery_orders
    set status = 'cash_collected'
    where id = target_mission.delivery_order_id;
  else
    update public.scooter_rides
    set status = 'ride_completed', completed_at = payment_time
    where id = target_mission.scooter_ride_id;
  end if;

  update public.driver_profiles
  set completed_missions_count = completed_missions_count + 1
  where user_id = current_user_id;

  return query
  select 'paid'::text, target_mission.mission_type,
    target_payment.amount_millimes, payment_time, target_mission.id;
end;
$$;

create or replace function public.get_cash_payment_status(
  target_type text,
  target_id uuid
)
returns table (
  mission_type text,
  amount_millimes bigint,
  payment_status text,
  expires_at timestamptz,
  paid_at timestamptz,
  ready_for_payment boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication is required.';
  end if;
  if target_type not in ('delivery', 'scooter_ride') or target_id is null then
    raise exception 'A valid delivery or scooter ride ID is required.';
  end if;

  return query
  select m.mission_type, p.amount_millimes, p.status,
    p.qr_expires_at, p.paid_at,
    m.status = 'in_progress' and (
      (target_type = 'delivery' and o.status = 'delivered')
      or (target_type = 'scooter_ride' and r.status = 'ride_completed')
    )
  from public.driver_missions m
  join public.cash_payments p on p.mission_id = m.id
  left join public.delivery_orders o on o.id = m.delivery_order_id
  left join public.scooter_rides r on r.id = m.scooter_ride_id
  where m.mission_type = target_type
    and (m.customer_id = current_user_id or m.driver_id = current_user_id or public.redgo_is_admin())
    and (
      (target_type = 'delivery' and m.delivery_order_id = target_id)
      or (target_type = 'scooter_ride' and m.scooter_ride_id = target_id)
    );
  if not found then
    raise exception 'Payment status is unavailable for this mission.';
  end if;
end;
$$;

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
    case when m.mission_type = 'delivery' then o.reference else r.reference end,
    m.status,
    case when m.mission_type = 'delivery' then o.status else r.status end,
    case when m.mission_type = 'delivery' then first_stop.address else r.pickup_address end,
    case when m.mission_type = 'delivery' then o.destination_address else r.destination_address end,
    p.amount_millimes, p.status
  from public.driver_missions m
  join public.cash_payments p on p.mission_id = m.id
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

create or replace function public.list_admin_cash_payments()
returns table (
  payment_id uuid,
  mission_id uuid,
  mission_type text,
  reference text,
  customer_id uuid,
  customer_name text,
  driver_id uuid,
  driver_name text,
  collected_by_name text,
  amount_millimes bigint,
  payment_method text,
  payment_status text,
  created_at timestamptz,
  paid_at timestamptz,
  collected_by uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.redgo_is_admin() then
    raise exception 'Administrator authorization required.';
  end if;

  return query
  select p.id, m.id, m.mission_type,
    case when m.mission_type = 'delivery' then o.reference else r.reference end,
    m.customer_id, customer.full_name,
    m.driver_id, driver.full_name, collector.full_name,
    p.amount_millimes, p.payment_method, p.status,
    p.created_at, p.paid_at, p.collected_by
  from public.cash_payments p
  join public.driver_missions m on m.id = p.mission_id
  left join public.delivery_orders o on o.id = m.delivery_order_id
  left join public.scooter_rides r on r.id = m.scooter_ride_id
  left join public.profiles customer on customer.id = m.customer_id
  left join public.profiles driver on driver.id = m.driver_id
  left join public.profiles collector on collector.id = p.collected_by
  order by p.created_at desc;
end;
$$;

create or replace function public.redgo_cancel_cash_payment_for_cancelled_mission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    update public.cash_payments
    set status = 'cancelled',
        qr_token_hash = null,
        qr_expires_at = null
    where mission_id = new.id and status = 'pending';
  end if;
  return new;
end;
$$;

create trigger driver_missions_cancel_cash_payment
  after update of status on public.driver_missions
  for each row execute function public.redgo_cancel_cash_payment_for_cancelled_mission();

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
  if next_status = 'completed' then
    raise exception 'Cash payment must be confirmed before completing a mission.';
  end if;

  select m.* into selected_mission
  from public.driver_missions m
  where m.id = target_mission_id and m.driver_id = current_user_id
  for update;
  if not found then
    raise exception 'Assigned mission not found.';
  end if;
  if not (
    (selected_mission.status = 'assigned' and next_status in ('accepted', 'cancelled'))
    or (selected_mission.status = 'accepted' and next_status in ('in_progress', 'cancelled'))
    or (selected_mission.status = 'in_progress' and next_status = 'cancelled')
  ) then
    raise exception 'Invalid mission status transition.';
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

revoke all on function public.redgo_initialize_cash_payment() from public, anon, authenticated;
revoke all on function public.redgo_can_read_cash_payment(uuid) from public, anon;
revoke all on function public.redgo_cash_qr_hash(text) from public, anon, authenticated;
revoke all on function public.redgo_new_cash_qr_token() from public, anon, authenticated;
revoke all on function public.redgo_cancel_cash_payment_for_cancelled_mission() from public, anon, authenticated;
revoke all on function public.issue_cash_payment_qr(text, uuid) from public, anon, authenticated;
revoke all on function public.mark_mission_ready_for_cash(uuid) from public, anon, authenticated;
revoke all on function public.validate_cash_payment_qr(text) from public, anon, authenticated;
revoke all on function public.confirm_cash_payment(text) from public, anon, authenticated;
revoke all on function public.get_cash_payment_status(text, uuid) from public, anon, authenticated;
revoke all on function public.get_my_active_driver_mission() from public, anon, authenticated;
revoke all on function public.list_admin_cash_payments() from public, anon, authenticated;
revoke all on function public.update_driver_mission_status(uuid, text) from public, anon, authenticated;

grant execute on function public.redgo_can_read_cash_payment(uuid) to authenticated;
grant execute on function public.issue_cash_payment_qr(text, uuid) to authenticated;
grant execute on function public.mark_mission_ready_for_cash(uuid) to authenticated;
grant execute on function public.validate_cash_payment_qr(text) to authenticated;
grant execute on function public.confirm_cash_payment(text) to authenticated;
grant execute on function public.get_cash_payment_status(text, uuid) to authenticated;
grant execute on function public.get_my_active_driver_mission() to authenticated;
grant execute on function public.list_admin_cash_payments() to authenticated;
grant execute on function public.update_driver_mission_status(uuid, text) to authenticated;
