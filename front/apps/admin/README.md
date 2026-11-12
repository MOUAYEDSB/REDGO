# REDGO Admin

The admin app provides a Supabase-authenticated console for cash-payment review, driver applications, and catalog management. The user must have the trusted `app_metadata.role = 'admin'` claim; PostgreSQL RLS and the `list_admin_cash_payments()` RPC enforce authorization.

Configure `.env.local` with the public Supabase URL and publishable key:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Never use a service-role key in the browser or commit credentials. Product and option CRUD uses the authenticated Supabase client and the policies in the core-domain migration. Product prices are entered in dinars and stored as integer millimes. Apply the `redgo_product_images` migration before using product photo uploads; the public bucket serves catalog images while upload, update, and delete policies require the admin role.

Run the app from `front`:

```powershell
npm run admin
```

The console includes a payment ledger, driver application review and a product catalog with search, business and visibility filters, product creation/editing, publication controls, product options, and image uploads. Businesses must already exist in `public.businesses` before products can be added.
