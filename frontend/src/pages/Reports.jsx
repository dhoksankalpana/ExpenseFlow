
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Download,
  FileText,
  RefreshCw,
  Printer,
  Search,
  TrendingUp,
  Wallet,
  CheckCircle2,
  Clock3,
  XCircle,
  FileClock,
  Building2,
  ReceiptText,
  ShieldCheck,
  UserRound,
  LogOut,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import api from "../services/api";
import "./Reports.css";

/* -------------------- HELPERS -------------------- */

const money = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  });

const dateValue = (value) => {
  if (!value) return "";

  const text = String(value);

  return /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? text
    : text.slice(0, 10);
};

const displayDate = (value) => {
  const text = dateValue(value);

  if (!text) return "—";

  const date = new Date(`${text}T12:00:00`);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
};

const normalizeStatus = (value) =>
  String(value || "draft").toLowerCase();

const statusLabel = (value) =>
  normalizeStatus(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

/* -------------------- REPORTS PAGE -------------------- */

function Reports() {
  const auth = useAuth();
  const user = auth?.user || auth?.currentUser || {};
  const navigate = useNavigate();

  const role = String(user?.role || "").toLowerCase();

  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const displayName =
    user?.display_name ||
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    user?.username ||
    user?.email ||
    "User";

  const dashboardPath =
    role === "director"
      ? "/director/dashboard"
      : role === "accounts"
        ? "/accounts/dashboard"
        : "/employee/dashboard";

  const vouchersPath =
    role === "employee"
      ? "/employee/vouchers"
      : dashboardPath;

  /* -------------------- FETCH VOUCHERS -------------------- */

  const loadVouchers = useCallback(async (signal) => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/vouchers", { signal });

      setVouchers(
        Array.isArray(response.data?.vouchers)
          ? response.data.vouchers
          : []
      );
    } catch (requestError) {
      if (
        requestError.name === "AbortError" ||
        requestError.code === "ERR_CANCELED"
      ) {
        return;
      }

      console.error("Reports fetch error:", requestError);

      setError(
        requestError.response?.data?.message ||
          requestError.response?.data?.error ||
          "Unable to load reports. Please try again."
      );
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const request = Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        return loadVouchers(controller.signal);
      }

      return undefined;
    });

    return () => {
      controller.abort();
      void request;
    };
  }, [loadVouchers]);

  /* -------------------- LOGOUT -------------------- */

  const handleLogout = async () => {
    if (typeof auth?.logout !== "function") {
      navigate("/login", { replace: true });
      return;
    }

    try {
      await auth.logout();
    } catch (logoutError) {
      console.error("Logout error:", logoutError);
    } finally {
      navigate("/login", { replace: true });
    }
  };

  /* -------------------- FILTER VOUCHERS -------------------- */

  const filteredVouchers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return vouchers.filter((voucher) => {
      const date = dateValue(voucher.expense_date);
      const status = normalizeStatus(voucher.status);

      const matchesDate =
        (!startDate || (date && date >= startDate)) &&
        (!endDate || (date && date <= endDate));

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "pending"
          ? ["submitted", "pending_approval"].includes(status)
          : status === statusFilter);

      const searchable = [
        voucher.voucher_number,
        voucher.title,
        voucher.category,
        voucher.employee_name,
        voucher.department_name,
      ];

      const matchesSearch =
        !query ||
        searchable.some((item) =>
          String(item || "").toLowerCase().includes(query)
        );

      return matchesDate && matchesStatus && matchesSearch;
    });
  }, [vouchers, startDate, endDate, statusFilter, search]);

  /* -------------------- CALCULATE STATISTICS -------------------- */

  const stats = useMemo(() => {
    const amount = (items) =>
      items.reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
      );

    const approved = filteredVouchers.filter(
      (item) => normalizeStatus(item.status) === "approved"
    );

    const pending = filteredVouchers.filter((item) =>
      ["submitted", "pending_approval"].includes(
        normalizeStatus(item.status)
      )
    );

    const rejected = filteredVouchers.filter(
      (item) => normalizeStatus(item.status) === "rejected"
    );

    const drafts = filteredVouchers.filter(
      (item) => normalizeStatus(item.status) === "draft"
    );

    return {
      total: filteredVouchers.length,
      totalAmount: amount(filteredVouchers),
      approvedCount: approved.length,
      approvedAmount: amount(approved),
      pendingCount: pending.length,
      pendingAmount: amount(pending),
      rejectedCount: rejected.length,
      draftCount: drafts.length,
    };
  }, [filteredVouchers]);

  /* -------------------- EXPORT CSV -------------------- */

  const exportCsv = () => {
    if (filteredVouchers.length === 0) return;

    const columns = [
      "Voucher Number",
      "Title",
      "Category",
      "Employee",
      "Department",
      "Expense Date",
      "Amount (INR)",
      "Status",
    ];

    const escapeCsv = (value) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`;

    const rows = filteredVouchers.map((voucher) => [
      voucher.voucher_number || voucher.id,
      voucher.title,
      voucher.category,
      voucher.employee_name,
      voucher.department_name ||
        voucher.department_id ||
        "",
      dateValue(voucher.expense_date),
      Number(voucher.amount || 0).toFixed(2),
      statusLabel(voucher.status),
    ]);

    const csv = [columns, ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = "expenseflow-report.csv";

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);
  };

  /* -------------------- CLEAR FILTERS -------------------- */

  const clearFilters = () => {
    setSearch("");
    setStartDate("");
    setEndDate("");
    setStatusFilter("all");
  };

  /* -------------------- PAGE UI -------------------- */

  return (
    <main className="reports-page">

      {/* SIDEBAR */}
      <aside className="reports-sidebar">
        <div className="reports-brand">
          <div className="reports-brand-icon">
            <ShieldCheck size={25} />
          </div>

          <div>
            <strong>ExpenseFlow</strong>
            <span>EXPENSE INTELLIGENCE</span>
          </div>
        </div>

        <div className="reports-sidebar-label">
          WORKSPACE
        </div>

        <nav
          className="reports-sidebar-nav"
          aria-label="Workspace navigation"
        >
          <Link
            to={dashboardPath}
            className="reports-nav-item"
          >
            <Building2 size={19} />
            <span>Overview</span>
          </Link>

          <Link
            to={vouchersPath}
            className="reports-nav-item"
          >
            <ReceiptText size={19} />
            <span>
              {role === "employee"
                ? "My vouchers"
                : "Voucher register"}
            </span>
          </Link>

          <Link
            to={`/${role || "employee"}/reports`}
            className="reports-nav-item active"
            aria-current="page"
          >
            <FileText size={19} />
            <span>Reports &amp; Analytics</span>
          </Link>
        </nav>

        <div className="reports-sidebar-spacer" />

        {/* USER PROFILE */}
        <div className="reports-sidebar-profile">
          <div className="reports-user-avatar">
            <UserRound size={20} />
          </div>

          <div className="reports-user-information">
            <strong>{displayName}</strong>
            <span>
              {role
                ? role.charAt(0).toUpperCase() + role.slice(1)
                : "User"}
            </span>
          </div>

          <button
            type="button"
            className="reports-logout-button"
            onClick={handleLogout}
            title="Log out"
            aria-label="Log out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {/* MAIN REPORTS CONTENT */}
      <div className="reports-main">

        {/* HEADER */}
        <header className="reports-header">
          <div className="reports-heading">
            <Link
              className="reports-back-link"
              to={dashboardPath}
            >
              <ArrowLeft size={17} />
              Dashboard
            </Link>

            <span className="reports-eyebrow">
              EXPENSEFLOW / ANALYTICS
            </span>

            <h1>Expense Reports</h1>

            <p>
              Review voucher activity and track expenses in one place.
            </p>
          </div>

          <div className="reports-header-actions">
            <button
              className="reports-button reports-button-light"
              type="button"
              onClick={() => loadVouchers()}
              disabled={loading}
            >
              <RefreshCw size={17} />
              Refresh
            </button>

            <button
              className="reports-button reports-button-light"
              type="button"
              onClick={() => window.print()}
            >
              <Printer size={17} />
              Print
            </button>

            <button
              className="reports-button reports-button-primary"
              type="button"
              onClick={exportCsv}
              disabled={loading || filteredVouchers.length === 0}
            >
              <Download size={17} />
              Export CSV
            </button>
          </div>
        </header>

        {/* ERROR MESSAGE */}
        {error && (
          <div className="reports-error" role="alert">
            <span>{error}</span>

            <button
              type="button"
              onClick={() => loadVouchers()}
            >
              Retry
            </button>
          </div>
        )}

        {/* SUMMARY CARDS */}
        <section
          className="reports-stat-grid"
          aria-label="Expense summaries"
        >
          <article className="reports-stat-card reports-stat-total">
            <div className="reports-stat-icon">
              <Wallet size={21} />
            </div>

            <span>Total expense amount</span>

            <strong>
              {loading ? "—" : money(stats.totalAmount)}
            </strong>

            <small>Across filtered vouchers</small>
          </article>

          <article className="reports-stat-card">
            <div className="reports-stat-icon">
              <FileText size={21} />
            </div>

            <span>Total vouchers</span>

            <strong>
              {loading ? "—" : stats.total}
            </strong>

            <small>Matching current filters</small>
          </article>

          <article className="reports-stat-card">
            <div className="reports-stat-icon reports-icon-approved">
              <CheckCircle2 size={21} />
            </div>

            <span>Approved expenses</span>

            <strong>
              {loading ? "—" : money(stats.approvedAmount)}
            </strong>

            <small>
              {stats.approvedCount} approved vouchers
            </small>
          </article>

          <article className="reports-stat-card">
            <div className="reports-stat-icon reports-icon-pending">
              <Clock3 size={21} />
            </div>

            <span>Pending approval</span>

            <strong>
              {loading ? "—" : money(stats.pendingAmount)}
            </strong>

            <small>
              {stats.pendingCount} pending vouchers
            </small>
          </article>
        </section>

        {/* STATUS SUMMARY */}
        <section className="reports-status-grid">
          <div className="reports-status-card">
            <FileClock size={19} />

            <div>
              <span>Draft vouchers</span>
              <strong>
                {loading ? "—" : stats.draftCount}
              </strong>
            </div>
          </div>

          <div className="reports-status-card">
            <XCircle size={19} />

            <div>
              <span>Rejected vouchers</span>
              <strong>
                {loading ? "—" : stats.rejectedCount}
              </strong>
            </div>
          </div>

          <div className="reports-status-card">
            <TrendingUp size={19} />

            <div>
              <span>Approved vouchers</span>
              <strong>
                {loading ? "—" : stats.approvedCount}
              </strong>
            </div>
          </div>
        </section>

        {/* VOUCHER REPORT TABLE */}
        <section className="reports-table-card">
          <div className="reports-table-heading">
            <div>
              <h2>Voucher report</h2>
              <p>
                Filter records before exporting or printing.
              </p>
            </div>

            <span className="reports-result-count">
              {loading
                ? "Loading…"
                : `${filteredVouchers.length} records`}
            </span>
          </div>

          {/* FILTERS */}
          <div className="reports-filters">
            <label className="reports-search">
              <Search size={17} />

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search voucher, title, employee..."
                aria-label="Search vouchers"
              />
            </label>

            <label>
              <span>From date</span>

              <input
                type="date"
                value={startDate}
                max={endDate || undefined}
                onChange={(event) =>
                  setStartDate(event.target.value)
                }
              />
            </label>

            <label>
              <span>To date</span>

              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(event) =>
                  setEndDate(event.target.value)
                }
              />
            </label>

            <label>
              <span>Status</span>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
              >
                <option value="all">All statuses</option>
                <option value="draft">Draft</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>

            <button
              type="button"
              className="reports-clear-button"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          </div>

          {/* TABLE */}
          <div className="reports-table-wrap">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Voucher</th>
                  <th>Expense</th>
                  <th>Employee</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {!loading &&
                  filteredVouchers.map((voucher) => (
                    <tr key={voucher.id}>
                      <td>
                        {voucher.voucher_number ||
                          `#${voucher.id}`}
                      </td>

                      <td>
                        <strong>
                          {voucher.title || "Untitled"}
                        </strong>

                        <small>
                          {voucher.category || "—"}
                        </small>
                      </td>

                      <td>
                        {voucher.employee_name || "—"}
                      </td>

                      <td>
                        {displayDate(voucher.expense_date)}
                      </td>

                      <td className="reports-amount">
                        {money(voucher.amount)}
                      </td>

                      <td>
                        <span
                          className={`reports-status reports-status-${normalizeStatus(
                            voucher.status
                          )}`}
                        >
                          {statusLabel(voucher.status)}
                        </span>
                      </td>
                    </tr>
                  ))}

                {!loading &&
                  filteredVouchers.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="reports-empty"
                      >
                        No vouchers match these filters.
                      </td>
                    </tr>
                  )}

                {loading && (
                  <tr>
                    <td
                      colSpan={6}
                      className="reports-empty"
                    >
                      Loading voucher reports...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* TABLE FOOTER */}
          <footer className="reports-table-footer">
            <span>
              Rejected vouchers: {stats.rejectedCount} · Draft
              vouchers: {stats.draftCount}
            </span>

            <Link
              to={vouchersPath}
              className="reports-vouchers-link"
            >
              {role === "employee"
                ? "Manage my vouchers"
                : "Back to dashboard"}
            </Link>
          </footer>
        </section>
      </div>
    </main>
  );
}

export default Reports;
