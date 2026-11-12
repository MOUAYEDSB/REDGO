# REDGO Admin

The admin app provides a Supabase-authenticated cash-payment ledger. The user must have the trusted `app_metadata.role = 'admin'` claim; the `list_admin_cash_payments()` RPC performs this authorization in PostgreSQL.

Configure `.env.local` with the public Supabase URL and publishable key:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Never use a service-role key in the browser or commit credentials. Apply and verify the cash-payment migration before expecting payment rows.

Run the app from `front`:

```powershell
npm run admin
```

The console currently displays the payment ledger only. Catalog management, driver application review and other admin workflows are not implemented here.
