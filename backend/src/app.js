
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import voucherRoutes from "./routes/voucherRoutes.js";
import authRoutes from "./routes/authRoutes.js";

import {
  ensureCsrfSession,
  generateCsrfToken,
  doubleCsrfProtection,
} from "./middleware/csrf.js";

import {
  notFoundHandler,
  errorHandler,
} from "./middleware/errorHandler.js";

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "ExpenseFlow API is running",
  });
});

// Create a CSRF session and issue a token.
app.get("/api/auth/csrf", ensureCsrfSession, (req, res) => {
  const csrfToken = generateCsrfToken(req, res);

  res.json({
    success: true,
    csrfToken,
  });
});

// Protect state-changing requests before registering API routes.
app.use(doubleCsrfProtection);

app.use("/api/auth", authRoutes);
app.use("/api/vouchers", voucherRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
