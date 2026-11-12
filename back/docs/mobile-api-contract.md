# Mobile-to-backend contract

The mobile app and admin console call Supabase using authenticated user sessions and the public publishable key (legacy anon keys are also supported). Never put a secret/service-role key in either frontend. Database RPCs and RLS enforce authorization; a migration file existing in the repository does not mean it has been applied to any database.

## Email authentication and driver application

The Expo client uses Supabase Auth directly; there is no separate Node authentication API for client calls. Login uses `auth.signInWithPassword({ email, password })`. Registration uses `auth.signUp({ email, password, options: { data } })`; `full_name`, the normalized Tunisian phone number, and the requested `client` or `driver` space are metadata. The phone number is profile/contact information, not an authentication factor. Supabase Auth generates and verifies the six-digit signup OTP with `auth.verifyOtp({ email, token, type: 'signup' })`; configure the same OTP length in the target Supabase project's Auth settings. Resending uses `auth.resend({ type: 'signup', email })`. The Node/Nodemailer service described in `back/README.md` only delivers the signed Send Email Hook payload using the configured SMTP provider.

Password recovery calls `auth.resetPasswordForEmail(email)`, verifies the recovery OTP using `auth.verifyOtp({ email, token, type: 'recovery' })`, updates the password with `auth.updateUser({ password })`, then signs out. Supabase Auth continues to generate and verify this code; Nodemailer delivers it through the configured Auth hook.

When using the Nodemailer Send Email Hook, the HTML email templates live in the Node service. Configure the hook URL and its signing secret in Supabase Dashboard → Authentication → Hooks → Send Email Hook. The hook must be deployed to a public HTTPS endpoint. When the hook is disabled, Supabase's SMTP email templates apply instead; in that mode, replace the **Confirm signup** template body with a message containing the numeric code, for example:

```html
<h2>Confirmez votre adresse e-mail REDGO</h2>
<p>Votre code de vérification est : <strong>{{ .Token }}</strong></p>
<p>Ce code est à usage unique. Ne le partagez avec personne.</p>
```

Do not include `{{ .ConfirmationURL }}` or `{{ .SiteURL }}` in that template when the desired flow is code entry only. Apply the same approach to the **Reset Password** template if recovery should also use the configured OTP length. Save the templates and send a fresh test email; already-sent messages keep their old content.

The Expo client uses `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; no service-role key belongs in either frontend. The additive migration `20261111150000_redgo_email_auth_profiles.sql` backfills `profiles.email` and signup phone metadata. Apply and verify it in the target database before testing; a migration file existing in the repository does not mean it is applied.

Driver registration continues to the authenticated onboarding screen after email verification. The applicant enters a scooter brand, captures a profile photo and scooter photo, and uploads them to the private `redgo-driver-documents` bucket under their own user-id folder. The client then calls:

| RPC | Arguments | Result and authorization |
|---|---|---|
| `save_driver_application_profile` | `scooter_brand`, `profile_photo_path`, `scooter_photo_path` | Authenticated owner only. Verifies both uploaded private objects at the caller's fixed paths, then saves the references. |
| `submit_driver_application` | none | Authenticated applicant only. Creates a pending application; it does not grant driver access. |
| `review_driver_application` | `application_user_id`, `decision`, optional `note` | Trusted administrator only. Decisions are `approved`, `rejected`, or `suspended`; rejection requires a reason. Approval is the only operation that grants the driver role. |

The administrator console can review candidate contact details and private photo links and approve or reject pending applications. Storage is private; only the applicant and a trusted administrator may read the uploaded documents. Phone numbers are normalized to E.164 (`+216...` for Tunisian local numbers).

## Catalog and mission creation

Read active `businesses`, `products` and `product_options` through the authenticated or anonymous Supabase client. Prices are integer millimes. Never trust a client-supplied price when creating an order.

### Create a delivery order

Call `place_delivery_order` with:

```ts
{
  cart_items: Array<{
    product_id: string;
    quantity: number;
    option_ids?: string[];
    notes?: string;
  }>;
  destination_address: string;
  destination_instructions: string;
  recipient_phone: string;
  destination_latitude: number;
  destination_longitude: number;
}
```

The returned UUID is `delivery_orders.id`. Fetch the order and its item snapshots/stops with authenticated queries; RLS restricts them to participants.

### Create a Scooter Taxi ride

Call `create_scooter_ride` with pickup and destination addresses and coordinates. The database validates service-area coverage and takes the fare from the active `scooter_tariffs` row. Any fare shown before creation is indicative only; display the returned `fare_millimes` as the official amount. No active tariff means ride creation is rejected.

## Cash QR payment

`20261111140000_redgo_cash_qr_payments.sql` adds the cash ledger and RPCs. Apply and verify this migration in the target database before enabling this flow. The ledger snapshots the delivery total or Scooter Taxi fare from the database, uses one payment per driver mission, and supports `pending`, `paid` and `cancelled` states. Cash is the only supported method.

### Customer operations

| RPC | Arguments | Result and authorization |
|---|---|---|
| `get_cash_payment_status` | `target_type: 'delivery' \| 'scooter_ride'`, `target_id: uuid` | Returns official `amount_millimes`, `payment_status`, `expires_at`, `paid_at`, and `ready_for_payment`. Available only to the mission customer, assigned driver, or admin. |
| `issue_cash_payment_qr` | `target_type`, `target_id` | Customer-only. Returns `token`, authoritative `amount_millimes`, `expires_at`, `payment_status`. The assigned mission must have reached its destination and remain active. |

The QR contains only the opaque random token (64 lowercase hexadecimal characters). Keep it in memory only; do not log, persist, or add mission IDs, personal data or amounts to it. Only a SHA-256 digest is stored in PostgreSQL. It expires after two minutes. Calling `issue_cash_payment_qr` again invalidates the previous token.

### Driver operations

| RPC | Arguments | Result and authorization |
|---|---|---|
| `mark_mission_ready_for_cash` | `target_mission_id: uuid` (driver mission ID) | Assigned driver only. Moves an in-progress delivery from `on_the_way` to `delivered`, or ride from `ride_started` to `ride_completed`; the driver mission remains active. |
| `validate_cash_payment_qr` | `scanned_token: string` | Assigned driver only. Returns mission type/reference and official amount after checking token, expiry, assignment, mission and payment state. Does not settle or complete anything. |
| `confirm_cash_payment` | `scanned_token: string` | Assigned driver only. Call only after physically receiving the displayed amount. Atomically records payment, collector and time, completes the mission and updates the service status. Repeating the same confirmation returns the existing receipt without repeating side effects. |
| `get_my_active_driver_mission` | none | Approved driver only. Returns the active mission and official cash amount/status. |

Never mark a mission complete locally after scanning. The app must wait for `confirm_cash_payment` to return `payment_status: 'paid'`. The database transaction preserves the driver’s online and service-availability settings.

RPC failures include unauthenticated/unauthorized access, wrong customer or driver, invalid/replaced/expired QR, non-ready mission and unavailable/already-paid payment. Surface the backend error and allow an explicit retry; do not show a success state after a failed or offline request.

## Driver operations

- The authenticated driver may update their own `driver_profiles` availability.
- `list_open_driver_missions()` returns limited mission summaries to an approved online driver.
- `accept_driver_mission(target_mission_id)` claims one mission atomically.
- `update_driver_mission_status(target_mission_id, next_status)` supports the normal pre-collection transitions; direct `completed` is rejected. Cash confirmation is the only completion path.
- The legacy `delivery_driver_locations` table is not ready for new UUID delivery orders: no authorized row-creation/write RPC is provided, and Scooter Taxi GPS is not modeled. Live tracking is not connected by this contract.

## Admin payment ledger

The admin console authenticates with Supabase Auth and calls `list_admin_cash_payments()` using the user's session. The RPC requires the trusted `app_metadata.role = 'admin'` claim and returns mission type/reference, customer, assigned and collecting driver, amount, cash method, status, creation time and paid time. An authenticated non-admin must be denied. Do not expose service-role credentials or query around this RPC's authorization.

The same console lists `driver_applications`, joins the applicants' `profiles` and `driver_profiles`, creates short-lived signed URLs for the private photos, and calls `review_driver_application`. The database RPC and RLS enforce administrator authorization; the browser never receives a service-role key.

Configure the admin app with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The Expo mobile app uses `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The old `*_ANON_KEY` names remain supported as a migration fallback.

## Validation and release checklist

- Run the pgTAP tests in `back/supabase/tests/cash_qr_payments.test.sql` against a local Supabase database after applying all migrations.
- Run `back/supabase/tests/email_driver_auth.test.sql` to verify the profile columns, private document bucket, RLS policies and RPC privileges.
- On a device, test email signup/OTP, login, password recovery, camera-denied behavior, both driver photo uploads and admin review before approving a driver.
- Cover both delivery and Scooter Taxi; correct and incorrect participants; expiry and renewal; scan without settlement; repeated confirmation; authoritative server amount; atomic service/mission/payment state; and availability preservation.
- Exercise the scanner with camera permission denied, invalid/expired/replaced QR, network failure and an already-paid QR.
- Verify confirmation races against PostgreSQL using two independent authenticated sessions before production release.
- Apply and verify the migration in each target database; this repository cannot confirm remote migration state.

Remaining backend integration work includes idempotency keys for order/ride creation, verified production catalog/tariff/service-area configuration, cancellation/decline workflows, authorized GPS update paths and realtime notifications. No client-side fallback should report a backend mission or payment as successful.
