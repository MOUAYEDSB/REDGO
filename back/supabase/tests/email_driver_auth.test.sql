begin;

select plan(12);

select has_column('public', 'profiles', 'email', 'profiles store the verified login email');
select has_column('public', 'profiles', 'avatar_path', 'profiles store the private driver photo path');
select has_column('public', 'driver_profiles', 'scooter_brand', 'driver profiles store scooter brand');
select has_column('public', 'driver_profiles', 'scooter_photo_path', 'driver profiles store private scooter photo path');
select has_function(
  'public',
  'save_driver_application_profile',
  array['text', 'text', 'text'],
  'driver profile RPC exists'
);
select has_function(
  'public',
  'submit_driver_application',
  array[]::text[],
  'driver application RPC exists'
);
select has_function(
  'public',
  'review_driver_application',
  array['uuid', 'text', 'text'],
  'administrator review RPC exists'
);
select ok(
  exists (
    select 1 from storage.buckets
    where id = 'redgo-driver-documents' and not public
  ),
  'driver document bucket is private'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Driver applicants upload their own documents'
  ),
  'driver document upload policy is present'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Applicants and admins read driver documents'
  ),
  'driver document read policy is present'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.save_driver_application_profile(text,text,text)',
    'EXECUTE'
  ),
  'anonymous users cannot save driver application profiles'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.submit_driver_application()',
    'EXECUTE'
  ),
  'anonymous users cannot submit driver applications'
);

select * from finish();

rollback;
