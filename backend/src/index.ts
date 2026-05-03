import path from "path";
import dotenv from "dotenv";

// Load .env from project root — explicit path so it works regardless of CWD
dotenv.config({
  path:  path.resolve(__dirname, "../../.env"),
  quiet: true,
});

import express from "express";
import cors from "cors";
import { generalLimiter } from "./middleware/rateLimiter";
import { quoteRouter } from "./routes/quote";
import { checkoutRouter } from "./routes/checkout";
import { webhookRouter } from "./routes/webhook";
import { orderStatusRouter } from "./routes/orderStatus";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// ─── Startup config check ─────────────────────────────────────────────────────

function logStartupConfig(): void {
  const checks: Record<string, boolean> = {
    GOOGLE_MAPS_API_KEY:    !!process.env.GOOGLE_MAPS_API_KEY,
    STRIPE_SECRET_KEY:      !!process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET:  !!process.env.STRIPE_WEBHOOK_SECRET,
    PUBLIC_APP_SUCCESS_URL: !!process.env.PUBLIC_APP_SUCCESS_URL,
    PUBLIC_APP_CANCEL_URL:  !!process.env.PUBLIC_APP_CANCEL_URL,
    SMTP_HOST:              !!process.env.SMTP_HOST,
    ADMIN_EMAIL:            !!process.env.ADMIN_EMAIL,
  };
  for (const [key, present] of Object.entries(checks)) {
    console.log(`[config] ${key}: ${present ? "✓" : "✗ not set"}`);
  }
}

// ─── CORS ─────────────────────────────────────────────────────────────────────

const allowedOrigins = [
  "http://localhost:8080",
  "http://localhost:5173",
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin not allowed — ${origin}`));
      }
    },
    credentials: true,
  })
);

// ─── Routes ───────────────────────────────────────────────────────────────────

// Stripe webhook requires raw body — must be registered before express.json()
app.use("/api/stripe/webhook", express.raw({ type: "application/json" }), webhookRouter);

// All other routes use JSON body parsing
app.use(express.json());
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

app.listen(PORT, () => {
  console.log(`[localxpress-backend] Running on port ${PORT}`);
  logStartupConfig();
});
