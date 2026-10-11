
import { Router } from "express";
import { z } from "zod";

import {
  uploadSignature,
  saveSignatureImage,
  deleteSignatureImage,
  getSignatureImagePath,
} from "../middleware/upload.js";

import { writeAuditLog } from "../utils/auditLog.js";
import { pool } from "../config/db.js";
import { authenticate } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(authenticate);

// Keep synchronized with PostgreSQL and the frontend.
const EXPENSE_CATEGORIES = [
  "Travel",
  "Meals",
  "Accommodation",
  "Office Supplies",
  "Transport",
  "Utilities",
  "Communication",
  "Internet",
  "Equipment",
  "Training",
  "Medical",
  "Other",
];

const voucherIdSchema = z.coerce.number().int().positive().safeParse;

const voucherSchema = z.object({
  expenseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid expense date.")
    .refine((value) => {
      const date = new Date(`${value}T00:00:00.000Z`);

      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      );
    }, "Enter a real calendar date."),

  departmentId: z.coerce.number().int().positive(),

  title: z.string().trim().min(3).max(200),

  category: z.enum(EXPENSE_CATEGORIES, {
    error: "Select a valid expense category.",
  }),

  description: z.string().trim().max(5000).default(""),

  amount: z.coerce.number().positive().finite().max(999999999),
});

function canViewAll(user) {
  return user.role === "director" || user.role === "accounts";
}

function canAccessVoucher(user, voucher) {
  return (
    canViewAll(user) ||
    String(voucher.employee_id) === String(user.sub)
  );
}

function sendValidationError(res, message, issues = []) {
  return res.status(400).json({
    success: false,
    message,
    errors: issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    })),
  });
}

function validVoucherId(value) {
  return voucherIdSchema(value);
}

function voucherSelect() {
  return `
    SELECT
      v.id,
      v.voucher_number,
      v.voucher_date,
      v.expense_date,
      v.department_id,
      d.name AS department_name,
      v.title,
      v.category,
      v.description,
      v.amount,
      v.employee_id,
      u.full_name AS employee_name,
      u.employee_id AS employee_code,
      v.status,
      v.employee_signature_path,
      v.director_signature_path,
      v.approval_date,
      v.rejection_reason,
      v.created_at,
      v.updated_at
    FROM vouchers v
    JOIN departments d ON d.id = v.department_id
    JOIN users u ON u.id = v.employee_id
  `;
}

// Verify the employee is active and assigned to the requested department.
async function validateEmployeeDepartment(employeeId, departmentId) {
  const employeeResult = await pool.query(
    `SELECT department_id
     FROM users
     WHERE id = $1 AND is_active = TRUE`,
    [employeeId]
  );

  const employee = employeeResult.rows[0];

  if (!employee) {
    return {
      valid: false,
      status: 401,
      message: "Your user account is unavailable.",
    };
  }

  if (
    employee.department_id &&
    String(employee.department_id) !== String(departmentId)
  ) {
    return {
      valid: false,
      status: 400,
      message: "Select your assigned department.",
    };
  }

  const departmentResult = await pool.query(
    "SELECT id FROM departments WHERE id = $1",
    [departmentId]
  );

  if (!departmentResult.rows[0]) {
    return {
      valid: false,
      status: 400,
      message: "The selected department does not exist.",
    };
  }

  return { valid: true };
}

// =========================================================
// GET /api/vouchers
// Employees see their own vouchers.
// Directors and Accounts can see all vouchers.
// =========================================================
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const values = [];
    let whereClause = "";

    if (!canViewAll(req.user)) {
      values.push(req.user.sub);
      whereClause = "WHERE v.employee_id = $1";
    }

    const result = await pool.query(
      `${voucherSelect()}
       ${whereClause}
       ORDER BY v.created_at DESC`,
      values
    );

    return res.json({
      success: true,
      vouchers: result.rows,
    });
  })
);

// =========================================================
// GET /api/vouchers/:id/signatures/:kind
// Return a private signature image only to an authorized user.
// kind: employee | director
// =========================================================
router.get(
  "/:id/signatures/:kind",
  asyncHandler(async (req, res) => {
    const id = validVoucherId(req.params.id);

    if (!id.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid voucher ID.",
      });
    }

    const kind = req.params.kind;

    if (!["employee", "director"].includes(kind)) {
      return res.status(400).json({
        success: false,
        message: "Invalid signature type.",
      });
    }

    const result = await pool.query(
      `SELECT id, employee_id,
              employee_signature_path, director_signature_path
       FROM vouchers
       WHERE id = $1`,
      [id.data]
    );

    const voucher = result.rows[0];

    if (!voucher || !canAccessVoucher(req.user, voucher)) {
      return res.status(404).json({
        success: false,
        message: "Voucher not found.",
      });
    }

    const filename =
      kind === "employee"
        ? voucher.employee_signature_path
        : voucher.director_signature_path;

    if (!filename) {
      return res.status(404).json({
        success: false,
        message: "This signature has not been uploaded.",
      });
    }

    let imagePath;

    try {
      imagePath = getSignatureImagePath(filename);
    } catch {
      // Also rejects legacy placeholder strings stored in the database.
      return res.status(404).json({
        success: false,
        message: "A valid signature image is not available.",
      });
    }

    res.set("Cache-Control", "private, no-store");
    res.set("X-Content-Type-Options", "nosniff");

    return res.sendFile(imagePath, (error) => {
      if (error && !res.headersSent) {
        if (error.status === 404 || error.code === "ENOENT") {
          return res.status(404).json({
            success: false,
            message: "Signature image not found.",
          });
        }

        return res.status(500).json({
          success: false,
          message: "Unable to retrieve the signature image.",
        });
      }
    });
  })
);

// =========================================================
// GET /api/vouchers/:id
// Voucher details and approval history.
// =========================================================
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = validVoucherId(req.params.id);

    if (!id.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid voucher ID.",
      });
    }

    const result = await pool.query(
      `${voucherSelect()}
       WHERE v.id = $1`,
      [id.data]
    );

    const voucher = result.rows[0];

    if (!voucher || !canAccessVoucher(req.user, voucher)) {
      return res.status(404).json({
        success: false,
        message: "Voucher not found.",
      });
    }

    const approvals = await pool.query(
      `SELECT
         va.id,
         va.action,
         va.signature_path,
         va.rejection_reason,
         va.notes,
         va.created_at,
         u.full_name AS actor_name,
         u.role AS actor_role
       FROM voucher_approvals va
       JOIN users u ON u.id = va.actor_id
       WHERE va.voucher_id = $1
       ORDER BY va.created_at ASC, va.id ASC`,
      [id.data]
    );

    return res.json({
      success: true,
      voucher,
      history: approvals.rows,
    });
  })
);

// =========================================================
// POST /api/vouchers
// Employees create draft vouchers.
// =========================================================
router.post(
  "/",
  asyncHandler(async (req, res) => {
    if (req.user.role !== "employee") {
      return res.status(403).json({
        success: false,
        message: "Only employees can create vouchers.",
      });
    }

    const parsed = voucherSchema.safeParse(req.body);

    if (!parsed.success) {
      return sendValidationError(
        res,
        "Please correct the voucher details.",
        parsed.error.issues
      );
    }

    const data = parsed.data;

    const departmentCheck = await validateEmployeeDepartment(
      req.user.sub,
      data.departmentId
    );

    if (!departmentCheck.valid) {
      return res.status(departmentCheck.status).json({
        success: false,
        message: departmentCheck.message,
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `INSERT INTO vouchers (
           expense_date,
           department_id,
           title,
           category,
           description,
           amount,
           employee_id,
           status
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft')
         RETURNING *`,
        [
          data.expenseDate,
          data.departmentId,
          data.title,
          data.category,
          data.description,
          data.amount,
          req.user.sub,
        ]
      );

      const voucher = result.rows[0];

      await writeAuditLog(client, {
        actorId: req.user.sub,
        voucherId: voucher.id,
        action: "voucher_created",
        details: {
          voucherNumber: voucher.voucher_number,
          status: "draft",
          amount: voucher.amount,
          category: voucher.category,
        },
      });

      await client.query("COMMIT");

      return res.status(201).json({
        success: true,
        message: "Draft voucher created successfully.",
        voucher,
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  })
);

// =========================================================
// PUT /api/vouchers/:id
// Employees edit only their own draft vouchers.
// =========================================================
router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    if (req.user.role !== "employee") {
      return res.status(403).json({
        success: false,
        message: "Only employees can edit draft vouchers.",
      });
    }

    const id = validVoucherId(req.params.id);

    if (!id.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid voucher ID.",
      });
    }

    const parsed = voucherSchema.safeParse(req.body);

    if (!parsed.success) {
      return sendValidationError(
        res,
        "Please correct the voucher details.",
        parsed.error.issues
      );
    }

    const data = parsed.data;

    const departmentCheck = await validateEmployeeDepartment(
      req.user.sub,
      data.departmentId
    );

    if (!departmentCheck.valid) {
      return res.status(departmentCheck.status).json({
        success: false,
        message: departmentCheck.message,
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const existingResult = await client.query(
        `SELECT id, employee_id, status, voucher_number
         FROM vouchers
         WHERE id = $1
         FOR UPDATE`,
        [id.data]
      );

      const existing = existingResult.rows[0];

      if (
        !existing ||
        String(existing.employee_id) !== String(req.user.sub)
      ) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          success: false,
          message: "Voucher not found.",
        });
      }

      if (existing.status !== "draft") {
        await client.query("ROLLBACK");

        return res.status(409).json({
          success: false,
          message: "Only draft vouchers can be edited.",
        });
      }

      const result = await client.query(
        `UPDATE vouchers
         SET expense_date = $1,
             department_id = $2,
             title = $3,
             category = $4,
             description = $5,
             amount = $6,
             updated_at = NOW()
         WHERE id = $7
           AND employee_id = $8
           AND status = 'draft'
         RETURNING *`,
        [
          data.expenseDate,
          data.departmentId,
          data.title,
          data.category,
          data.description,
          data.amount,
          id.data,
          req.user.sub,
        ]
      );

      if (!result.rows[0]) {
        await client.query("ROLLBACK");

        return res.status(409).json({
          success: false,
          message: "This voucher is no longer editable.",
        });
      }

      await writeAuditLog(client, {
        actorId: req.user.sub,
        voucherId: id.data,
        action: "voucher_updated",
        details: {
          voucherNumber: existing.voucher_number,
          status: "draft",
          updatedFields: [
            "expense_date",
            "department_id",
            "title",
            "category",
            "description",
            "amount",
          ],
        },
      });

      await client.query("COMMIT");

      return res.json({
        success: true,
        message: "Draft voucher updated successfully.",
        voucher: result.rows[0],
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  })
);

// =========================================================
// DELETE /api/vouchers/:id
// Employees may delete their own draft vouchers only.
// =========================================================
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    if (req.user.role !== "employee") {
      return res.status(403).json({
        success: false,
        message: "Only employees can delete draft vouchers.",
      });
    }

    const id = validVoucherId(req.params.id);

    if (!id.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid voucher ID.",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `SELECT id, employee_id, status, voucher_number,
                amount, category
         FROM vouchers
         WHERE id = $1
         FOR UPDATE`,
        [id.data]
      );

      const voucher = result.rows[0];

      if (
        !voucher ||
        String(voucher.employee_id) !== String(req.user.sub)
      ) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          success: false,
          message: "Voucher not found.",
        });
      }

      if (voucher.status !== "draft") {
        await client.query("ROLLBACK");

        return res.status(409).json({
          success: false,
          message: "Only draft vouchers can be deleted.",
        });
      }

      // Log before deletion. The audit log retains the voucher ID
      // and identifying details for the deletion event.
      await writeAuditLog(client, {
        actorId: req.user.sub,
        voucherId: voucher.id,
        action: "voucher_deleted",
        details: {
          voucherNumber: voucher.voucher_number,
          previousStatus: voucher.status,
          amount: voucher.amount,
          category: voucher.category,
        },
      });

      // Remove history rows first to accommodate schemas that do not
      // cascade voucher_approvals when a voucher is deleted.
      await client.query(
        "DELETE FROM voucher_approvals WHERE voucher_id = $1",
        [voucher.id]
      );

      await client.query(
        `DELETE FROM vouchers
         WHERE id = $1
           AND employee_id = $2
           AND status = 'draft'`,
        [voucher.id, req.user.sub]
      );

      await client.query("COMMIT");

      return res.json({
        success: true,
        message: "Draft voucher deleted successfully.",
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  })
);

// =========================================================
// POST /api/vouchers/:id/submit
// Employees must upload a real PNG/JPEG signature.
// Multipart file field: signature
// =========================================================
router.post(
  "/:id/submit",
  uploadSignature,
  asyncHandler(async (req, res) => {
    if (req.user.role !== "employee") {
      return res.status(403).json({
        success: false,
        message: "Only employees can submit vouchers.",
      });
    }

    const id = validVoucherId(req.params.id);

    if (!id.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid voucher ID.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Upload your PNG or JPEG signature before submitting.",
      });
    }

    const client = await pool.connect();
    let signatureFilename = null;
    let transactionStarted = false;

    try {
      await client.query("BEGIN");
      transactionStarted = true;

      const voucherResult = await client.query(
        `SELECT id, employee_id, status, voucher_number
         FROM vouchers
         WHERE id = $1
         FOR UPDATE`,
        [id.data]
      );

      const voucher = voucherResult.rows[0];

      if (
        !voucher ||
        String(voucher.employee_id) !== String(req.user.sub)
      ) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(404).json({
          success: false,
          message: "Voucher not found.",
        });
      }

      if (voucher.status !== "draft") {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(409).json({
          success: false,
          message: "Only draft vouchers can be submitted.",
        });
      }

      signatureFilename = await saveSignatureImage(req.file);

      await client.query(
        `UPDATE vouchers
         SET status = 'submitted',
             employee_signature_path = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [signatureFilename, voucher.id]
      );

      await client.query(
        `INSERT INTO voucher_approvals
           (voucher_id, actor_id, action, notes)
         VALUES ($1, $2, 'submitted', $3)`,
        [
          voucher.id,
          req.user.sub,
          "Employee uploaded a signature and submitted the voucher.",
        ]
      );

      await writeAuditLog(client, {
        actorId: req.user.sub,
        voucherId: voucher.id,
        action: "voucher_submitted",
        details: {
          voucherNumber: voucher.voucher_number,
          status: "submitted",
          employeeSignatureUploaded: true,
        },
      });

      await client.query("COMMIT");
      transactionStarted = false;

      return res.json({
        success: true,
        message: "Voucher signed and submitted successfully.",
      });
    } catch (error) {
      if (transactionStarted) {
        await client.query("ROLLBACK").catch(() => {});
      }

      if (signatureFilename) {
        await deleteSignatureImage(signatureFilename).catch(() => {});
      }

      throw error;
    } finally {
      client.release();
    }
  })
);

// =========================================================
// POST /api/vouchers/:id/approve
// Directors must upload a real PNG/JPEG signature.
// Multipart fields: signature (file), notes (optional text)
// =========================================================
router.post(
  "/:id/approve",
  uploadSignature,
  asyncHandler(async (req, res) => {
    if (req.user.role !== "director") {
      return res.status(403).json({
        success: false,
        message: "Only a Director can approve vouchers.",
      });
    }

    const id = validVoucherId(req.params.id);

    if (!id.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid voucher ID.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Upload your PNG or JPEG signature before approving.",
      });
    }

    const bodySchema = z.object({
      notes: z.string().trim().max(2000).optional().default(""),
    });

    const parsedBody = bodySchema.safeParse(req.body);

    if (!parsedBody.success) {
      return sendValidationError(
        res,
        "Please correct the approval details.",
        parsedBody.error.issues
      );
    }

    const client = await pool.connect();
    let signatureFilename = null;
    let transactionStarted = false;

    try {
      await client.query("BEGIN");
      transactionStarted = true;

      const voucherCheck = await client.query(
        `SELECT id, status, voucher_number
         FROM vouchers
         WHERE id = $1
         FOR UPDATE`,
        [id.data]
      );

      const voucher = voucherCheck.rows[0];

      if (!voucher || voucher.status !== "submitted") {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(409).json({
          success: false,
          message: "Voucher not found or is not awaiting approval.",
        });
      }

      signatureFilename = await saveSignatureImage(req.file);

      const result = await client.query(
        `UPDATE vouchers
         SET status = 'approved',
             director_signature_path = $1,
             approval_date = NOW(),
             rejection_reason = NULL,
             updated_at = NOW()
         WHERE id = $2
           AND status = 'submitted'
         RETURNING id, voucher_number, status, approval_date`,
        [signatureFilename, id.data]
      );

      if (!result.rows[0]) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        await deleteSignatureImage(signatureFilename).catch(() => {});
        signatureFilename = null;

        return res.status(409).json({
          success: false,
          message: "Voucher is no longer awaiting approval.",
        });
      }

      await client.query(
        `INSERT INTO voucher_approvals
           (voucher_id, actor_id, action, signature_path, notes)
         VALUES ($1, $2, 'approved', $3, $4)`,
        [
          id.data,
          req.user.sub,
          signatureFilename,
          parsedBody.data.notes,
        ]
      );

      await writeAuditLog(client, {
        actorId: req.user.sub,
        voucherId: id.data,
        action: "voucher_approved",
        details: {
          voucherNumber: voucher.voucher_number,
          previousStatus: "submitted",
          newStatus: "approved",
          directorSignatureUploaded: true,
          notes: parsedBody.data.notes,
        },
      });

      await client.query("COMMIT");
      transactionStarted = false;

      return res.json({
        success: true,
        message: "Voucher approved and signed successfully.",
        voucher: result.rows[0],
      });
    } catch (error) {
      if (transactionStarted) {
        await client.query("ROLLBACK").catch(() => {});
      }

      if (signatureFilename) {
        await deleteSignatureImage(signatureFilename).catch(() => {});
      }

      throw error;
    } finally {
      client.release();
    }
  })
);

// =========================================================
// POST /api/vouchers/:id/reject
// Directors reject submitted vouchers with a reason.
// =========================================================
router.post(
  "/:id/reject",
  asyncHandler(async (req, res) => {
    if (req.user.role !== "director") {
      return res.status(403).json({
        success: false,
        message: "Only a Director can reject vouchers.",
      });
    }

    const id = validVoucherId(req.params.id);

    if (!id.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid voucher ID.",
      });
    }

    const bodySchema = z.object({
      rejectionReason: z.string().trim().min(1).max(2000),
      notes: z.string().trim().max(2000).optional().default(""),
    });

    const parsedBody = bodySchema.safeParse(req.body);

    if (!parsedBody.success) {
      return sendValidationError(
        res,
        "Provide a valid rejection reason.",
        parsedBody.error.issues
      );
    }

    const client = await pool.connect();
    let transactionStarted = false;

    try {
      await client.query("BEGIN");
      transactionStarted = true;

      const voucherCheck = await client.query(
        `SELECT id, status, voucher_number
         FROM vouchers
         WHERE id = $1
         FOR UPDATE`,
        [id.data]
      );

      const voucher = voucherCheck.rows[0];

      if (!voucher || voucher.status !== "submitted") {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(409).json({
          success: false,
          message: "Voucher not found or is not awaiting approval.",
        });
      }

      const result = await client.query(
        `UPDATE vouchers
         SET status = 'rejected',
             rejection_reason = $1,
             updated_at = NOW()
         WHERE id = $2
           AND status = 'submitted'
         RETURNING id, voucher_number, status, rejection_reason`,
        [parsedBody.data.rejectionReason, id.data]
      );

      if (!result.rows[0]) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(409).json({
          success: false,
          message: "Voucher is no longer awaiting approval.",
        });
      }

      await client.query(
        `INSERT INTO voucher_approvals
           (voucher_id, actor_id, action, rejection_reason, notes)
         VALUES ($1, $2, 'rejected', $3, $4)`,
        [
          id.data,
          req.user.sub,
          parsedBody.data.rejectionReason,
          parsedBody.data.notes,
        ]
      );

      await writeAuditLog(client, {
        actorId: req.user.sub,
        voucherId: id.data,
        action: "voucher_rejected",
        details: {
          voucherNumber: voucher.voucher_number,
          previousStatus: "submitted",
          newStatus: "rejected",
          rejectionReason: parsedBody.data.rejectionReason,
          notes: parsedBody.data.notes,
        },
      });

      await client.query("COMMIT");
      transactionStarted = false;

      return res.json({
        success: true,
        message: "Voucher rejected successfully.",
        voucher: result.rows[0],
      });
    } catch (error) {
      if (transactionStarted) {
        await client.query("ROLLBACK").catch(() => {});
      }

      throw error;
    } finally {
      client.release();
    }
  })
);

export default router;
