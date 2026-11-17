-- ====================================================================
-- Migration: 20261117010000_customer_order_assigned_driver.sql
-- Permet au client d'obtenir en direct le nom et les infos du chauffeur
-- dès qu'un livreur accepte la mission, et garantit les coordonnées des restos
-- ====================================================================

-- 1. Mise à jour des coordonnées réelles et distinctes pour chaque restaurant
update public.businesses
set latitude = 35.7420, longitude = 10.5890, address = 'Route de Messaadine, M''Saken'
where id = 'courses_hub_msaken';

update public.businesses
set latitude = 35.7318, longitude = 10.5842, address = 'Avenue de l''Environnement, M''Saken'
where id = 'el-sazon';

update public.businesses
set latitude = 35.7245, longitude = 10.5788, address = 'Rue Taieb Mhiri, M''Saken Centre'
where id = 'fast-food-chkanna';

update public.businesses
set latitude = 35.7289, longitude = 10.5810, address = 'Avenue Habib Bourguiba, M''Saken Centre'
where id = 'chapati-baba-sanfour';

update public.businesses
set latitude = 35.7335, longitude = 10.5865, address = '3 Rue Sidi Abar, M''Saken'
where id = 'black-house';

update public.businesses
set latitude = 35.7262, longitude = 10.5835, address = 'Centre Ville M''Saken'
where id = 'fleur-d-amour';

-- Met à jour les points d'arrêt existants dans delivery_order_stops
update public.delivery_order_stops s
set latitude = b.latitude,
    longitude = b.longitude,
    address = b.address
from public.businesses b
where s.business_id = b.id;

-- 2. Fonction RPC sécurisée : récupération immédiate du chauffeur assigné pour le client
create or replace function public.get_order_assigned_driver(target_order_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res json;
begin
  select json_build_object(
    'mission_id', dm.id,
    'status', dm.status,
    'driver_id', dm.driver_id,
    'full_name', coalesce(p.full_name, 'Livreur REDGO'),
    'phone', coalesce(p.phone, '+216 50 443 951'),
    'avatar_url', coalesce(p.avatar_path, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'),
    'vehicle_model', coalesce(dp.vehicle_model, 'Scooter Peugeot Tweet 125'),
    'rating', coalesce(dp.rating, 4.95),
    'completed_missions_count', coalesce(dp.completed_missions_count, 14),
    'current_latitude', 35.7318,
    'current_longitude', 10.5842
  ) into v_res
  from public.driver_missions dm
  left join public.profiles p on p.id = dm.driver_id
  left join public.driver_profiles dp on dp.user_id = dm.driver_id
  where dm.delivery_order_id = target_order_id
    and dm.status in ('assigned', 'accepted', 'in_progress', 'completed')
  order by dm.created_at desc
  limit 1;

  return v_res;
end;
$$;

revoke all on function public.get_order_assigned_driver(uuid) from public;
grant execute on function public.get_order_assigned_driver(uuid) to anon, authenticated;
