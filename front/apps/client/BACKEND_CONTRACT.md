# Backend integration contract

The mobile app currently starts in unauthenticated preview mode. Its catalog and order flows still contain local/demo data and fallback behavior; they are not connected to the REDGO database.

The Supabase schema and RPC contract are being established in `back/supabase/` and `back/docs/mobile-api-contract.md`. Use those contracts rather than inventing REST endpoints.

## Planned integration

- Supabase Auth for email/phone registration, OTP and sessions.
- Read active `businesses`, `products` and `product_options` under catalog RLS.
- `place_delivery_order` for server-priced, transactional cash orders.
- `create_scooter_ride` for rides priced using the active server-configured tariff.
- `list_open_driver_missions`, `accept_driver_mission` and `update_driver_mission_status` for authorized driver workflows.
- RLS-scoped reads for customer orders, assigned missions, profile and notifications.
- Realtime for order/ride status after policies and subscriptions are verified. Live GPS is not ready: the existing delivery location table lacks an authorized initialization path for UUID orders, and scooter-ride tracking has no backend model yet.

## Security requirements

- Never send product prices or fares as authoritative values from the app.
- Never include a Supabase service-role key in the mobile app or public frontend.
- Do not connect real checkout until the API fallback-to-local behavior is removed and server persistence is confirmed.
- Driver approval and admin claims must be granted by trusted backend/admin operations, never user-editable metadata.
