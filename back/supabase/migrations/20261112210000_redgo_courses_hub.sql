-- Établissement officiel REDGO pour les Courses & Épicerie directe
-- Toutes les courses passent par cet établissement système géré par REDGO.
insert into public.businesses (
  id,
  kind,
  name,
  description,
  phone,
  address,
  latitude,
  longitude,
  cover_image_url,
  is_active
)
values (
  'courses_hub_msaken',
  'courses',
  'Courses REDGO',
  'Service officiel de courses express et d’essentiels REDGO à M’Saken et Messaadine.',
  '+216 73 000 000',
  'M’Saken, Sousse, Tunisie',
  35.7273,
  10.5815,
  'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800',
  true
)
on conflict (id) do update
set kind = 'courses',
    name = excluded.name,
    description = excluded.description,
    is_active = true;

