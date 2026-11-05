# REDGO Backend

REDGO uses Supabase as its primary backend platform:

- PostgreSQL for persistence.
- Supabase Auth for identity.
- Supabase Realtime for live updates and driver locations.
- Supabase Storage for images and receipts.
- Supabase Edge Functions for privileged operations.
- PostgreSQL RLS for authorization.

## Local setup

1. Install the Supabase CLI.
2. Copy `.env.example` to `.env.local`.
3. Run `supabase start`.

Phase 0 contains no business database tables or Edge Function implementations.
