-- ====================================================================
-- Permissions et Politiques RLS pour product_variants
-- ====================================================================

-- 1. Accorder les permissions d'accès PostgREST sur product_variants
grant select on public.product_variants to anon, authenticated;
grant all on public.product_variants to authenticated, service_role;

-- 2. Activer RLS
alter table public.product_variants enable row level security;

-- 3. Nettoyer les anciennes politiques pour éviter les conflits
drop policy if exists "Anyone can read available product variants" on public.product_variants;
drop policy if exists "Variants are viewable in catalog" on public.product_variants;
drop policy if exists "Admins can insert product variants" on public.product_variants;
drop policy if exists "Admins manage product variants insert" on public.product_variants;
drop policy if exists "Admins can update product variants" on public.product_variants;
drop policy if exists "Admins manage product variants update" on public.product_variants;
drop policy if exists "Admins can delete product variants" on public.product_variants;
drop policy if exists "Admins manage product variants delete" on public.product_variants;

-- 4. Lecture publique du catalogue des variantes (sans sous-requête bloquante vers user_roles)
create policy "Variants are viewable in catalog"
  on public.product_variants
  for select to anon, authenticated
  using (true);

-- 5. Gestion complète pour les administrateurs et service_role
create policy "Admins manage product variants insert"
  on public.product_variants
  for insert to authenticated
  with check (
    auth.role() = 'service_role'
    or public.redgo_is_admin()
  );

create policy "Admins manage product variants update"
  on public.product_variants
  for update to authenticated
  using (
    auth.role() = 'service_role'
    or public.redgo_is_admin()
  )
  with check (
    auth.role() = 'service_role'
    or public.redgo_is_admin()
  );

create policy "Admins manage product variants delete"
  on public.product_variants
  for delete to authenticated
  using (
    auth.role() = 'service_role'
    or public.redgo_is_admin()
  );
