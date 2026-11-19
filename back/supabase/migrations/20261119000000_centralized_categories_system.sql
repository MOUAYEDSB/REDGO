-- ====================================================================
-- Migration: 20261119000000_centralized_categories_system.sql
-- Système centralisé de gestion des catégories et menus par établissement
-- ====================================================================

-- 1. Table centrale des catégories (avec support arborescent & multi-activités)
create table if not exists public.categories (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  name text not null check (length(trim(name)) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  description text not null default '',
  image_url text,
  parent_id text references public.categories(id) on update cascade on delete set null,
  activity_types text[] not null default array['restaurant']::text[],
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index pour requêtes performantes
create index if not exists categories_parent_id_idx on public.categories(parent_id);
create index if not exists categories_sort_order_idx on public.categories(sort_order);
create index if not exists categories_is_active_idx on public.categories(is_active);

-- Trigger updated_at automatique
create or replace trigger set_categories_updated_at
  before update on public.categories
  for each row execute function public.redgo_set_updated_at();

-- 2. Table d'assignation des catégories aux établissements (Menus par restaurant)
create table if not exists public.business_categories (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9_-]{1,95}$'),
  business_id text not null references public.businesses(id) on update cascade on delete cascade,
  category_id text not null references public.categories(id) on update cascade on delete cascade,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint business_categories_unique unique (business_id, category_id)
);

create index if not exists business_categories_biz_idx on public.business_categories(business_id, sort_order);
create index if not exists business_categories_cat_idx on public.business_categories(category_id);

-- 3. Ajout de category_id dans la table products (en conservant la colonne category pour rétrocompatibilité)
alter table public.products
  add column if not exists category_id text references public.categories(id) on update cascade on delete set null;

create index if not exists products_category_id_idx on public.products(category_id);

-- 4. Initialisation des catégories standard et migration des catégories des 48 produits existants
insert into public.categories (id, name, slug, description, activity_types, is_active, sort_order)
values
  ('pizzas', 'Pizzas', 'pizzas', 'Pizzas artisanales, classiques et spéciales au feu de bois.', array['restaurant'], true, 10),
  ('burgers', 'Burgers', 'burgers', 'Smash burgers et burgers gourmets avec frites maison.', array['restaurant'], true, 20),
  ('sandwichs-makloub', 'Sandwichs & Makloub', 'sandwichs-makloub', 'Chapatis, makloubs, mlawis et sandwichs baguettes.', array['restaurant'], true, 30),
  ('plats-tunisiens', 'Plats Tunisiens & Grillades', 'plats-tunisiens', 'Couscous, ojja, grillades et spécialités traditionnelles.', array['restaurant'], true, 40),
  ('pates', 'Pâtes & Pastas', 'pates', 'Pâtes fraîches, spaghettis et spécialités italiennes.', array['restaurant'], true, 50),
  ('salades', 'Salades', 'salades', 'Salades composées et fraîches.', array['restaurant'], true, 60),
  ('desserts', 'Desserts & Sucré', 'desserts', 'Gâteaux, glaces, crêpes et douceurs.', array['restaurant', 'bakery'], true, 70),
  ('boissons-eaux', 'Boissons & Eaux', 'boissons-eaux', 'Boissons gazeuses, jus frais et eaux minérales.', array['restaurant', 'courses'], true, 80),
  ('epicerie-salee', 'Épicerie salée', 'epicerie-salee', 'Produits d''épicerie salée pour le quotidien.', array['courses'], true, 90),
  ('epicerie-sucree', 'Épicerie sucrée', 'epicerie-sucree', 'Snacks, biscuits et produits sucrés.', array['courses'], true, 100),
  ('boulangerie', 'Boulangerie', 'boulangerie', 'Pains frais, viennoiseries et baguettes.', array['courses', 'bakery'], true, 110),
  ('produits-laitiers', 'Produits Laitiers', 'produits-laitiers', 'Lait, fromages, yaourts et beurres.', array['courses'], true, 120),
  ('fruits-legumes', 'Fruits & Légumes', 'fruits-legumes', 'Fruits et légumes frais du marché.', array['courses'], true, 130),
  ('hygiene-beaute', 'Hygiène & Beauté', 'hygiene-beaute', 'Soins personnels, savons et hygiène.', array['courses', 'pharmacy'], true, 140)
on conflict (id) do update set
  name = excluded.name,
  activity_types = excluded.activity_types;

-- Liaison des 48 produits existants avec les category_id correspondants
update public.products set category_id = 'pizzas' where category = 'Pizzas' and category_id is null;
update public.products set category_id = 'burgers' where category = 'Burgers' and category_id is null;
update public.products set category_id = 'sandwichs-makloub' where category = 'Sandwichs & Makloub' and category_id is null;
update public.products set category_id = 'plats-tunisiens' where category = 'Plats Tunisiens & Grillades' and category_id is null;
update public.products set category_id = 'boissons-eaux' where category = 'Boissons & Eaux' and category_id is null;
update public.products set category_id = 'epicerie-salee' where category = 'Épicerie salée' and category_id is null;
update public.products set category_id = 'epicerie-sucree' where category = 'Épicerie sucrée' and category_id is null;
update public.products set category_id = 'boulangerie' where category = 'Boulangerie' and category_id is null;
update public.products set category_id = 'produits-laitiers' where category = 'Produits Laitiers' and category_id is null;
update public.products set category_id = 'fruits-legumes' where category = 'Fruits & Légumes' and category_id is null;
update public.products set category_id = 'hygiene-beaute' where category = 'Hygiène & Beauté' and category_id is null;

-- Assigner automatiquement aux restaurants existants les catégories de leurs produits actuels
insert into public.business_categories (id, business_id, category_id, is_active, sort_order)
select distinct
  p.business_id || '_' || p.category_id as id,
  p.business_id,
  p.category_id,
  true,
  0
from public.products p
where p.category_id is not null
on conflict (business_id, category_id) do nothing;

-- 5. Permissions PostgREST & Politiques RLS
grant select on public.categories to anon, authenticated;
grant all on public.categories to authenticated, service_role;

grant select on public.business_categories to anon, authenticated;
grant all on public.business_categories to authenticated, service_role;

alter table public.categories enable row level security;
alter table public.business_categories enable row level security;

-- Politiques RLS pour categories
drop policy if exists "Categories viewable in catalog" on public.categories;
create policy "Categories viewable in catalog"
  on public.categories
  for select to anon, authenticated
  using (true);

drop policy if exists "Admins manage categories insert" on public.categories;
create policy "Admins manage categories insert"
  on public.categories
  for insert to authenticated
  with check (
    auth.role() = 'service_role'
    or public.redgo_is_admin()
  );

drop policy if exists "Admins manage categories update" on public.categories;
create policy "Admins manage categories update"
  on public.categories
  for update to authenticated
  using (
    auth.role() = 'service_role'
    or public.redgo_is_admin()
  )
  with check (
    auth.role() = 'service_role'
    or public.redgo_is_admin()
  );

drop policy if exists "Admins manage categories delete" on public.categories;
create policy "Admins manage categories delete"
  on public.categories
  for delete to authenticated
  using (
    auth.role() = 'service_role'
    or public.redgo_is_admin()
  );

-- Politiques RLS pour business_categories
drop policy if exists "Business categories viewable in catalog" on public.business_categories;
create policy "Business categories viewable in catalog"
  on public.business_categories
  for select to anon, authenticated
  using (true);

drop policy if exists "Admins manage business_categories insert" on public.business_categories;
create policy "Admins manage business_categories insert"
  on public.business_categories
  for insert to authenticated
  with check (
    auth.role() = 'service_role'
    or public.redgo_is_admin()
  );

drop policy if exists "Admins manage business_categories update" on public.business_categories;
create policy "Admins manage business_categories update"
  on public.business_categories
  for update to authenticated
  using (
    auth.role() = 'service_role'
    or public.redgo_is_admin()
  )
  with check (
    auth.role() = 'service_role'
    or public.redgo_is_admin()
  );

drop policy if exists "Admins manage business_categories delete" on public.business_categories;
create policy "Admins manage business_categories delete"
  on public.business_categories
  for delete to authenticated
  using (
    auth.role() = 'service_role'
    or public.redgo_is_admin()
  );
