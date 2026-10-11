import dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcryptjs";
import { pool } from "../config/db.js";

const departments = [
  "Finance",
  "Human Resources",
  "Operations",
  "Technology",
];

const demoUsers = [
  {
    fullName: "Demo Employee",
    email: "employee@expenseflow.local",
    password: "Employee@123",
    role: "employee",
    employeeId: "EMP001",
    department: "Operations",
  },
  {
    fullName: "Demo Director",
    email: "director@expenseflow.local",
    password: "Director@123",
    role: "director",
    employeeId: "DIR001",
    department: "Finance",
  },
  {
    fullName: "Demo Accounts",
    email: "accounts@expenseflow.local",
    password: "Accounts@123",
    role: "accounts",
    employeeId: "ACC001",
    department: "Finance",
  },
];

async function seed() {
  try {
    for (const name of departments) {
      await pool.query(
        `INSERT INTO departments (name)
         VALUES ($1)
         ON CONFLICT (name) DO NOTHING`,
        [name]
      );
    }

    for (const demo of demoUsers) {
      const departmentResult = await pool.query(
        "SELECT id FROM departments WHERE name = $1",
        [demo.department]
      );

      const passwordHash = await bcrypt.hash(demo.password, 12);

      await pool.query(
        `INSERT INTO users
          (full_name, email, password_hash, role, employee_id, department_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (email) DO NOTHING`,
        [
          demo.fullName,
          demo.email,
          passwordHash,
          demo.role,
          demo.employeeId,
          departmentResult.rows[0].id,
        ]
      );
    }

    console.log("Development departments and demo users are ready.");
    console.log("Use the local demo credentials documented in your setup notes.");
  } catch (error) {
    console.error("Seeding failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

seed();