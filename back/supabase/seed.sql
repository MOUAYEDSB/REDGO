-- Local/demo catalog only. Do not use these fictional business details as production data.
insert into public.businesses (id, kind, name, description, address, is_active)
values
  ('courses_hub_msaken', 'courses', 'Courses REDGO', 'Catalogue de démonstration REDGO.', 'Route de Messaadine, M''Saken', true),
  ('karma', 'restaurant', 'Karma Kitchen', 'Restaurant de démonstration.', 'Adresse à configurer', true),
  ('traditional', 'restaurant', 'Saveurs de M''Saken', 'Restaurant de démonstration.', 'Adresse à configurer', true)
on conflict (id) do update set
  kind = excluded.kind,
  name = excluded.name,
  description = excluded.description,
  address = excluded.address,
  is_active = excluded.is_active;

insert into public.products (
  id, business_id, name, description, category, price_millimes, image_url, max_quantity, is_available, sort_order
)
values
  ('eau-minerale-pack', 'courses_hub_msaken', 'Pack Eau Minérale Safia (6x1.5L)', 'Pack de 6 bouteilles de 1,5 litre.', 'Boissons', 5200, 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=900', 30, true, 1),
  ('lait-demi-ecreme', 'courses_hub_msaken', 'Lait Vitalait Demi-Écrémé 1L', 'Brique de lait demi-écrémé.', 'Épicerie', 1450, 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=900', 30, true, 2),
  ('doliprane-1000', 'courses_hub_msaken', 'Paracétamol 1000mg (Boîte)', 'Produit de démonstration; vérifier les règles locales avant mise en production.', 'Pharmacie', 3800, 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=900', 10, true, 3),
  ('gel-douche', 'courses_hub_msaken', 'Gel Douche Hydratant 400ml', 'Flacon de gel douche.', 'Hygiène', 7900, 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=900', 30, true, 4),
  ('huile-olive-bio', 'courses_hub_msaken', 'Huile d’Olive Extra Vierge de M''Saken', 'Bouteille d’huile d’olive.', 'Produits locaux', 18500, 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=900', 30, true, 5),
  ('lessive-liquide', 'courses_hub_msaken', 'Lessive Liquide Concentrée', 'Bidon de lessive liquide.', 'Hygiène', 12500, 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=900', 30, true, 6),
  ('margherita', 'karma', 'Pizza Margherita Di Bufala', 'Sauce tomate, mozzarella et basilic.', 'Pizzas', 14500, 'https://images.unsplash.com/photo-1547592180-85f173990554?w=900', 20, true, 1),
  ('burger-special', 'karma', 'Smash Burger REDGO', 'Burger de démonstration.', 'Burgers', 16800, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=900', 20, true, 2),
  ('pasta-carbonara', 'karma', 'Pâtes Carbonara Traditionnelles', 'Pâtes de démonstration.', 'Pâtes', 18500, 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=900', 20, true, 3),
  ('couscous-agneau', 'traditional', 'Couscous à l’Agneau de M''Saken', 'Couscous de démonstration.', 'Tunisien', 19500, 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=900', 20, true, 1),
  ('ojja-merguez', 'traditional', 'Ojja Traditionnelle aux Merguez', 'Ojja de démonstration.', 'Tunisien', 13500, 'https://images.unsplash.com/photo-1590577976322-3d2d6e2130d5?w=900', 20, true, 2)
on conflict (id) do update set
  business_id = excluded.business_id,
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  price_millimes = excluded.price_millimes,
  image_url = excluded.image_url,
  max_quantity = excluded.max_quantity,
  is_available = excluded.is_available,
  sort_order = excluded.sort_order;

insert into public.product_options (id, product_id, name, price_millimes, is_available, sort_order)
select option_data.id, product.id, option_data.name, option_data.price_millimes, true, option_data.sort_order
from public.products product
cross join (values
  ('opt_extra_cheese', 'Supplément mozzarella', 2000, 1),
  ('opt_harissa', 'Harissa artisanale', 500, 2),
  ('opt_olives', 'Olives noires', 1000, 3)
) as option_data(id, name, price_millimes, sort_order)
where product.id in ('margherita', 'burger-special', 'pasta-carbonara', 'couscous-agneau', 'ojja-merguez')
on conflict (product_id, id) do update set
  name = excluded.name,
  price_millimes = excluded.price_millimes,
  is_available = excluded.is_available,
  sort_order = excluded.sort_order;
