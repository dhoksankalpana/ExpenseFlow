
import dotenv from "dotenv";
dotenv.config();

import { pool } from "./src/config/db.js";

async function checkDepartment() {
  try {
    const result = await pool.query(
      `SELECT
         u.full_name,
         u.email,
         u.role,
         u.department_id,
         d.name AS department_name
       FROM users u
       LEFT JOIN departments d
         ON u.department_id = d.id
       WHERE u.email = $1`,
      ["employee@expenseflow.local"]
    );

    if (result.rows.length === 0) {
      console.log("Demo employee not found in the database.");
    } else {
      console.table(result.rows);
    }
  } catch (error) {
    console.error("Lookup failed:", error.message);
  } finally {
    await pool.end();
  }
}

checkDepartment();
