# Backend integration contract

The customer frontend contains ready-to-configure integrations but does not assume undocumented backend endpoints.

## Required API areas

- `POST /auth/login`
- `POST /auth/register`
- `POST /auth/otp/verify`
- `POST /bookings`
- `GET /rides`
- `GET /rides/:id`
- `GET /notifications`
- `GET/PATCH /profile`

Frontend authentication and profile flows currently use local mock state. Map, estimates, ride search, driver assignment, and Socket.IO tracking must be connected only after the corresponding backend contracts are available.
