insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'redgo-product-images',
  'redgo-product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins upload product images" on storage.objects;
create policy "Admins upload product images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'redgo-product-images'
    and public.redgo_is_admin()
  );

drop policy if exists "Admins update product images" on storage.objects;
create policy "Admins update product images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'redgo-product-images'
    and public.redgo_is_admin()
  )
  with check (
    bucket_id = 'redgo-product-images'
    and public.redgo_is_admin()
  );

drop policy if exists "Admins delete product images" on storage.objects;
create policy "Admins delete product images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'redgo-product-images'
    and public.redgo_is_admin()
  );