import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL connection error:", error.message);
});

export async function testDatabaseConnection() {
  const result = await pool.query(
    "SELECT current_database() AS database, NOW() AS server_time"
  );

  return result.rows[0];
}