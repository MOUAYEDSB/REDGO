# Database

PostgreSQL is the system of record. Database changes belong in `back/supabase/migrations`. No REDGO business tables are created in Phase 0.

Access control must be enforced with PostgreSQL Row Level Security. Privileged operations must be implemented in Edge Functions and must not depend on exposing a service-role key to clients.

## Live driver locations

The `delivery_driver_locations` table is created by the migration
`back/supabase/migrations/20261109000000_driver_live_locations.sql`.
Only authenticated customers associated with a delivery and its assigned
driver can read that row. An assigned driver can update only its GPS columns;
clients cannot insert or change assignments.

The trusted order-assignment backend must create the row with the delivery
identifier, authenticated driver UUID, and authenticated customer UUID before
the driver starts sharing. This repository does not yet include that
assignment endpoint or the customer/driver authentication flows.
