# Database

PostgreSQL is the system of record. Database changes belong in `back/supabase/migrations`. No REDGO business tables are created in Phase 0.

Access control must be enforced with PostgreSQL Row Level Security. Privileged operations must be implemented in Edge Functions and must not depend on exposing a service-role key to clients.
