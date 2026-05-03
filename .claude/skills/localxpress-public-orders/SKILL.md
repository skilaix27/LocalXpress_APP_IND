---
name: localxpress-public-orders
description: Build the LocalXpress public individual orders app with quote, Stripe Checkout, webhook, email notifications and temporary local storage.
---

# LocalXpress Public Orders Skill

Use this skill when working on the public individual orders app.

## Current objective

Develop the working paid order flow:

1. Customer fills existing frontend form.
2. Backend calculates route distance.
3. Backend calculates zone and price.
4. Customer reviews quote.
5. Customer pays with Stripe Checkout.
6. Stripe webhook confirms payment.
7. Backend creates paid order in local JSON storage.
8. Backend sends admin email.
9. Backend sends customer confirmation email.

## Important restrictions

Do not integrate with the main LocalXpress database yet.
Do not write to PostgreSQL.
Do not write to the stops table.
Do not call the production LocalXpress order creation endpoint yet.
Use local JSON storage only for this phase.

## Required endpoints

- POST /api/public/quote
- POST /api/public/checkout
- POST /api/stripe/webhook
- GET /api/public/order-status?session_id=...

## Required frontend behavior

The existing form must be connected to the backend.

When pickup and delivery are entered, the user should be able to calculate quote.

The quote review must show:

- distance_km
- duration_minutes
- zone_name
- price

After quote review, the user can click:

- Pagar ahora

Then frontend calls checkout and redirects to Stripe Checkout URL.

## Pricing

Pricing must always be calculated in backend using the LocalXpress pricing zones from CLAUDE.md.

Frontend must not be the source of truth for price.

## Storage

Use:

- backend/data/orders.json

Paid orders must only be created after Stripe webhook confirms payment.
