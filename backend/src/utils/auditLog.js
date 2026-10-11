
import { pool } from "../config/db.js";

/**
 * Record an action in the audit_logs table.
 * Pass a transaction client when the log must commit atomically
 * with the associated voucher change.
 */
export async function writeAuditLog(
  db = pool,
  { actorId = null, voucherId = null, action, details = {} }
) {
  if (!action || typeof action !== "string") {
    throw new Error("An audit action is required.");
  }

  await db.query(
    `INSERT INTO audit_logs (
       actor_id,
       voucher_id,
       action,
       details,
       created_at
     )
     VALUES ($1, $2, $3, $4::jsonb, NOW())`,
    [
      actorId,
      voucherId,
      action,
      JSON.stringify(details),
    ]
  );
}
