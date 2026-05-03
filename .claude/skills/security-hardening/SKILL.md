---
name: security-hardening
description: Harden the LocalXpress APP-IND backend before production by improving headers, CORS, validation, rate limits, logging and data exposure.
---

# Security Hardening Skill

Use this skill when improving security of the LocalXpress public orders app.

## Project context

This app has:
- React/Vite frontend
- Express backend
- Google Routes API
- Stripe Checkout + webhook
- Resend emails
- Local JSON storage for temporary paid orders
- Future integration with central LocalXpress backend

## Critical restrictions

Do not break the existing flow:
quote → checkout → Stripe webhook → order_code → orders.json → emails → success

Do not connect PostgreSQL unless explicitly asked.
Do not call production LocalXpress central API unless already configured.
Do not expose secrets in frontend.
Do not remove Stripe webhook signature verification.
Do not create orders before Stripe confirms payment.

## Security goals

Implement:
- Helmet security headers
- explicit body size limits
- strict CORS allowlist
- Zod max length validation
- specific rate limits
- safe error handling
- safe logging without PII
- reduced exposure in order-status
- production-safe config checks

## Must protect

Secrets:
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- GOOGLE_MAPS_API_KEY
- RESEND_API_KEY
- LOCALXPRESS_CENTRAL_API_KEY

PII:
- customer_email
- client_name
- client_phone
- pickup_address
- delivery_address

## Validation rules

Apply max lengths:
- pickup_address: max 500
- delivery_address: max 500
- client_name: max 100
- client_phone: max 20
- customer_email: max 254
- scheduled_date: reasonable date string
- scheduled_time: max 50
- package_size: enum only
- client_notes: max 1000

## Rate limits

Recommended:
- general: 100 requests / 15 min
- quote: 30 requests / min
- checkout: 10 requests / min
- order-status: 20 requests / min
- webhook: no aggressive limiter, rely on Stripe signature

## Logging

No PII logs in production.
Debug logs with PII only allowed behind:
LOG_LEVEL=debug

## Required validation

After changes:
- npm run typecheck:backend
- npm run build
- manual endpoint tests
