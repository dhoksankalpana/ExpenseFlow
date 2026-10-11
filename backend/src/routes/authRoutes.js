
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";

import { pool } from "../config/db.js";
import { authenticate } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();
const COOKIE_NAME = "expenseflow_token";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/",
  maxAge: 8 * 60 * 60 * 1000,
};

const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(128),
});

const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(150),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
  departmentId: z
    .string()
    .regex(/^\d+$/, "Select a valid department."),
});

function publicUser(user) {
  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
    employeeId: user.employee_id,
    departmentId: user.department_id,
    departmentName: user.department_name,
  };
}

// Public department list for the registration form.
router.get(
  "/departments",
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      "SELECT id::text AS id, name FROM departments ORDER BY name ASC"
    );

    res.json({
      success: true,
      departments: result.rows,
    });
  })
);

// Public registration: every new account is an employee.
router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid name, email, password, and department.",
      });
    }

    const fullName = parsed.data.fullName;
    const email = parsed.data.email.toLowerCase();
    const { password, departmentId } = parsed.data;

    const departmentResult = await pool.query(
      "SELECT id FROM departments WHERE id = $1",
      [departmentId]
    );

    if (!departmentResult.rows.length) {
      return res.status(400).json({
        success: false,
        message: "Please select a valid department.",
      });
    }

    const existingUser = await pool.query(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [email]
    );

    if (existingUser.rows.length) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    try {
      await pool.query(
        `INSERT INTO users
          (full_name, email, password_hash, role, department_id)
         VALUES ($1, $2, $3, 'employee', $4)`,
        [fullName, email, passwordHash, departmentId]
      );
    } catch (error) {
      // Also handle a duplicate email if two registrations happen
      // at nearly the same time.
      if (error.code === "23505") {
        return res.status(409).json({
          success: false,
          message: "An account with this email already exists.",
        });
      }

      throw error;
    }

    return res.status(201).json({
      success: true,
      message: "Account created successfully. You can now sign in.",
    });
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email address and password.",
      });
    }

    const { email, password } = parsed.data;

    const result = await pool.query(
      `SELECT
         u.id,
         u.full_name,
         u.email,
         u.password_hash,
         u.role,
         u.employee_id,
         u.department_id,
         u.is_active,
         d.name AS department_name
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE LOWER(u.email) = LOWER($1)
       LIMIT 1`,
      [email]
    );

    const user = result.rows[0];

    if (
      !user ||
      !user.is_active ||
      !(await bcrypt.compare(password, user.password_hash))
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const token = jwt.sign(
      {
        sub: String(user.id),
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.cookie(COOKIE_NAME, token, cookieOptions);

    return res.json({
      success: true,
      message: "Login successful.",
      user: publicUser(user),
    });
  })
);

router.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });

  res.json({
    success: true,
    message: "Logged out successfully.",
  });
});

router.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `SELECT
         u.id,
         u.full_name,
         u.email,
         u.role,
         u.employee_id,
         u.department_id,
         d.name AS department_name
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE u.id = $1 AND u.is_active = TRUE`,
      [req.user.sub]
    );

    if (!result.rows[0]) {
      return res.status(401).json({
        success: false,
        message: "User account is unavailable.",
      });
    }

    res.json({
      success: true,
      user: publicUser(result.rows[0]),
    });
  })
);

export default router;
