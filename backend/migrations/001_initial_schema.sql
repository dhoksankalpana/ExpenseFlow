
BEGIN;

-- 1. Departments
CREATE TABLE departments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Users and roles
CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL
        CHECK (role IN ('employee', 'director', 'accounts')),
    employee_id VARCHAR(50) UNIQUE,
    department_id BIGINT
        REFERENCES departments(id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Voucher number sequence
CREATE SEQUENCE voucher_number_seq START WITH 1;

-- 4. Expense vouchers
CREATE TABLE vouchers (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    voucher_number VARCHAR(30) NOT NULL UNIQUE
        DEFAULT (
            'EXP-' ||
            TO_CHAR(CURRENT_DATE, 'YYYY') ||
            '-' ||
            LPAD(NEXTVAL('voucher_number_seq')::TEXT, 6, '0')
        ),

    voucher_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expense_date DATE NOT NULL,

    department_id BIGINT NOT NULL
        REFERENCES departments(id) ON DELETE RESTRICT,

    title VARCHAR(200) NOT NULL,

    category VARCHAR(50) NOT NULL
        CHECK (
            category IN (
                'Travel',
                'Meals',
                'Accommodation',
                'Office Supplies',
                'Transport',
                'Utilities',
                'Other'
            )
        ),

    description TEXT NOT NULL DEFAULT '',
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),

    employee_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,

    employee_signature_path TEXT,

    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (
            status IN ('draft', 'submitted', 'approved', 'rejected')
        ),

    director_signature_path TEXT,
    approval_date TIMESTAMPTZ,
    rejection_reason TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (
        status <> 'submitted'
        OR employee_signature_path IS NOT NULL
    ),

    CHECK (
        status <> 'approved'
        OR (
            director_signature_path IS NOT NULL
            AND approval_date IS NOT NULL
        )
    ),

    CHECK (
        status <> 'rejected'
        OR (
            rejection_reason IS NOT NULL
            AND LENGTH(TRIM(rejection_reason)) > 0
        )
    )
);

-- 5. Voucher approval and submission history
CREATE TABLE voucher_approvals (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    voucher_id BIGINT NOT NULL
        REFERENCES vouchers(id) ON DELETE RESTRICT,

    actor_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,

    action VARCHAR(20) NOT NULL
        CHECK (
            action IN ('submitted', 'approved', 'rejected')
        ),

    signature_path TEXT,
    rejection_reason TEXT,
    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (
        action <> 'approved'
        OR signature_path IS NOT NULL
    ),

    CHECK (
        action <> 'rejected'
        OR (
            rejection_reason IS NOT NULL
            AND LENGTH(TRIM(rejection_reason)) > 0
        )
    )
);

-- 6. Audit history
CREATE TABLE audit_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    actor_id BIGINT
        REFERENCES users(id) ON DELETE RESTRICT,

    -- Preserve audit records when a voucher is deleted.
    -- The audit entry remains, but its voucher reference becomes NULL.
    voucher_id BIGINT
        REFERENCES vouchers(id) ON DELETE SET NULL,

    action VARCHAR(50) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Indexes for common searches and dashboards

CREATE INDEX idx_users_department
    ON users(department_id);

CREATE INDEX idx_vouchers_employee
    ON vouchers(employee_id);

CREATE INDEX idx_vouchers_status
    ON vouchers(status);

CREATE INDEX idx_vouchers_department
    ON vouchers(department_id);

CREATE INDEX idx_vouchers_expense_date
    ON vouchers(expense_date);

CREATE INDEX idx_vouchers_created_at
    ON vouchers(created_at DESC);

CREATE INDEX idx_approvals_voucher
    ON voucher_approvals(voucher_id, created_at DESC);

CREATE INDEX idx_audit_voucher
    ON audit_logs(voucher_id, created_at DESC);

CREATE INDEX idx_audit_created_at
    ON audit_logs(created_at DESC);

COMMIT;
