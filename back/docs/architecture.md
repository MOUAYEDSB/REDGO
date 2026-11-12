# Backend architecture

## Request path

1. The mobile app authenticates with Supabase Auth.
2. Read-only catalog requests use the Supabase client and public catalog RLS.
3. User-owned records are read with authenticated queries and RLS.
4. Order creation, ride creation and mission transitions use PostgreSQL RPCs. These functions validate inputs, recalculate authoritative values and commit atomically.
5. Third-party integrations or operations requiring secrets belong in Supabase Edge Functions, never in the mobile bundle.

## Data domains

- **Identity:** `profiles`, `user_roles`, `driver_applications`.
- **Catalog:** `businesses`, `products`, `product_options`.
- **Delivery:** `delivery_orders`, `delivery_order_items`, `delivery_order_stops`.
- **Scooter Taxi:** `scooter_tariffs`, `scooter_rides`.
- **Driver operations:** `driver_profiles`, `driver_missions`, `delivery_driver_locations`.
- **Messaging:** `notifications`.

Money is stored as integer millimes. The database, not the client cart, determines product/option prices and delivery/service fees. The initial delivery fee follows the current front rule: 2,500 millimes for the first pickup, 1,000 per additional pickup, and a 500 millime service fee.

The scooter fare is deliberately configurable and has no production default: the current front displays conflicting fixed prices on different ride screens. Add exactly one active `scooter_tariffs` row only after the fare policy is agreed.

## Authorization

- Client-owned delivery orders and rides are visible only to their customer, the assigned driver, and an admin.
- Drivers see open mission summaries only through `list_open_driver_missions`; customer phone numbers and delivery instructions are not returned in that list.
- A driver can hold at most one assigned, accepted or in-progress mission; a partial unique index enforces this across deliveries and rides.
- Mission acceptance locks the mission row, preventing two drivers from claiming the same mission.
- Catalog administration and admin reads require the server-controlled JWT claim `app_metadata.role = admin`. Never set this claim from user-editable metadata.
- Direct client inserts/updates to orders, rides and missions are denied. Use the RPCs.
- Live GPS is not part of this initial domain migration: the legacy delivery location table has no authorized initialization path for UUID orders, and scooter-ride tracking still needs a model and policies.

## Initial local catalog

`supabase/seed.sql` provides a small local demo catalog using the IDs and sample prices currently present in the mobile UI. Businesses, addresses, images and products are examples, not verified production data. Do not copy the seed catalog to production.
