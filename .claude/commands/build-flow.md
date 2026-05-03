Use the localxpress-public-orders and localxpress-payments-security skills.

Analyze the current project first.

Then implement the paid order flow in phases.

Current state:
- Frontend already exists.
- Form already exists.
- Backend may not exist or may be incomplete.
- Do not integrate with production PostgreSQL.
- Do not write to LocalXpress main database.
- Use local JSON storage only.

Required work:

1. Inspect current frontend:
   - Locate the main form.
   - Identify current submit behavior.
   - Identify if Supabase or mock logic is still being used.

2. Create or complete local backend:
   - backend/server.ts
   - POST /api/public/quote
   - POST /api/public/checkout
   - POST /api/stripe/webhook
   - GET /api/public/order-status?session_id=...

3. Implement pricing:
   - backend pricing zones from CLAUDE.md
   - manual quote above 120 km

4. Implement Google Maps:
   - backend-side route calculation
   - fallback mock only if GOOGLE_MAPS_API_KEY is missing in development

5. Implement Stripe Checkout:
   - backend creates Checkout Session
   - frontend receives checkout_url
   - frontend redirects to Stripe

6. Implement webhook:
   - raw body
   - signature verification
   - checkout.session.completed
   - create paid order in backend/data/orders.json
   - avoid duplicate orders

7. Implement emails:
   - admin email
   - customer email
   - only after payment confirmed

8. Connect frontend:
   - call POST /api/public/quote
   - show quote review
   - call POST /api/public/checkout
   - redirect to checkout_url
   - add /success and /cancel if missing
   - /success checks order-status by session_id

9. Security:
   - ensure .env is ignored
   - create .env.example
   - no secrets in frontend
   - no production DB connection
   - no production order creation call

After each major change:
- explain what changed
- run npm run build if possible
- fix errors
