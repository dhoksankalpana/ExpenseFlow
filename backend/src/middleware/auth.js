
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";

const COOKIE_NAME = "expenseflow_token";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/",
};

export async function authenticate(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Please log in to continue.",
    });
  }

  let payload;

  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    res.clearCookie(COOKIE_NAME, cookieOptions);

    return res.status(401).json({
      success: false,
      message: "Your session is invalid or expired. Please log in again.",
    });
  }

  try {
    const result = await pool.query(
      `SELECT id, role
       FROM users
       WHERE id = $1 AND is_active = TRUE`,
      [payload.sub]
    );

    const user = result.rows[0];

    if (!user) {
      res.clearCookie(COOKIE_NAME, cookieOptions);

      return res.status(401).json({
        success: false,
        message: "Your account is unavailable. Please contact the administrator.",
      });
    }

    // Use the current database role, not a potentially outdated JWT role.
    req.user = {
      sub: String(user.id),
      role: user.role,
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action.",
      });
    }

    next();
  };
}
