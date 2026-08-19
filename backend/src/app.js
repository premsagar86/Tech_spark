import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import eventsRoutes from "./routes/events.routes.js";
import registrationsRoutes from "./routes/registrations.routes.js";
import paymentsRoutes from "./routes/payments.routes.js";
import participantsRoutes from "./routes/participants.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import authRoutes from "./routes/auth.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();
app.connection = null; // will be set in db.js

// Railway (and most PaaS hosts) sit behind a reverse proxy that sets
// X-Forwarded-For — without this, express-rate-limit can't safely identify
// client IPs and throws on every request (ERR_ERL_UNEXPECTED_X_FORWARDED_FOR).
app.set("trust proxy", 1);

// FRONTEND_URL is a comma-separated list so local dev (which hops between
// Vite ports: 3000, 5173, 5174, ...) doesn't need the backend restarted
// every time the frontend picks a different port.
const allowedOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  })
);
app.use(cookieParser()); // required — adminAuth.js reads req.cookies.adminToken

// The webhook needs the RAW body for signature verification, so it must be
// mounted before express.json() parses everything else.
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));
app.use(express.json());

app.use("/api/events", eventsRoutes);
app.use("/api/registrations", registrationsRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/participants", participantsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);

app.use(errorHandler);
export default app;
