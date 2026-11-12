create extension if not exists pgtap with schema extensions;

begin;

select extensions.plan(5);

select extensions.ok(
  exists (
    select 1 from storage.buckets
    where id = 'redgo-product-images'
      and public
      and file_size_limit = 5242880
  ),
  'product image bucket is public with a 5 MB limit'
);

select extensions.ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Admins upload product images'
      and roles = array['authenticated']::name[]
      and with_check like '%redgo_is_admin%'
  ),
  'only admins can upload product images'
);

select extensions.ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Admins update product images'
      and roles = array['authenticated']::name[]
      and qual like '%redgo_is_admin%'
      and with_check like '%redgo_is_admin%'
  ),
  'only admins can update product images'
);

select extensions.ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Admins delete product images'
      and roles = array['authenticated']::name[]
      and qual like '%redgo_is_admin%'
  ),
  'only admins can delete product images'
);

select extensions.ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      and roles && array['anon'::name, 'public'::name]
      and concat_ws(' ', qual, with_check) like '%redgo-product-images%'
  ),
  'anonymous users cannot write product images'
);

select * from extensions.finish();

rollback;
