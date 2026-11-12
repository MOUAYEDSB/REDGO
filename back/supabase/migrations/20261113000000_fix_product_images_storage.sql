-- 1. S'assurer que le bucket redgo-product-images existe et est public
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
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- 2. Permettre la lecture publique de tous les objets de ce bucket
drop policy if exists "Public read product images" on storage.objects;
create policy "Public read product images"
  on storage.objects for select to public
  using (bucket_id = 'redgo-product-images');

-- 3. Permettre aux utilisateurs authentifiés d'uploader des photos de produits
drop policy if exists "Authenticated users upload product images" on storage.objects;
create policy "Authenticated users upload product images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'redgo-product-images');

-- 4. Permettre la mise à jour / remplacement
drop policy if exists "Authenticated users update product images" on storage.objects;
create policy "Authenticated users update product images"
  on storage.objects for update to authenticated
  using (bucket_id = 'redgo-product-images')
  with check (bucket_id = 'redgo-product-images');

-- 5. Permettre la suppression
drop policy if exists "Authenticated users delete product images" on storage.objects;
create policy "Authenticated users delete product images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'redgo-product-images');

