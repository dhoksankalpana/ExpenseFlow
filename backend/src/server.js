

import dotenv from "dotenv";

// Load environment variables before importing the app or database.
dotenv.config();

const { default: app } = await import("./app.js");
const { pool, testDatabaseConnection } = await import("./config/db.js");

const PORT = Number(process.env.PORT) || 5000;

async function startServer() {
  try {
    const database = await testDatabaseConnection();

    console.log(`Connected to PostgreSQL database: ${database.database}`);

    const server = app.listen(PORT, () => {
      console.log(`ExpenseFlow API running at http://localhost:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    });

    server.on("error", (error) => {
      console.error("Server startup error:", error.message);
      process.exitCode = 1;
    });
  } catch (error) {
    console.error("Failed to start ExpenseFlow:", error.message);
    process.exitCode = 1;
    await pool.end().catch(() => {});
  }
}

startServer();
