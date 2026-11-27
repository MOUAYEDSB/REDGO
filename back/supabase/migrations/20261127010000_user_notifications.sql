-- Necessary real-time notifications for Client & Driver events

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role text not null check (role in ('client', 'driver')),
  category text not null check (category in ('order', 'ride', 'mission', 'payment', 'review')),
  title text not null,
  body text not null,
  target_route text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists user_notifications_user_created_idx
  on public.user_notifications (user_id, created_at desc);

alter table public.user_notifications enable row level security;

grant select, update (is_read) on public.user_notifications to authenticated;

drop policy if exists "Users read their own notifications" on public.user_notifications;
create policy "Users read their own notifications"
  on public.user_notifications for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users mark their own notifications read" on public.user_notifications;
create policy "Users mark their own notifications read"
  on public.user_notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 1. Delivery orders status notifications (Client + Driver if cancelled after assignment)
create or replace function public.notify_on_delivery_order_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_body text;
begin
  if old.driver_id is null and new.driver_id is not null then
    insert into public.user_notifications (user_id, role, category, title, body, target_route)
    values (
      new.customer_id,
      'client',
      'order',
      'Livreur assigné',
      format('Un livreur a pris en charge votre commande #%s.', new.reference),
      format('/order/%s', new.id)
    );
  end if;

  if old.status is distinct from new.status then
    if new.status in ('picked_up', 'in_transit', 'en_route') then
      v_title := 'Commande en route';
      v_body := format('Votre commande #%s est en cours de livraison.', new.reference);
    elsif new.status = 'delivered' then
      v_title := 'Commande livrée';
      v_body := format('Votre commande #%s est arrivée ! Vous pouvez noter le livreur.', new.reference);
    elsif new.status = 'cash_collected' then
      v_title := 'Paiement confirmé';
      v_body := format('Paiement en espèces confirmé pour la commande #%s.', new.reference);
    elsif new.status = 'cancelled' then
      v_title := 'Commande annulée';
      v_body := format('Votre commande #%s a été annulée.', new.reference);
      if new.driver_id is not null then
        insert into public.user_notifications (user_id, role, category, title, body, target_route)
        values (
          new.driver_id,
          'driver',
          'mission',
          'Commande annulée',
          format('La commande #%s a été annulée par le client.', new.reference),
          '/driver/home'
        );
      end if;
    end if;

    if v_title is not null then
      insert into public.user_notifications (user_id, role, category, title, body, target_route)
      values (
        new.customer_id,
        'client',
        'order',
        v_title,
        v_body,
        format('/order/%s', new.id)
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_delivery_order_change on public.delivery_orders;
create trigger trg_notify_delivery_order_change
  after update of status, driver_id on public.delivery_orders
  for each row execute function public.notify_on_delivery_order_change();

-- 2. Scooter rides status notifications (Client + Driver if cancelled)
create or replace function public.notify_on_scooter_ride_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_body text;
begin
  if old.driver_id is null and new.driver_id is not null then
    insert into public.user_notifications (user_id, role, category, title, body, target_route)
    values (
      new.customer_id,
      'client',
      'ride',
      'Chauffeur en route',
      format('Un chauffeur a accepté votre course #%s.', new.reference),
      format('/ride/tracking/%s', new.id)
    );
  end if;

  if old.status is distinct from new.status then
    if new.status = 'arrived_at_pickup' then
      v_title := 'Chauffeur arrivé';
      v_body := format('Votre chauffeur est arrivé au point de départ (#%s).', new.reference);
    elsif new.status = 'ride_started' then
      v_title := 'Course démarrée';
      v_body := format('Votre trajet #%s est en cours.', new.reference);
    elsif new.status = 'ride_completed' then
      v_title := 'Course terminée';
      v_body := format('Votre course #%s est terminée. Merci d''avoir choisi REDGO !', new.reference);
    elsif new.status = 'cancelled' then
      v_title := 'Course annulée';
      v_body := format('Votre course #%s a été annulée.', new.reference);
      if new.driver_id is not null then
        insert into public.user_notifications (user_id, role, category, title, body, target_route)
        values (
          new.driver_id,
          'driver',
          'mission',
          'Course annulée',
          format('La course #%s a été annulée par le client.', new.reference),
          '/driver/home'
        );
      end if;
    end if;

    if v_title is not null then
      insert into public.user_notifications (user_id, role, category, title, body, target_route)
      values (
        new.customer_id,
        'client',
        'ride',
        v_title,
        v_body,
        format('/ride/tracking/%s', new.id)
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_scooter_ride_change on public.scooter_rides;
create trigger trg_notify_scooter_ride_change
  after update of status, driver_id on public.scooter_rides
  for each row execute function public.notify_on_scooter_ride_change();

-- 3. New open mission -> notify online drivers
create or replace function public.notify_drivers_on_new_mission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'searching' and new.driver_id is null then
    insert into public.user_notifications (user_id, role, category, title, body, target_route)
    select
      d.user_id,
      'driver',
      'mission',
      case when new.mission_type = 'delivery' then 'Nouvelle livraison disponible' else 'Nouvelle course scooter' end,
      'Une nouvelle mission est prête dans votre zone M''Saken / Messaadine.',
      '/driver/home'
    from public.driver_profiles d
    where d.is_online = true
      and (
        (new.mission_type = 'delivery' and d.deliveries_enabled = true)
        or
        (new.mission_type = 'scooter_ride' and d.scooter_taxi_enabled = true)
      );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_drivers_new_mission on public.driver_missions;
create trigger trg_notify_drivers_new_mission
  after insert on public.driver_missions
  for each row execute function public.notify_drivers_on_new_mission();

-- 4. New review -> notify driver
create or replace function public.notify_driver_on_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_notifications (user_id, role, category, title, body, target_route)
  values (
    new.driver_id,
    'driver',
    'review',
    format('Nouvel avis : %s ★', new.rating),
    case when length(trim(new.comment)) > 0 then format('« %s »', left(new.comment, 120)) else 'Un client vient de noter votre service.' end,
    '/driver/home'
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_driver_review on public.driver_reviews;
create trigger trg_notify_driver_review
  after insert on public.driver_reviews
  for each row execute function public.notify_driver_on_review();

notify pgrst, 'reload schema';
