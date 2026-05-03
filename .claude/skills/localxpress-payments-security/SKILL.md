---
name: localxpress-payments-security
description: Security rules for Stripe, Google Maps, email notifications and public endpoints in LocalXpress.
---

# LocalXpress Payments and Security Skill

Use this skill for Stripe, Google Maps, email and security-sensitive backend work.

## Stripe rules

- Use Stripe Checkout.
- STRIPE_SECRET_KEY must only be used in backend.
- Frontend receives only checkout_url.
- Webhook must verify STRIPE_WEBHOOK_SECRET.
- Paid order is created only after checkout.session.completed.
- Duplicate webhooks must not create duplicate orders.

## Google Maps rules

- GOOGLE_MAPS_API_KEY must only be used in backend.
- Do not expose backend Google key in frontend.
- Backend calculates trusted distance.
- Frontend can send addresses only.

## Email rules

- SMTP credentials must only be used in backend.
- Send admin and customer emails only after payment confirmation.
- If email fails, do not undo the paid order.

## Public endpoint rules

- Validate with Zod.
- Rate limit quote and checkout endpoints.
- Do not trust frontend price.
- Do not log secrets.
- Do not connect to production PostgreSQL in this phase.
