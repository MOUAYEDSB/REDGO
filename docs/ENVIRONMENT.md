# Environment

Use local environment files for machine-specific values. Never commit secrets.

The backend template is `back/.env.example`. Frontend environment variables should use framework-specific public prefixes only for values safe to expose. The Supabase service-role key is server-only and must never be placed in client configuration.
