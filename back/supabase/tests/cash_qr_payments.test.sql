begin;

select plan(49);

select has_table('public', 'cash_payments', 'cash payment ledger exists');
select has_index('public', 'cash_payments', 'cash_payments_mission_id_key', 'one payment is stored per mission');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.cash_payments'::regclass),
  'cash payments have row-level security enabled'
);
select ok(
  not has_table_privilege('authenticated', 'public.cash_payments', 'INSERT'),
  'authenticated users cannot create payment records directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.cash_payments', 'UPDATE'),
  'authenticated users cannot mark payments paid directly'
);
select ok(
  to_regprocedure('public.issue_cash_payment_qr(text,uuid)') is not null,
  'customer QR issuance RPC exists'
);
select ok(
  to_regprocedure('public.validate_cash_payment_qr(text)') is not null,
  'driver QR validation RPC exists'
);
select ok(
  to_regprocedure('public.confirm_cash_payment(text)') is not null,
  'driver cash confirmation RPC exists'
);
select ok(
  to_regprocedure('public.list_admin_cash_payments()') is not null,
  'admin payment ledger RPC exists'
);
select ok(
  to_regprocedure('public.confirm_cash_payment(text,bigint)') is null,
  'cash confirmation does not accept a client-supplied amount'
);
select ok(
  not has_function_privilege('anon', 'public.confirm_cash_payment(text)', 'EXECUTE'),
  'anonymous users cannot confirm cash payments'
);

insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('10000000-0000-0000-0000-000000000001', 'cash-client@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{"requested_role":"client"}'),
  ('10000000-0000-0000-0000-000000000002', 'cash-other-client@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{"requested_role":"client"}'),
  ('20000000-0000-0000-0000-000000000001', 'cash-driver@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{"requested_role":"driver"}'),
  ('20000000-0000-0000-0000-000000000002', 'cash-other-driver@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{"requested_role":"driver"}');

insert into public.user_roles (user_id, role)
values
  ('20000000-0000-0000-0000-000000000001', 'driver'),
  ('20000000-0000-0000-0000-000000000002', 'driver');

update public.driver_profiles
set is_online = true,
    deliveries_enabled = true,
    scooter_taxi_enabled = true
where user_id = '20000000-0000-0000-0000-000000000001';

insert into public.delivery_orders (
  id, reference, customer_id, driver_id, status, destination_address, recipient_phone,
  destination_latitude, destination_longitude, products_subtotal_millimes,
  delivery_fee_millimes, service_fee_millimes, total_millimes
)
values (
  '30000000-0000-0000-0000-000000000001', 'RG-CASH-001',
  '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
  'driver_assigned', 'M''Saken', '+21620000001', 35.7273, 10.5815,
  10000, 2000, 500, 12500
);

insert into public.scooter_rides (
  id, reference, customer_id, driver_id, status, pickup_address, pickup_latitude,
  pickup_longitude, destination_address, destination_latitude, destination_longitude,
  estimated_distance_km, estimated_duration_minutes, fare_millimes
)
values (
  '40000000-0000-0000-0000-000000000001', 'TX-CASH-001',
  '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
  'driver_assigned', 'M''Saken', 35.7273, 10.5815, 'Messaadine', 35.7551, 10.5921,
  4.8, 12, 6500
);

insert into public.driver_missions (
  id, mission_type, delivery_order_id, customer_id, driver_id, status
)
values (
  '50000000-0000-0000-0000-000000000001', 'delivery',
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001', 'assigned'
);

insert into public.driver_missions (
  id, mission_type, scooter_ride_id, customer_id, driver_id, status
)
values (
  '50000000-0000-0000-0000-000000000002', 'scooter_ride',
  '40000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001', 'assigned'
);

select ok(
  (select amount_millimes = 12500 from public.cash_payments
    where mission_id = '50000000-0000-0000-0000-000000000001'),
  'delivery payment amount is snapshotted from the authoritative order total'
);
select ok(
  (select amount_millimes = 6500 from public.cash_payments
    where mission_id = '50000000-0000-0000-0000-000000000002'),
  'scooter payment amount is snapshotted from the authoritative fare'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{}}', true);
select throws_ok(
  $$select * from public.issue_cash_payment_qr('delivery', '30000000-0000-0000-0000-000000000001')$$,
  'P0001',
  'Payment mission not found for this customer.',
  'another customer cannot issue a mission payment QR'
);
select throws_ok(
  $$select * from public.get_cash_payment_status('delivery', '30000000-0000-0000-0000-000000000001')$$,
  'P0001',
  'Payment status is unavailable for this mission.',
  'another customer cannot inspect the payment status'
);
select throws_ok(
  $$select * from public.list_admin_cash_payments()$$,
  'P0001',
  'Administrator authorization required.',
  'a non-admin cannot read the admin cash ledger'
);

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{}}', true);
select throws_ok(
  $$select * from public.validate_cash_payment_qr('not-a-token')$$,
  'P0001',
  'QR token is invalid.',
  'malformed QR tokens are rejected'
);
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{}}', true);
select throws_ok(
  $$select public.update_driver_mission_status('50000000-0000-0000-0000-000000000001', 'completed')$$,
  'P0001',
  'Cash payment must be confirmed before completing a mission.',
  'legacy mission transition cannot complete before cash confirmation'
);
select is(
  public.update_driver_mission_status('50000000-0000-0000-0000-000000000001', 'accepted'),
  'accepted',
  'driver can accept a delivery before collecting cash'
);
select is(
  public.update_driver_mission_status('50000000-0000-0000-0000-000000000001', 'in_progress'),
  'in_progress',
  'driver can start a delivery before collecting cash'
);
select is(
  public.mark_mission_ready_for_cash('50000000-0000-0000-0000-000000000001'),
  'ready_for_cash',
  'delivery reaches its cash-collection stage without completing the mission'
);
select is(
  (select status from public.driver_missions where id = '50000000-0000-0000-0000-000000000001'),
  'in_progress',
  'delivery remains an active mission after reaching the customer'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{}}', true);
create temporary table test_delivery_qr as
select * from public.issue_cash_payment_qr('delivery', '30000000-0000-0000-0000-000000000001');
select ok(
  (select amount_millimes = 12500 and payment_status = 'pending' from test_delivery_qr),
  'customer receives the official delivery amount and pending state'
);
select ok(
  (select expires_at > now() and expires_at <= now() + interval '2 minutes'
    from test_delivery_qr),
  'issued delivery QR expires within the configured short lifetime'
);
select ok(
  (select qr_token_hash <> convert_to(token, 'UTF8')
    from public.cash_payments cross join test_delivery_qr
    where mission_id = '50000000-0000-0000-0000-000000000001'),
  'only a digest rather than the plaintext QR token is stored'
);

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{}}', true);
select throws_ok(
  $$select * from public.validate_cash_payment_qr((select token from test_delivery_qr))$$,
  'P0001',
  'This mission is not assigned to the authenticated driver.',
  'a different driver cannot validate the QR'
);

update public.cash_payments
set qr_expires_at = now() - interval '1 second'
where mission_id = '50000000-0000-0000-0000-000000000001';

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{}}', true);
select throws_ok(
  $$select * from public.validate_cash_payment_qr((select token from test_delivery_qr))$$,
  'P0001',
  'QR token has expired.',
  'an expired QR cannot be validated'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{}}', true);
create temporary table renewed_delivery_qr as
select * from public.issue_cash_payment_qr('delivery', '30000000-0000-0000-0000-000000000001');
select ok(
  (select old_qr.token <> new_qr.token
    from test_delivery_qr old_qr cross join renewed_delivery_qr new_qr),
  'QR renewal issues a new random token'
);

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{}}', true);
select throws_ok(
  $$select * from public.validate_cash_payment_qr((select token from test_delivery_qr))$$,
  'P0001',
  'QR token is invalid or has been replaced.',
  'a renewed QR invalidates its previous token'
);
select ok(
  (select amount_millimes = 12500 and payment_status = 'pending'
    from public.validate_cash_payment_qr((select token from renewed_delivery_qr))),
  'valid scan returns the server amount without settling the payment'
);
select is(
  (select status from public.driver_missions where id = '50000000-0000-0000-0000-000000000001'),
  'in_progress',
  'scanning alone does not close the mission'
);
update public.driver_profiles
set deliveries_enabled = false, scooter_taxi_enabled = true, is_online = true
where user_id = '20000000-0000-0000-0000-000000000001';
select is(
  (select payment_status from public.confirm_cash_payment((select token from renewed_delivery_qr))),
  'paid',
  'explicit driver confirmation records delivery cash as paid'
);
select is(
  (select status from public.delivery_orders where id = '30000000-0000-0000-0000-000000000001'),
  'cash_collected',
  'delivery status changes to cash collected only after confirmation'
);
select is(
  (select status from public.driver_missions where id = '50000000-0000-0000-0000-000000000001'),
  'completed',
  'delivery mission completes atomically with payment'
);
select ok(
  (select paid_at is not null and collected_by = '20000000-0000-0000-0000-000000000001'
    from public.cash_payments where mission_id = '50000000-0000-0000-0000-000000000001'),
  'payment records its time and authenticated collecting driver'
);
select ok(
  (select is_online and not deliveries_enabled and scooter_taxi_enabled
    from public.driver_profiles where user_id = '20000000-0000-0000-0000-000000000001'),
  'cash confirmation preserves online state and both availability settings'
);
select is(
  (select payment_status from public.confirm_cash_payment((select token from renewed_delivery_qr))),
  'paid',
  'repeating the same confirmation returns the existing paid result'
);
select is(
  (select completed_missions_count from public.driver_profiles
    where user_id = '20000000-0000-0000-0000-000000000001'),
  1,
  'replayed confirmation does not increment mission completion twice'
);

select is(
  public.update_driver_mission_status('50000000-0000-0000-0000-000000000002', 'accepted'),
  'accepted',
  'driver can accept a scooter mission'
);
select is(
  public.update_driver_mission_status('50000000-0000-0000-0000-000000000002', 'in_progress'),
  'in_progress',
  'driver can start a scooter mission'
);
select is(
  public.mark_mission_ready_for_cash('50000000-0000-0000-0000-000000000002'),
  'ready_for_cash',
  'scooter ride reaches its cash-collection stage without completing the mission'
);
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{}}', true);
create temporary table test_scooter_qr as
select * from public.issue_cash_payment_qr('scooter_ride', '40000000-0000-0000-0000-000000000001');
select ok(
  (select amount_millimes = 6500 and payment_status = 'pending' from test_scooter_qr),
  'scooter QR returns its authoritative fare'
);
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{}}', true);
select ok(
  (select mission_type = 'scooter_ride' and payment_status = 'pending'
    from public.validate_cash_payment_qr((select token from test_scooter_qr))),
  'scooter QR validates for its assigned driver'
);
select is(
  (select payment_status from public.confirm_cash_payment((select token from test_scooter_qr))),
  'paid',
  'explicit driver confirmation records scooter cash as paid'
);
select is(
  (select status from public.scooter_rides where id = '40000000-0000-0000-0000-000000000001'),
  'ride_completed',
  'scooter ride closes after cash confirmation'
);
select is(
  (select status from public.driver_missions where id = '50000000-0000-0000-0000-000000000002'),
  'completed',
  'scooter mission completes with payment'
);
select is(
  (select completed_missions_count from public.driver_profiles
    where user_id = '20000000-0000-0000-0000-000000000001'),
  2,
  'scooter confirmation counts exactly one additional completed mission'
);
select is(
  (select count(*)::integer from public.cash_payments where status = 'paid'),
  2,
  'one unified payment ledger records both delivery and scooter cash'
);
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"role":"admin"}}', true);
select is(
  (select count(*)::integer from public.list_admin_cash_payments()),
  2,
  'an authenticated admin can read the complete cash ledger'
);

select * from finish();

rollback;
