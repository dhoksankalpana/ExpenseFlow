import crypto from "node:crypto";
import { doubleCsrf } from "csrf-csrf";

const csrfSecret = process.env.CSRF_SECRET;

if (!csrfSecret || csrfSecret.length < 32) {
  throw new Error("CSRF_SECRET must contain at least 32 characters.");
}

export const {
  doubleCsrfProtection,
  generateCsrfToken,
} = doubleCsrf({
  getSecret: () => csrfSecret,
  getSessionIdentifier: (req) => req.cookies?.csrfSessionId,
  cookieName: "expenseflow.csrf",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  },
});

export function ensureCsrfSession(req, res, next) {
  let sessionId = req.cookies?.csrfSessionId;

  if (!sessionId) {
    sessionId = crypto.randomBytes(32).toString("hex");

    res.cookie("csrfSessionId", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 8 * 60 * 60 * 1000,
    });

    // Make the newly created ID available during this request.
    req.cookies.csrfSessionId = sessionId;
  }

  next();
}