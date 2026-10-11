
import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

try {
  // 1. List existing database tables.
  const tables = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);

  console.log("\n=== Existing Database Tables ===");

  if (tables.rows.length === 0) {
    console.log("No tables found in the public schema.");
  } else {
    tables.rows.forEach((row) => {
      console.log("-", row.table_name);
    });
  }

  // 2. Check whether migration tracking exists.
  const migration = await pool.query(`
    SELECT to_regclass('public.schema_migrations') AS migration_table;
  `);

  console.log(
    "\n=== Migration Tracking ===\n",
    migration.rows[0].migration_table || "Not found"
  );

  // 3. Inspect the current voucher table constraints.
  const constraints = await pool.query(`
    SELECT
      conname,
      pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'public.vouchers'::regclass
      AND contype = 'c'
    ORDER BY conname;
  `);

  console.log("\n=== Voucher Database Constraints ===");

  if (constraints.rows.length === 0) {
    console.log("No CHECK constraints found.");
  } else {
    constraints.rows.forEach((row) => {
      console.log(`\n- ${row.conname}`);
      console.log(`  ${row.definition}`);
    });
  }

  console.log("\nDatabase inspection completed successfully.");
} catch (error) {
  console.error("\nDatabase inspection failed:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
