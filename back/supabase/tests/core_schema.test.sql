begin;

select plan(19);

select has_table('public', 'businesses', 'business catalog table exists');
select has_table('public', 'products', 'product catalog table exists');
select has_table('public', 'product_options', 'product options table exists');
select has_table('public', 'delivery_orders', 'delivery orders table exists');
select has_table('public', 'delivery_order_items', 'delivery item snapshots table exists');
select has_table('public', 'delivery_order_stops', 'delivery pickup stops table exists');
select has_table('public', 'scooter_rides', 'scooter rides table exists');
select has_table('public', 'driver_missions', 'driver missions table exists');
select has_table('public', 'notifications', 'notifications table exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.delivery_orders'::regclass),
  'delivery orders have row-level security enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.scooter_rides'::regclass),
  'scooter rides have row-level security enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.driver_missions'::regclass),
  'driver missions have row-level security enabled'
);
select has_index(
  'public',
  'driver_missions',
  'driver_missions_one_active_per_driver_idx',
  'one active mission per driver is enforced by a unique index'
);
select ok(
  not has_table_privilege('authenticated', 'public.delivery_orders', 'INSERT'),
  'authenticated clients cannot insert delivery orders directly'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.place_delivery_order(jsonb,text,text,text,double precision,double precision)',
    'EXECUTE'
  ),
  'anonymous users cannot execute delivery creation'
);
select ok(
  to_regprocedure('public.place_delivery_order(jsonb,text,text,text,double precision,double precision)') is not null,
  'delivery creation RPC exists'
);
select ok(
  to_regprocedure('public.create_scooter_ride(text,double precision,double precision,text,double precision,double precision)') is not null,
  'scooter ride creation RPC exists'
);
select ok(
  to_regprocedure('public.accept_driver_mission(uuid)') is not null,
  'atomic driver mission acceptance RPC exists'
);
select ok(
  to_regprocedure('public.update_driver_mission_status(uuid,text)') is not null,
  'driver mission transition RPC exists'
);

select * from finish();

rollback;
