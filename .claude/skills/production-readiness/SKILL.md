---
name: production-readiness
description: Prepare LocalXpress APP-IND for VPS production deployment with secure environment, reverse proxy, process manager and safe network exposure.
---

# Production Readiness Skill

Use this skill when preparing LocalXpress APP-IND for VPS production deployment.

## Goals

Prepare production deployment for:
- Frontend on public domain
- Backend behind HTTPS reverse proxy
- Stripe live/test webhook
- Google Maps keys restricted
- Resend configured with verified domain
- No direct public database exposure

## Production security rules

- Backend should listen on 127.0.0.1 or internal Docker network where possible.
- Public access only through Nginx/HTTPS.
- Only ports 80 and 443 should be publicly open.
- PostgreSQL must never be public.
- Stripe webhook endpoint must use raw body and signature verification.
- CORS must only allow production frontend domain.
- NODE_ENV=production.
- .env must never be committed.
- Logs must avoid PII unless LOG_LEVEL=debug.

## Required production variables

Backend:
- NODE_ENV=production
- PORT=3001
- FRONTEND_URL=https://pedidos.localxpress.app
- GOOGLE_MAPS_API_KEY
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- RESEND_API_KEY
- RESEND_FROM
- ADMIN_EMAIL
- LOCALXPRESS_SUPPORT_PHONE
- LOCALXPRESS_CENTRAL_API_URL
- LOCALXPRESS_CENTRAL_API_KEY

Frontend:
- VITE_API_URL=https://api-pedidos.localxpress.app or chosen backend domain
- VITE_GOOGLE_MAPS_BROWSER_KEY

## Validation

Before production:
- npm run build
- npm run typecheck:backend
- full Stripe test payment
- webhook test
- email admin + customer
- security headers test
- CORS test
- port exposure check
