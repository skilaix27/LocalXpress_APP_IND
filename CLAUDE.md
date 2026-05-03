# LocalXpress Public Orders App

## Project goal

This is the new public web app for LocalXpress individual customer orders.

The frontend already exists and has a form. The goal now is to evolve it into a working paid order flow.

## Current phase

Build the app with:

- Existing React + Vite + TypeScript frontend
- New Node.js + Express backend
- Backend-side Google Maps route calculation
- Backend-side LocalXpress price calculation
- Stripe Checkout
- Stripe webhook confirmation
- Email notification to admin
- Email confirmation to customer

## Critical restrictions

Do NOT integrate with the main LocalXpress PostgreSQL database yet.
Do NOT write to the `stops` table yet.
Do NOT modify the main LocalXpress production database.
Do NOT expose secret keys in frontend.
Do NOT trust frontend price.
Do NOT create a paid order before Stripe webhook confirms payment.

## Deployment goal

The backend should be designed so it can later run on the VPS.

For now it can run locally for testing.

Later it will be deployed behind:

- https://api.localxpress.app or another backend route

The public frontend will eventually call:

- POST /api/public/quote
- POST /api/public/checkout
- GET /api/public/order-status?session_id=...

## Frontend stack

- React
- Vite
- TypeScript
- Tailwind
- shadcn/ui if already present
- React Router if needed

## Backend stack

- Node.js
- Express
- TypeScript
- Zod
- Stripe
- Nodemailer
- Google Maps API
- express-rate-limit
- Local JSON storage for now

## Local storage rule

Until PostgreSQL integration is approved, paid orders must be stored only in a local JSON file:

- backend/data/orders.json

This is temporary. Later it will be replaced by integration with the main LocalXpress backend/database.

## Required customer form fields

The frontend must collect and send:

- pickup_address
- delivery_address
- client_name
- client_phone
- customer_email
- scheduled_date
- scheduled_time
- package_size
- client_notes

## Optional future fields

The architecture should allow later adding:

- pickup_lat
- pickup_lng
- delivery_lat
- delivery_lng
- customer_full_name
- customer_phone
- pickup_contact_name
- pickup_contact_phone

## Package sizes

- small = Pequeño
- medium = Mediano
- large = Grande
- delicate = Delicado

## Pricing zones

Use this pricing table in the backend:

- Zona 1: 0 to 2.5 km = 8 EUR
- Zona 2: >2.5 to 7 km = 11 EUR
- Zona 3: >7 to 15 km = 14 EUR
- Zona 4: >15 to 20 km = 28 EUR
- Zona 5: >20 to 25 km = 38 EUR
- Zona 6: >25 to 35 km = 48 EUR
- Zona 7: >35 to 45 km = 59 EUR
- Zona 8: >45 to 55 km = 68 EUR
- Zona 9: >55 to 65 km = 79 EUR
- Zona 10: >65 to 75 km = 89 EUR
- Zona 11: >75 to 80 km = 105 EUR
- Zona 12: >80 to 100 km = 120 EUR
- Zona 13: >100 to 120 km = 145 EUR

If the distance is above 120 km:

- manual_quote_required = true
- do not allow automatic Stripe checkout
- show manual quote message

## Backend quote endpoint

POST /api/public/quote

Must:

1. Validate input with Zod.
2. Calculate distance using Google Maps API server-side.
3. If GOOGLE_MAPS_API_KEY is missing in development, use a mock fallback distance.
4. Calculate zone and price in backend.
5. Return:

```json
{
  "ok": true,
  "distance_km": 6.5,
  "duration_minutes": 20,
  "zone_name": "Zona 2",
  "price": 11,
  "manual_quote_required": false,
  "distance_source": "google_maps"
}
