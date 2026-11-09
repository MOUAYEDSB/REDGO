# API

Frontend applications must use approved Supabase APIs, client libraries, Realtime subscriptions, Storage APIs, and Edge Functions. Privileged business logic belongs in Edge Functions and must not be duplicated in frontend applications.

No concrete REST or business Edge Function contracts are defined in Phase 0.

## Delivery location tracking

Realtime table: `public.delivery_driver_locations` (see the migration and RLS
rules in [DATABASE.md](./DATABASE.md)).

The driver app updates its assigned row every five seconds while the app is in
the foreground and the device reports movement. The customer app listens only
to the row for its delivery. Both apps use `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_ANON_KEY`; the service-role key must never be shipped in
either app.

The trusted assignment backend must create the row before tracking starts.
Authentication and order assignment are not implemented yet, so realtime
tracking remains unavailable until those are configured.

Road geometry is requested from the public OSRM routing service and refreshed
after meaningful driver movement. It is an approximate road route, not a
turn-by-turn scooter navigation guarantee. If routing fails, no straight-line
route is shown. Coordinates are sent to the public OSRM endpoint to calculate
the route; production should use a reviewed or self-hosted routing provider.
