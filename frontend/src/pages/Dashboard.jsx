
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Building2,
  CheckCircle,
  ClipboardCheck,
  Clock,
  Eye,
  FileText,
  IndianRupee,
  LogOut,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  Wallet,
  X,
  XCircle,
} from "lucide-react";

import { useAuth } from "../context/useAuth";
import api from "../services/api";
import "./Dashboard.css";

const MAX_SIGNATURE_SIZE = 2 * 1024 * 1024;
const ALLOWED_SIGNATURE_TYPES = ["image/png", "image/jpeg"];

const STATUS_OPTIONS = [
  "all",
  "draft",
  "submitted",
  "approved",
  "rejected",
];

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

function formatCurrency(value) {
  return currencyFormatter.format(Number(value) || 0);
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getRows(data, key) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[key])) return data[key];
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.[key])) return data.data[key];

  return [];
}

function getVoucherId(voucher) {
  return voucher?.id ?? voucher?.voucher_id;
}

function getVoucherTitle(voucher) {
  return voucher?.title || voucher?.voucher_title || "Untitled voucher";
}

function getEmployeeName(voucher) {
  return (
    voucher?.employee_name ||
    voucher?.employee_display_name ||
    voucher?.employee?.display_name ||
    voucher?.employee?.name ||
    voucher?.employee_email ||
    "Employee"
  );
}

function getDepartmentName(voucher) {
  return (
    voucher?.department_name ||
    voucher?.department?.name ||
    voucher?.department ||
    "—"
  );
}

function StatusBadge({ status }) {
  const normalizedStatus = String(status || "draft").toLowerCase();
  const statusClass = normalizedStatus.replace(/\s+/g, "-");

  return (
    <span className={`dashboard-status status-${statusClass}`}>
      {normalizedStatus}
    </span>
  );
}

function SummaryCard({ icon: Icon, label, value, description }) {
  return (
    <article className="dashboard-summary-card">
      <div className="dashboard-summary-icon">
        <Icon size={21} />
      </div>

      <div className="dashboard-summary-content">
        <p>{label}</p>
        <h3>{value}</h3>
        {description && <span>{description}</span>}
      </div>
    </article>
  );
}

function EmptyState({ message }) {
  return (
    <div className="dashboard-empty-state">
      <ReceiptText size={32} />
      <p>{message}</p>
    </div>
  );
}

function VoucherDetailsModal({ voucher, onClose }) {
  const [history, setHistory] = useState([]);
  const [historyError, setHistoryError] = useState("");

  const voucherId = getVoucherId(voucher);

  useEffect(() => {
    let cancelled = false;

    async function loadDetails() {
      try {
        const response = await api.get(`/vouchers/${voucherId}`);

        if (cancelled) return;

        const data = response.data?.voucher || response.data;
        const approvalHistory =
          data?.approval_history ||
          data?.approvals ||
          data?.voucher_approvals ||
          [];

        setHistory(
          Array.isArray(approvalHistory) ? approvalHistory : []
        );
      } catch {
        if (!cancelled) {
          setHistoryError("Approval history could not be loaded.");
        }
      }
    }

    const timer = setTimeout(() => {
      void loadDetails();
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [voucherId]);

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleEscape);

    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div
      className="dashboard-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="dashboard-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="voucher-details-title"
      >
        <div className="dashboard-modal-header">
          <div>
            <p className="dashboard-eyebrow">VOUCHER DETAILS</p>
            <h2 id="voucher-details-title">
              {getVoucherTitle(voucher)}
            </h2>
          </div>

          <button
            type="button"
            className="dashboard-icon-button"
            onClick={onClose}
            aria-label="Close voucher details"
          >
            <X size={20} />
          </button>
        </div>

        <div className="dashboard-details-grid">
          <div>
            <span>Voucher ID</span>
            <strong>
              {voucher.voucher_number || `#${voucherId}`}
            </strong>
          </div>

          <div>
            <span>Amount</span>
            <strong>{formatCurrency(voucher.amount)}</strong>
          </div>

          <div>
            <span>Category</span>
            <strong>{voucher.category || "—"}</strong>
          </div>

          <div>
            <span>Status</span>
            <StatusBadge status={voucher.status} />
          </div>

          <div>
            <span>Employee</span>
            <strong>{getEmployeeName(voucher)}</strong>
          </div>

          <div>
            <span>Department</span>
            <strong>{getDepartmentName(voucher)}</strong>
          </div>

          <div>
            <span>Expense date</span>
            <strong>{formatDate(voucher.expense_date)}</strong>
          </div>

          <div>
            <span>Created</span>
            <strong>{formatDate(voucher.created_at)}</strong>
          </div>
        </div>

        <div className="dashboard-details-description">
          <h3>Description</h3>
          <p>{voucher.description || "No description provided."}</p>
        </div>

        {voucher.rejection_reason && (
          <div className="dashboard-details-description">
            <h3>Rejection reason</h3>
            <p>{voucher.rejection_reason}</p>
          </div>
        )}

        <div className="dashboard-approval-history">
          <h3>Approval history</h3>

          {historyError && (
            <p className="dashboard-muted-text" role="alert">
              {historyError}
            </p>
          )}

          {!historyError && history.length === 0 ? (
            <p className="dashboard-muted-text">
              No approval history is available yet.
            </p>
          ) : (
            history.map((entry, index) => (
              <div
                className="dashboard-history-entry"
                key={entry.id || `${entry.action || entry.status}-${index}`}
              >
                <div>
                  <strong>
                    {String(entry.action || entry.status || "Updated")
                      .replaceAll("_", " ")
                      .replace(/\b\w/g, (letter) =>
                        letter.toUpperCase()
                      )}
                  </strong>

                  <p>
                    {entry.notes ||
                      entry.rejection_reason ||
                      entry.comments ||
                      "No additional notes."}
                  </p>
                </div>

                <span>
                  {formatDate(entry.created_at || entry.action_date)}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function SignatureImage({ voucherId, kind, label }) {
  const [imageError, setImageError] = useState(false);

  const imageUrl = `${
    import.meta.env.VITE_API_URL || "http://localhost:5000/api"
  }/vouchers/${voucherId}/signatures/${kind}`;

  return (
    <div className="dashboard-signature-card">
      <h4>{label}</h4>

      {imageError ? (
        <p className="dashboard-muted-text">
          Signature image is not available.
        </p>
      ) : (
        <img
          src={imageUrl}
          alt={label}
          className="dashboard-signature-image"
          onError={() => setImageError(true)}
        />
      )}
    </div>
  );
}

function VoucherSignatures({ voucher }) {
  const voucherId = getVoucherId(voucher);

  return (
    <div className="dashboard-signatures">
      {voucher.employee_signature_path && (
        <SignatureImage
          voucherId={voucherId}
          kind="employee"
          label="Employee signature"
        />
      )}

      {voucher.director_signature_path && (
        <SignatureImage
          voucherId={voucherId}
          kind="director"
          label="Director signature"
        />
      )}
    </div>
  );
}

function DirectorReviewPanel({
  voucher,
  onClose,
  onDecision,
  saving,
}) {
  const [signatureFile, setSignatureFile] = useState(null);
  const [signaturePreview, setSignaturePreview] = useState("");
  const [notes, setNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [signatureError, setSignatureError] = useState("");
  const [decisionError, setDecisionError] = useState("");

  useEffect(() => {
    if (!signatureFile) return undefined;

    let cancelled = false;
    const reader = new FileReader();

    reader.onload = () => {
      if (!cancelled && typeof reader.result === "string") {
        setSignaturePreview(reader.result);
      }
    };

    reader.onerror = () => {
      if (!cancelled) {
        setSignatureError(
          "Could not preview this image. Please try another."
        );
      }
    };

    reader.readAsDataURL(signatureFile);

    return () => {
      cancelled = true;
      reader.abort();
    };
  }, [signatureFile]);

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === "Escape" && !saving) onClose();
    }

    window.addEventListener("keydown", handleEscape);

    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose, saving]);

  function handleSignatureChange(event) {
    const file = event.target.files?.[0] || null;

    setSignatureFile(null);
    setSignaturePreview("");
    setSignatureError("");
    setDecisionError("");

    if (!file) return;

    if (!ALLOWED_SIGNATURE_TYPES.includes(file.type)) {
      setSignatureError("Please select a PNG or JPEG image.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_SIGNATURE_SIZE) {
      setSignatureError(
        "The signature image must be 2 MB or smaller."
      );
      event.target.value = "";
      return;
    }

    setSignatureFile(file);
  }

  async function handleApprove(event) {
    event.preventDefault();
    setDecisionError("");

    if (!signatureFile) {
      setSignatureError(
        "Upload your signature before approving this voucher."
      );
      return;
    }

    try {
      const formData = new FormData();
      formData.append("signature", signatureFile);

      if (notes.trim()) {
        formData.append("notes", notes.trim());
      }

      await onDecision("approve", getVoucherId(voucher), formData);
    } catch (error) {
      setDecisionError(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Unable to approve the voucher. Please try again."
      );
    }
  }

  async function handleReject(event) {
    event.preventDefault();
    setDecisionError("");

    if (!rejectionReason.trim()) {
      setDecisionError(
        "Please provide a reason for rejecting this voucher."
      );
      return;
    }

    try {
      await onDecision("reject", getVoucherId(voucher), {
        rejectionReason: rejectionReason.trim(),
        notes: notes.trim(),
      });
    } catch (error) {
      setDecisionError(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Unable to reject the voucher. Please try again."
      );
    }
  }

  return (
    <div
      className="dashboard-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) {
          onClose();
        }
      }}
    >
      <section
        className="dashboard-modal dashboard-review-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-voucher-title"
      >
        <div className="dashboard-modal-header">
          <div>
            <p className="dashboard-eyebrow">DIRECTOR REVIEW</p>
            <h2 id="review-voucher-title">
              {getVoucherTitle(voucher)}
            </h2>
            <p className="dashboard-muted-text">
              Voucher #{getVoucherId(voucher)}
            </p>
          </div>

          <button
            type="button"
            className="dashboard-icon-button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close review"
          >
            <X size={20} />
          </button>
        </div>

        <div className="dashboard-details-grid">
          <div>
            <span>Employee</span>
            <strong>{getEmployeeName(voucher)}</strong>
          </div>

          <div>
            <span>Department</span>
            <strong>{getDepartmentName(voucher)}</strong>
          </div>

          <div>
            <span>Category</span>
            <strong>{voucher.category || "—"}</strong>
          </div>

          <div>
            <span>Amount</span>
            <strong>{formatCurrency(voucher.amount)}</strong>
          </div>

          <div>
            <span>Expense date</span>
            <strong>{formatDate(voucher.expense_date)}</strong>
          </div>
        </div>

        <div className="dashboard-details-description">
          <h3>Description</h3>
          <p>{voucher.description || "No description provided."}</p>
        </div>

        <VoucherSignatures voucher={voucher} />

        <form onSubmit={handleApprove} className="dashboard-review-form">
          <label htmlFor="director-signature">
            Director signature <span aria-hidden="true">*</span>
          </label>

          <input
            id="director-signature"
            type="file"
            accept="image/png,image/jpeg"
            onChange={handleSignatureChange}
            disabled={saving}
          />

          <p className="dashboard-field-hint">
            Upload a PNG or JPEG image, maximum 2 MB.
          </p>

          {signatureError && (
            <p className="dashboard-error-text" role="alert">
              {signatureError}
            </p>
          )}

          {signaturePreview && (
            <div className="dashboard-signature-preview">
              <span>Signature preview</span>
              <img
                src={signaturePreview}
                alt="Director signature preview"
              />
            </div>
          )}

          <label htmlFor="director-notes">Notes (optional)</label>

          <textarea
            id="director-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Add comments about this voucher..."
            rows={3}
            maxLength={2000}
            disabled={saving}
          />

          <div className="dashboard-review-actions">
            <button
              type="submit"
              className="dashboard-primary-button"
              disabled={saving}
            >
              <CheckCircle size={17} />
              {saving ? "Processing..." : "Approve voucher"}
            </button>
          </div>
        </form>

        <form onSubmit={handleReject} className="dashboard-reject-form">
          <label htmlFor="rejection-reason">
            Rejection reason <span aria-hidden="true">*</span>
          </label>

          <textarea
            id="rejection-reason"
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
            placeholder="Explain why this voucher should be rejected..."
            rows={3}
            maxLength={2000}
            disabled={saving}
          />

          <button
            type="submit"
            className="dashboard-danger-button"
            disabled={saving}
          >
            <XCircle size={17} />
            {saving ? "Processing..." : "Reject voucher"}
          </button>
        </form>

        {decisionError && (
          <p className="dashboard-error-text" role="alert">
            {decisionError}
          </p>
        )}
      </section>
    </div>
  );
}

function VoucherTable({
  vouchers,
  onView,
  onReview,
  showEmployee = false,
  showReviewAction = false,
}) {
  if (vouchers.length === 0) {
    return (
      <EmptyState message="No vouchers match your current filters." />
    );
  }

  return (
    <div className="dashboard-table-wrapper">
      <table className="dashboard-table">
        <thead>
          <tr>
            <th>Voucher</th>
            {showEmployee && <th>Employee</th>}
            <th>Category</th>
            <th>Amount</th>
            <th>Expense date</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {vouchers.map((voucher) => (
            <tr key={getVoucherId(voucher)}>
              <td>
                <strong>{getVoucherTitle(voucher)}</strong>
                <span className="dashboard-table-subtitle">
                  {voucher.voucher_number || `#${getVoucherId(voucher)}`}
                </span>
              </td>

              {showEmployee && (
                <td>
                  <span>{getEmployeeName(voucher)}</span>
                  <span className="dashboard-table-subtitle">
                    {getDepartmentName(voucher)}
                  </span>
                </td>
              )}

              <td>{voucher.category || "—"}</td>

              <td className="dashboard-amount">
                {formatCurrency(voucher.amount)}
              </td>

              <td>{formatDate(voucher.expense_date)}</td>

              <td>
                <StatusBadge status={voucher.status} />
              </td>

              <td>
                <div className="dashboard-table-actions">
                  <button
                    type="button"
                    className="dashboard-icon-button"
                    onClick={() => onView(voucher)}
                    title="View voucher details"
                    aria-label={`View ${getVoucherTitle(voucher)}`}
                  >
                    <Eye size={17} />
                  </button>

                  {showReviewAction &&
                    String(voucher.status).toLowerCase() === "submitted" && (
                      <button
                        type="button"
                        className="dashboard-small-button"
                        onClick={() => onReview(voucher)}
                      >
                        Review
                      </button>
                    )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const auth = useAuth();

  const user = auth?.user || auth?.currentUser || {};
  const role = String(user.role || "").toLowerCase();

  const isDirector = role === "director";
  const isAccounts = role === "accounts";
  const isEmployee = role === "employee";

  const hasRecognizedRole = isDirector || isAccounts || isEmployee;

  const roleLabel = isDirector
    ? "Director"
    : isAccounts
      ? "Accounts"
      : isEmployee
        ? "Employee"
        : role
          ? role.charAt(0).toUpperCase() + role.slice(1)
          : "User";

  const displayName =
    user.display_name ||
    [user.first_name, user.last_name].filter(Boolean).join(" ") ||
    user.fullName ||
    user.full_name ||
    user.username ||
    user.email ||
    roleLabel;

  const firstName = displayName.trim().split(/\s+/)[0] || "there";

  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(hasRecognizedRole);
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(
    isDirector ? "submitted" : "all"
  );
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [reviewVoucher, setReviewVoucher] = useState(null);
  const [decisionLoading, setDecisionLoading] = useState(false);

  const loadVouchers = useCallback(async () => {
    setLoading(true);
    setPageError("");

    try {
      const response = await api.get("/vouchers");
      setVouchers(getRows(response.data, "vouchers"));
    } catch (error) {
      setPageError(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Could not load vouchers. Please refresh and try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasRecognizedRole) return undefined;

    const timer = setTimeout(() => {
      void loadVouchers();
    }, 0);

    return () => clearTimeout(timer);
  }, [hasRecognizedRole, loadVouchers]);

  const pendingVouchers = useMemo(
    () =>
      vouchers.filter(
        (voucher) => String(voucher.status).toLowerCase() === "submitted"
      ),
    [vouchers]
  );

  const approvedVouchers = useMemo(
    () =>
      vouchers.filter(
        (voucher) => String(voucher.status).toLowerCase() === "approved"
      ),
    [vouchers]
  );

  const rejectedVouchers = useMemo(
    () =>
      vouchers.filter(
        (voucher) => String(voucher.status).toLowerCase() === "rejected"
      ),
    [vouchers]
  );

  const draftVouchers = useMemo(
    () =>
      vouchers.filter(
        (voucher) => String(voucher.status).toLowerCase() === "draft"
      ),
    [vouchers]
  );

  const totalApprovedAmount = useMemo(
    () =>
      approvedVouchers.reduce(
        (total, voucher) => total + (Number(voucher.amount) || 0),
        0
      ),
    [approvedVouchers]
  );

  const filteredVouchers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return vouchers.filter((voucher) => {
      const matchesStatus =
        statusFilter === "all" ||
        String(voucher.status).toLowerCase() === statusFilter;

      const searchableText = [
        getVoucherTitle(voucher),
        voucher.category,
        voucher.description,
        getEmployeeName(voucher),
        getDepartmentName(voucher),
        voucher.id,
        voucher.voucher_id,
        voucher.voucher_number,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesStatus && (!query || searchableText.includes(query));
    });
  }, [vouchers, search, statusFilter]);

  async function handleDecision(action, voucherId, payload) {
    if (decisionLoading) return;

    setDecisionLoading(true);
    setPageError("");
    setNotice("");

    try {
      if (action === "approve") {
        await api.post(`/vouchers/${voucherId}/approve`, payload);
      } else {
        await api.post(`/vouchers/${voucherId}/reject`, payload);
      }

      setReviewVoucher(null);

      await loadVouchers();

      setNotice(
        action === "approve"
          ? "Voucher approved successfully."
          : "Voucher rejected successfully."
      );
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        `Could not ${action} this voucher. Please try again.`;

      setPageError(message);
      throw error;
    } finally {
      setDecisionLoading(false);
    }
  }

  function handleLogout() {
    if (typeof auth?.logout === "function") {
      void Promise.resolve(auth.logout()).finally(() => {
        navigate("/login", { replace: true });
      });
    } else {
      navigate("/login", { replace: true });
    }
  }

  function scrollToVoucherRegister() {
    document
      .getElementById("voucher-register")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className={`dashboard-page dashboard-role-${role || "user"}`}>
      <aside className="dashboard-sidebar">
        <div className="dashboard-brand">
          <div className="dashboard-brand-icon">
            <ShieldCheck size={25} />
          </div>

          <div>
            <strong>ExpenseFlow</strong>
            <span>EXPENSE INTELLIGENCE</span>
          </div>
        </div>

        <div className="dashboard-sidebar-label">WORKSPACE</div>

        <nav className="dashboard-nav" aria-label="Dashboard navigation">
          <button
            type="button"
            className="dashboard-nav-item active"
            onClick={() => navigate(`/${role}/dashboard`)}
          >
            <Building2 size={19} />
            <span>Overview</span>
          </button>

          <button
            type="button"
            className="dashboard-nav-item"
            onClick={() =>
              isEmployee
                ? navigate("/employee/vouchers")
                : scrollToVoucherRegister()
            }
          >
            <ReceiptText size={19} />
            <span>
              {isEmployee ? "My vouchers" : "Voucher register"}
            </span>
          </button>

          <button
            type="button"
            className="dashboard-nav-item"
            onClick={() => void loadVouchers()}
            disabled={loading}
          >
            <RefreshCw size={19} />
            <span>Refresh data</span>
          </button>

          {/* NEW: Reports & Analytics sidebar button */}
          <button
            type="button"
            className="dashboard-nav-item"
            onClick={() => navigate(`/${role}/reports`)}
          >
            <FileText size={19} />
            <span>Reports &amp; Analytics</span>
          </button>
        </nav>

        <div className="dashboard-sidebar-spacer" />

        <div className="dashboard-sidebar-help">
          <div className="dashboard-help-icon">
            <ShieldCheck size={22} />
          </div>

          <strong>Secure workflow</strong>
          <p>Your workspace is protected by role-based access.</p>
        </div>

        <div className="dashboard-sidebar-profile">
          <div className="dashboard-user-avatar">
            <UserRound size={20} />
          </div>

          <div className="dashboard-user-information">
            <strong>{displayName}</strong>
            <span>{roleLabel}</span>
          </div>

          <button
            type="button"
            className="dashboard-logout-icon"
            onClick={handleLogout}
            aria-label="Log out"
            title="Log out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="dashboard-breadcrumb">
            <span>Workspace</span>
            <span className="dashboard-breadcrumb-divider">/</span>
            <strong>Overview</strong>
          </div>

          <div className="dashboard-topbar-right">
            <span className="dashboard-live-indicator">
              <span />
              Live workspace
            </span>

            <div className="dashboard-topbar-avatar">
              <UserRound size={18} />
            </div>
          </div>
        </header>

        <div className="dashboard-content">
          <section className="dashboard-welcome-banner">
            <div className="dashboard-welcome-copy">
              <p className="dashboard-eyebrow">
                {isDirector
                  ? "APPROVAL COMMAND CENTER"
                  : isAccounts
                    ? "FINANCE & CONTROL"
                    : "YOUR EXPENSE WORKSPACE"}
              </p>

              <h1>
                {isAccounts ? "Finance overview." : `Hello, ${firstName}.`}
              </h1>

              <p>
                {isDirector
                  ? "Every approval in one place. Review details, verify signatures, and keep expenses moving."
                  : isAccounts
                    ? "A clear picture of company expenses, approvals, and voucher activity."
                    : "Stay on top of your expenses from the first draft to final approval."}
              </p>

              <div className="dashboard-welcome-actions">
                {isEmployee && (
                  <button
                    type="button"
                    className="dashboard-banner-button"
                    onClick={() => navigate("/employee/vouchers")}
                  >
                    <ReceiptText size={17} />
                    Manage my vouchers
                  </button>
                )}

                <button
                  type="button"
                  className="dashboard-banner-refresh"
                  onClick={() => void loadVouchers()}
                  disabled={loading}
                >
                  <RefreshCw
                    size={16}
                    className={loading ? "dashboard-spinning" : ""}
                  />
                  {loading ? "Refreshing..." : "Refresh overview"}
                </button>
              </div>
            </div>

            <div className="dashboard-banner-art" aria-hidden="true">
              <div className="dashboard-art-orbit dashboard-art-orbit-one" />
              <div className="dashboard-art-orbit dashboard-art-orbit-two" />

              <div className="dashboard-art-document">
                <div className="dashboard-art-document-icon">
                  <ReceiptText size={27} />
                </div>
                <span className="dashboard-art-line long" />
                <span className="dashboard-art-line" />
                <span className="dashboard-art-line short" />

                <div className="dashboard-art-check">
                  <CheckCircle size={25} />
                </div>
              </div>

              <div className="dashboard-art-floating dashboard-art-coin">
                <IndianRupee size={20} />
              </div>

              <div className="dashboard-art-floating dashboard-art-shield">
                <ShieldCheck size={22} />
              </div>
            </div>
          </section>

          {notice && (
            <div
              className="dashboard-alert dashboard-alert-success"
              role="status"
            >
              <CheckCircle size={19} />
              <span>{notice}</span>
              <button
                type="button"
                onClick={() => setNotice("")}
                aria-label="Dismiss notification"
              >
                <X size={17} />
              </button>
            </div>
          )}

          {pageError && (
            <div
              className="dashboard-alert dashboard-alert-error"
              role="alert"
            >
              <AlertCircle size={19} />
              <span>{pageError}</span>
              <button
                type="button"
                onClick={() => setPageError("")}
                aria-label="Dismiss error"
              >
                <X size={17} />
              </button>
            </div>
          )}

          {isDirector && (
            <>
              <div className="dashboard-section-heading">
                <div>
                  <span className="dashboard-section-kicker">AT A GLANCE</span>
                  <h2>Approval performance</h2>
                  <p>Monitor your team's voucher decisions.</p>
                </div>

                <span className="dashboard-role-chip">
                  <ShieldCheck size={15} />
                  Director access
                </span>
              </div>

              <section className="dashboard-summary-grid">
                <SummaryCard
                  icon={Clock}
                  label="Awaiting review"
                  value={pendingVouchers.length}
                  description="Require your attention"
                />
                <SummaryCard
                  icon={CheckCircle}
                  label="Approved"
                  value={approvedVouchers.length}
                  description="Completed decisions"
                />
                <SummaryCard
                  icon={XCircle}
                  label="Rejected"
                  value={rejectedVouchers.length}
                  description="Returned or declined"
                />
                <SummaryCard
                  icon={IndianRupee}
                  label="Approved amount"
                  value={formatCurrency(totalApprovedAmount)}
                  description="Total approved expenses"
                />
              </section>

              <section className="dashboard-panel">
                <div className="dashboard-panel-header">
                  <div>
                    <span className="dashboard-section-kicker">ACTION REQUIRED</span>
                    <h2>Pending approvals</h2>
                    <p>
                      Review submitted expenses and record your decision.
                    </p>
                  </div>
                  <span className="dashboard-count-pill">
                    {pendingVouchers.length} pending
                  </span>
                </div>

                {loading ? (
                  <EmptyState message="Loading vouchers..." />
                ) : (
                  <VoucherTable
                    vouchers={pendingVouchers}
                    onView={setSelectedVoucher}
                    onReview={setReviewVoucher}
                    showEmployee
                    showReviewAction
                  />
                )}
              </section>

              <section className="dashboard-panel" id="voucher-register">
                <div className="dashboard-panel-header">
                  <div>
                    <span className="dashboard-section-kicker">FULL REGISTER</span>
                    <h2>All vouchers</h2>
                    <p>
                      Search and inspect vouchers across the organisation.
                    </p>
                  </div>
                </div>

                <div className="dashboard-filters">
                  <div className="dashboard-search">
                    <Search size={18} />
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search voucher, employee, or department..."
                      aria-label="Search vouchers"
                    />
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    aria-label="Filter vouchers by status"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option value={status} key={status}>
                        {status === "all"
                          ? "All statuses"
                          : status.charAt(0).toUpperCase() + status.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                {loading ? (
                  <EmptyState message="Loading vouchers..." />
                ) : (
                  <VoucherTable
                    vouchers={filteredVouchers}
                    onView={setSelectedVoucher}
                    onReview={setReviewVoucher}
                    showEmployee
                    showReviewAction
                  />
                )}
              </section>
            </>
          )}

          {isAccounts && (
            <>
              <div className="dashboard-section-heading">
                <div>
                  <span className="dashboard-section-kicker">FINANCIAL SNAPSHOT</span>
                  <h2>Company expense activity</h2>
                  <p>
                    A live overview of voucher processing and approved spend.
                  </p>
                </div>

                <span className="dashboard-role-chip accounts-chip">
                  <Wallet size={15} />
                  Accounts access
                </span>
              </div>

              <section className="dashboard-summary-grid">
                <SummaryCard
                  icon={ReceiptText}
                  label="Total vouchers"
                  value={vouchers.length}
                  description="All visible records"
                />
                <SummaryCard
                  icon={Clock}
                  label="Pending review"
                  value={pendingVouchers.length}
                  description="Awaiting director decision"
                />
                <SummaryCard
                  icon={CheckCircle}
                  label="Approved vouchers"
                  value={approvedVouchers.length}
                  description="Cleared by the director"
                />
                <SummaryCard
                  icon={IndianRupee}
                  label="Approved amount"
                  value={formatCurrency(totalApprovedAmount)}
                  description="Total approved expenses"
                />
              </section>

              <section className="dashboard-panel" id="voucher-register">
                <div className="dashboard-panel-header">
                  <div>
                    <span className="dashboard-section-kicker">ORGANISATION-WIDE</span>
                    <h2>Voucher register</h2>
                    <p>
                      Search, filter, and inspect vouchers across their lifecycle.
                    </p>
                  </div>
                </div>

                <div className="dashboard-filters">
                  <div className="dashboard-search">
                    <Search size={18} />
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search voucher, employee, or department..."
                      aria-label="Search vouchers"
                    />
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    aria-label="Filter vouchers by status"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option value={status} key={status}>
                        {status === "all"
                          ? "All statuses"
                          : status.charAt(0).toUpperCase() + status.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                {loading ? (
                  <EmptyState message="Loading vouchers..." />
                ) : (
                  <VoucherTable
                    vouchers={filteredVouchers}
                    onView={setSelectedVoucher}
                    showEmployee
                  />
                )}
              </section>

              <section className="dashboard-panel">
                <div className="dashboard-panel-header">
                  <div>
                    <span className="dashboard-section-kicker">LATEST ACTIVITY</span>
                    <h2>Recently approved</h2>
                    <p>Vouchers that have completed director approval.</p>
                  </div>
                </div>

                {loading ? (
                  <EmptyState message="Loading approved vouchers..." />
                ) : (
                  <VoucherTable
                    vouchers={[...approvedVouchers]
                      .sort(
                        (a, b) =>
                          new Date(b.approval_date || b.updated_at || 0) -
                          new Date(a.approval_date || a.updated_at || 0)
                      )
                      .slice(0, 5)}
                    onView={setSelectedVoucher}
                    showEmployee
                  />
                )}
              </section>

              <section className="dashboard-panel dashboard-quick-info">
                <div className="dashboard-panel-header">
                  <div>
                    <span className="dashboard-section-kicker">PROCESS TRACKER</span>
                    <h2>Workflow overview</h2>
                    <p>Understand the current voucher pipeline.</p>
                  </div>
                </div>

                <div className="dashboard-workflow-grid">
                  <div>
                    <FileText size={20} />
                    <span>Drafts</span>
                    <strong>{draftVouchers.length}</strong>
                  </div>
                  <div>
                    <ClipboardCheck size={20} />
                    <span>Submitted</span>
                    <strong>{pendingVouchers.length}</strong>
                  </div>
                  <div>
                    <CheckCircle size={20} />
                    <span>Approved</span>
                    <strong>{approvedVouchers.length}</strong>
                  </div>
                  <div>
                    <XCircle size={20} />
                    <span>Rejected</span>
                    <strong>{rejectedVouchers.length}</strong>
                  </div>
                  <div>
                    <Building2 size={20} />
                    <span>Departments</span>
                    <strong>
                      {
                        new Set(
                          vouchers
                            .map(getDepartmentName)
                            .filter((name) => name !== "—")
                        ).size
                      }
                    </strong>
                  </div>
                </div>
              </section>
            </>
          )}

          {isEmployee && (
            <>
              <div className="dashboard-section-heading">
                <div>
                  <span className="dashboard-section-kicker">MY EXPENSES</span>
                  <h2>Your voucher activity</h2>
                  <p>
                    Follow your expenses through every stage of review.
                  </p>
                </div>

                <span className="dashboard-role-chip">
                  <UserRound size={15} />
                  Employee access
                </span>
              </div>

              <section className="dashboard-summary-grid">
                <SummaryCard
                  icon={ReceiptText}
                  label="My vouchers"
                  value={vouchers.length}
                  description="Total voucher records"
                />
                <SummaryCard
                  icon={FileText}
                  label="Drafts"
                  value={draftVouchers.length}
                  description="Not yet submitted"
                />
                <SummaryCard
                  icon={Clock}
                  label="Awaiting approval"
                  value={pendingVouchers.length}
                  description="Submitted for review"
                />
                <SummaryCard
                  icon={CheckCircle}
                  label="Approved"
                  value={approvedVouchers.length}
                  description="Approved vouchers"
                />
              </section>

              <section className="dashboard-panel" id="voucher-register">
                <div className="dashboard-panel-header">
                  <div>
                    <span className="dashboard-section-kicker">RECENT RECORDS</span>
                    <h2>My recent vouchers</h2>
                    <p>Your five most recent expense records.</p>
                  </div>

                  <button
                    type="button"
                    className="dashboard-primary-button"
                    onClick={() => navigate("/employee/vouchers")}
                  >
                    <ReceiptText size={17} />
                    View all
                  </button>
                </div>

                {loading ? (
                  <EmptyState message="Loading your vouchers..." />
                ) : (
                  <VoucherTable
                    vouchers={[...vouchers]
                      .sort(
                        (a, b) =>
                          new Date(b.created_at || 0) -
                          new Date(a.created_at || 0)
                      )
                      .slice(0, 5)}
                    onView={setSelectedVoucher}
                  />
                )}
              </section>
            </>
          )}

          {!hasRecognizedRole && (
            <section className="dashboard-panel">
              <div className="dashboard-empty-state">
                <ShieldCheck size={34} />
                <h2>Role not recognized</h2>
                <p>
                  Your account does not have a recognized dashboard role.
                  Please contact your administrator.
                </p>
              </div>
            </section>
          )}

          <footer className="dashboard-footer">
            <span>ExpenseFlow</span>
            <span>Expense visibility. Accountable decisions.</span>
          </footer>
        </div>
      </div>

      {selectedVoucher && (
        <VoucherDetailsModal
          voucher={selectedVoucher}
          onClose={() => setSelectedVoucher(null)}
        />
      )}

      {reviewVoucher && (
        <DirectorReviewPanel
          voucher={reviewVoucher}
          onClose={() => {
            if (!decisionLoading) {
              setReviewVoucher(null);
            }
          }}
          onDecision={handleDecision}
          saving={decisionLoading}
        />
      )}
    </main>
  );
}

export default Dashboard;
