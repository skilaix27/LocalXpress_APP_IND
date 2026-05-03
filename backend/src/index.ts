import path from "path";
import dotenv from "dotenv";

// Load .env from project root — explicit path so it works regardless of CWD
dotenv.config({
  path:  path.resolve(__dirname, "../../.env"),
  quiet: true,
});

import express from "express";
import cors from "cors";
import helmet from "helmet";
import { generalLimiter } from "./middleware/rateLimiter";
import { quoteRouter } from "./routes/quote";
import { checkoutRouter } from "./routes/checkout";
import { webhookRouter } from "./routes/webhook";
import { orderStatusRouter } from "./routes/orderStatus";

const app = express();
const PORT = Number(process.env.PORT) || 3001;
// HOST defaults to 0.0.0.0 (all interfaces) in development.
// Set HOST=127.0.0.1 in production so the port is not publicly reachable —
// Nginx proxies HTTPS traffic to it internally.
const HOST = process.env.HOST || "0.0.0.0";
const isProd = process.env.NODE_ENV === "production";

// ─── Startup config check ─────────────────────────────────────────────────────

function logStartupConfig(): void {
  const checks: Record<string, boolean> = {
    GOOGLE_MAPS_API_KEY:           !!process.env.GOOGLE_MAPS_API_KEY,
    STRIPE_SECRET_KEY:             !!process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET:         !!process.env.STRIPE_WEBHOOK_SECRET,
    PUBLIC_APP_SUCCESS_URL:        !!process.env.PUBLIC_APP_SUCCESS_URL,
    PUBLIC_APP_CANCEL_URL:         !!process.env.PUBLIC_APP_CANCEL_URL,
    RESEND_API_KEY:                !!process.env.RESEND_API_KEY,
    RESEND_FROM:                   !!process.env.RESEND_FROM,
    ADMIN_EMAIL:                   !!process.env.ADMIN_EMAIL,
    LOCALXPRESS_SUPPORT_PHONE:     !!process.env.LOCALXPRESS_SUPPORT_PHONE,
    LOCALXPRESS_CENTRAL_API_URL:   !!process.env.LOCALXPRESS_CENTRAL_API_URL,
    LOCALXPRESS_CENTRAL_API_KEY:   !!process.env.LOCALXPRESS_CENTRAL_API_KEY,
  };
  for (const [key, present] of Object.entries(checks)) {
    console.log(`[config] ${key}: ${present ? "✓" : "✗ not set"}`);
  }
}

// ─── Security headers (Helmet) ────────────────────────────────────────────────
// CSP is intentionally omitted here: Google Places Autocomplete loads a script
// from maps.googleapis.com at runtime, which a strict script-src would block.
// Add CSP once the frontend is served via a controlled domain and the nonce
// or hash for the Maps script can be set.

app.use(
  helmet({
    contentSecurityPolicy:    false,   // see note above
    crossOriginEmbedderPolicy: false,  // would block Maps iframe in some browsers
  })
);

// ─── CORS ─────────────────────────────────────────────────────────────────────

const productionOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL]
  : [];

const developmentOrigins = isProd
  ? []
  : ["http://localhost:8080", "http://localhost:5173"];

const allowedOrigins = [...productionOrigins, ...developmentOrigins];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server requests (no origin header) and listed origins
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin not allowed — ${origin}`));
      }
    },
    credentials: false,   // no cookies or auth headers are used
  })
);

// ─── Proxy trust ─────────────────────────────────────────────────────────────
// The backend sits behind a single Nginx reverse proxy.
// "1" tells Express to trust the first X-Forwarded-For entry only,
// which is required for express-rate-limit to read the real client IP.
app.set("trust proxy", 1);

// ─── Routes ───────────────────────────────────────────────────────────────────

// Stripe webhook requires raw body — must be registered before express.json()
// Limit is generous (Stripe events are small) but explicit.
app.use(
  "/api/stripe/webhook",
  express.raw({ type: "application/json", limit: "512kb" }),
  webhookRouter
);

// All other routes use JSON body parsing with an explicit size limit.
app.use(express.json({ limit: "50kb" }));
app.use(generalLimiter);

app.get("/api/health", (_req, res) => {
  res.json({
    ok:        true,
    service:   "localxpress-public-orders",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/public", quoteRouter);
app.use("/api/public", checkoutRouter);
app.use("/api/public", orderStatusRouter);

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, HOST, () => {
  console.log(`[localxpress-backend] Running on ${HOST}:${PORT} (${isProd ? "production" : "development"})`);
  logStartupConfig();
});
