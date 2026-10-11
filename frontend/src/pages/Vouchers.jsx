
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  FilePlus2,
  LoaderCircle,
  Pencil,
  RefreshCw,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import api from "../services/api";
import "./Vouchers.css";

const CATEGORIES = [
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

function getLocalDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

const INITIAL_FORM = {
  title: "",
  category: "Travel",
  amount: "",
  expense_date: getLocalDate(),
  department_id: "",
  description: "",
};

function getErrorMessage(error) {
  const data = error?.response?.data;

  if (typeof data === "string" && data.trim()) {
    return data;
  }

  if (Array.isArray(data?.errors)) {
    const messages = data.errors
      .map((item) => {
        if (typeof item === "string") return item;

        const field = Array.isArray(item.path)
          ? item.path.join(".")
          : item.path || item.field || "";

        const message = item.message || item.msg || "";

        return [field, message].filter(Boolean).join(": ");
      })
      .filter(Boolean);

    if (messages.length) return messages.join("; ");
  }

  if (Array.isArray(data?.issues)) {
    const messages = data.issues
      .map((item) => {
        const field = Array.isArray(item.path)
          ? item.path.join(".")
          : item.path || "";

        return [field, item.message].filter(Boolean).join(": ");
      })
      .filter(Boolean);

    if (messages.length) return messages.join("; ");
  }

  if (Array.isArray(data?.details)) {
    const messages = data.details
      .map((item) =>
        typeof item === "string" ? item : item.message || JSON.stringify(item)
      )
      .filter(Boolean);

    if (messages.length) return messages.join("; ");
  }

  if (typeof data?.message === "string" && data.message.trim()) {
    return data.message;
  }

  if (typeof data?.error === "string" && data.error.trim()) {
    return data.error;
  }

  if (data && typeof data === "object") {
    return JSON.stringify(data);
  }

  if (error?.code === "ERR_NETWORK") {
    return "Unable to connect to the server. Check that the backend is running.";
  }

  return error?.message || "Something went wrong. Please try again.";
}

function formatDate(value) {
  if (!value) return "—";

  // Date-only database values should not shift to the previous day.
  const dateString = String(value);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateString)
    ? new Date(`${dateString}T12:00:00`)
    : new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatAmount(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) return "₹0.00";

  return amount.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  });
}

function getStatusClass(status) {
  const value = String(status || "draft").toLowerCase();

  if (value === "approved") return "approved";
  if (value === "rejected") return "rejected";

  if (["submitted", "pending_approval"].includes(value)) {
    return "submitted";
  }

  return "draft";
}

function getDepartmentName(voucher) {
  return (
    voucher?.department_name ||
    voucher?.departmentName ||
    (typeof voucher?.department === "string" ? voucher.department : null) ||
    (voucher?.department_id
      ? `Department ${voucher.department_id}`
      : "—")
  );
}

function Vouchers() {
  const navigate = useNavigate();

  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showForm, setShowForm] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState(null);
  const [form, setForm] = useState({ ...INITIAL_FORM });
  const [saving, setSaving] = useState(false);
  const [deletingVoucherId, setDeletingVoucherId] = useState(null);

  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [voucherToSubmit, setVoucherToSubmit] = useState(null);
  const [submittingVoucherId, setSubmittingVoucherId] = useState(null);
  const [signatureFile, setSignatureFile] = useState(null);
  const [signaturePreview, setSignaturePreview] = useState("");
  const [signatureError, setSignatureError] = useState("");

  const signatureInputRef = useRef(null);
  const signatureObjectUrlRef = useRef("");

  const [detailsVoucher, setDetailsVoucher] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");

  const clearSignature = useCallback(() => {
    if (signatureObjectUrlRef.current) {
      URL.revokeObjectURL(signatureObjectUrlRef.current);
      signatureObjectUrlRef.current = "";
    }

    setSignatureFile(null);
    setSignaturePreview("");
    setSignatureError("");

    if (signatureInputRef.current) {
      signatureInputRef.current.value = "";
    }
  }, []);

  useEffect(() => {
    return () => {
      if (signatureObjectUrlRef.current) {
        URL.revokeObjectURL(signatureObjectUrlRef.current);
      }
    };
  }, []);

  const fetchVouchers = useCallback(async (signal) => {
    try {
      const response = await api.get("/vouchers", { signal });

      setVouchers(
        Array.isArray(response.data?.vouchers)
          ? response.data.vouchers
          : []
      );

      setError("");
    } catch (requestError) {
      if (
        requestError.name === "AbortError" ||
        requestError.code === "ERR_CANCELED"
      ) {
        return;
      }

      console.error("Fetch vouchers error:", requestError);
      console.error(
        "Fetch vouchers backend response:",
        JSON.stringify(requestError.response?.data ?? null, null, 2)
      );

      setError(getErrorMessage(requestError));
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      await fetchVouchers(controller.signal);
    };

    load();

    return () => controller.abort();
  }, [fetchVouchers]);

  const refreshVouchers = () => {
    setRefreshing(true);
    fetchVouchers();
  };

  const filteredVouchers = vouchers.filter((voucher) => {
    const query = search.trim().toLowerCase();

    const searchable = [
      voucher.voucher_number,
      voucher.title,
      voucher.category,
      voucher.description,
      voucher.employee_name,
      voucher.department_name,
    ];

    const matchesSearch =
      !query ||
      searchable.some((value) =>
        String(value || "").toLowerCase().includes(query)
      );

    const status = String(voucher.status || "draft").toLowerCase();

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "submitted"
        ? ["submitted", "pending_approval"].includes(status)
        : status === statusFilter);

    return matchesSearch && matchesStatus;
  });

  const openCreateForm = () => {
    setError("");
    setSuccess("");
    setEditingVoucher(null);
    setForm({ ...INITIAL_FORM, expense_date: getLocalDate() });
    setShowForm(true);
  };

  const openEditForm = (voucher) => {
    if (String(voucher.status || "").toLowerCase() !== "draft") {
      setError("Only draft vouchers can be edited.");
      return;
    }

    setError("");
    setSuccess("");
    setEditingVoucher(voucher);

    setForm({
      title: voucher.title || "",
      category: CATEGORIES.includes(voucher.category)
        ? voucher.category
        : "Other",
      amount: voucher.amount == null ? "" : String(voucher.amount),
      expense_date: voucher.expense_date
        ? String(voucher.expense_date).slice(0, 10)
        : getLocalDate(),
      department_id:
        voucher.department_id == null
          ? ""
          : String(voucher.department_id),
      description: voucher.description || "",
    });

    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingVoucher(null);
    setForm({ ...INITIAL_FORM, expense_date: getLocalDate() });
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSaveVoucher = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    const title = form.title.trim();
    const amount = Number(form.amount);
    const departmentId = Number(form.department_id);
    const description = form.description.trim();

    if (title.length < 3 || title.length > 200) {
      setError("Title must contain between 3 and 200 characters.");
      return;
    }

    if (
      form.department_id.trim() === "" ||
      !Number.isSafeInteger(departmentId) ||
      departmentId <= 0
    ) {
      setError("Enter a valid positive department ID.");
      return;
    }

    if (!CATEGORIES.includes(form.category)) {
      setError("Select a valid expense category.");
      return;
    }

    if (
      form.amount.trim() === "" ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > 999999999
    ) {
      setError("Enter a valid amount greater than zero.");
      return;
    }

    if (!form.expense_date) {
      setError("Please select the expense date.");
      return;
    }

    if (description.length > 5000) {
      setError("Description cannot exceed 5000 characters.");
      return;
    }

    // Keep these field names aligned with the backend voucher schema.
    const payload = {
      title,
      category: form.category,
      amount,
      expenseDate: form.expense_date,
      departmentId,
      description,
    };

    setSaving(true);

    try {
      let response;

      if (editingVoucher) {
        response = await api.put(
          `/vouchers/${editingVoucher.id}`,
          payload
        );
      } else {
        response = await api.post("/vouchers", payload);
      }

      setSuccess(
        response.data?.message ||
          (editingVoucher
            ? "Draft voucher updated successfully."
            : "Draft voucher created successfully.")
      );

      setShowForm(false);
      setEditingVoucher(null);
      setForm({ ...INITIAL_FORM, expense_date: getLocalDate() });

      await fetchVouchers();
    } catch (requestError) {
      console.error("Save voucher error:", requestError);
      console.error("HTTP status:", requestError.response?.status);
      console.error(
        "Backend response:",
        JSON.stringify(requestError.response?.data ?? null, null, 2)
      );
      console.error("Submitted voucher payload:", payload);

      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVoucher = async (voucher) => {
    if (String(voucher.status || "").toLowerCase() !== "draft") {
      setError("Only draft vouchers can be deleted.");
      return;
    }

    const confirmed = window.confirm(
      `Delete voucher ${
        voucher.voucher_number || `#${voucher.id}`
      }? This action cannot be undone.`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");
    setDeletingVoucherId(voucher.id);

    try {
      await api.delete(`/vouchers/${voucher.id}`);

      setVouchers((current) =>
        current.filter((item) => item.id !== voucher.id)
      );

      setSuccess("Draft voucher deleted successfully.");

      if (detailsVoucher?.id === voucher.id) {
        setDetailsVoucher(null);
      }
    } catch (requestError) {
      console.error("Delete voucher error:", requestError);
      console.error(
        "Delete backend response:",
        JSON.stringify(requestError.response?.data ?? null, null, 2)
      );

      setError(getErrorMessage(requestError));
    } finally {
      setDeletingVoucherId(null);
    }
  };

  const openSubmitModal = (voucher) => {
    if (String(voucher.status || "").toLowerCase() !== "draft") {
      setError("Only draft vouchers can be submitted.");
      return;
    }

    clearSignature();
    setError("");
    setSuccess("");
    setVoucherToSubmit(voucher);
    setShowSubmitModal(true);
  };

  const closeSubmitModal = () => {
    if (submittingVoucherId !== null) return;

    setShowSubmitModal(false);
    setVoucherToSubmit(null);
    clearSignature();
  };

  const handleSignatureChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!["image/png", "image/jpeg"].includes(file.type)) {
      clearSignature();
      setSignatureError("Upload your signature as a PNG or JPEG image.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      clearSignature();
      setSignatureError("Signature image must be 5 MB or smaller.");
      return;
    }

    if (signatureObjectUrlRef.current) {
      URL.revokeObjectURL(signatureObjectUrlRef.current);
    }

    const previewUrl = URL.createObjectURL(file);

    signatureObjectUrlRef.current = previewUrl;
    setSignatureFile(file);
    setSignaturePreview(previewUrl);
    setSignatureError("");
  };

  const handleSubmitVoucher = async (event) => {
    event.preventDefault();

    if (!voucherToSubmit) return;

    if (!signatureFile) {
      setSignatureError("Please upload your signature before submitting.");
      return;
    }

    if (
      !window.confirm("Submit this signed voucher for Director approval?")
    ) {
      return;
    }

    const voucherId = voucherToSubmit.id;
    const payload = new FormData();

    payload.append("signature", signatureFile);

    setError("");
    setSuccess("");
    setSubmittingVoucherId(voucherId);

    try {
      const response = await api.post(
        `/vouchers/${voucherId}/submit`,
        payload
      );

      setSuccess(
        response.data?.message ||
          "Voucher signed and submitted successfully."
      );

      setShowSubmitModal(false);
      setVoucherToSubmit(null);
      clearSignature();

      if (detailsVoucher?.id === voucherId) {
        setDetailsVoucher(null);
      }

      await fetchVouchers();
    } catch (requestError) {
      console.error("Submit voucher error:", requestError);
      console.error(
        "Submit backend response:",
        JSON.stringify(requestError.response?.data ?? null, null, 2)
      );

      setError(getErrorMessage(requestError));
    } finally {
      setSubmittingVoucherId(null);
    }
  };

  const openVoucherDetails = async (voucher) => {
    setDetailsVoucher(null);
    setDetailsError("");
    setDetailsLoading(true);
    setError("");

    try {
      const response = await api.get(`/vouchers/${voucher.id}`);
      const data = response.data;

      if (!data?.voucher) {
        throw new Error("Voucher details were not returned by the server.");
      }

      setDetailsVoucher({
        ...data.voucher,
        approvals: Array.isArray(data.history) ? data.history : [],
      });
    } catch (requestError) {
      console.error("Voucher details error:", requestError);
      console.error(
        "Voucher details backend response:",
        JSON.stringify(requestError.response?.data ?? null, null, 2)
      );

      setDetailsError(getErrorMessage(requestError));
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeDetails = () => {
    setDetailsVoucher(null);
    setDetailsError("");
  };

  const statusLabel = (status) =>
    String(status || "draft")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());

  return (
    <div className="vouchers-page">
      {/* Back to Dashboard button */}
      <button
        type="button"
        className="vouchers-back-button"
        onClick={() => navigate("/employee/dashboard")}
      >
        <ArrowLeft size={18} />
        <span>Back</span>
      </button>

      <div className="vouchers-header">
        <div>
          <h1>Voucher Management</h1>
          <p>Manage, track and review your expense vouchers.</p>
        </div>

        <div className="vouchers-header-actions">
          <button
            type="button"
            className="vouchers-secondary-button"
            onClick={refreshVouchers}
            disabled={refreshing || loading}
          >
            <RefreshCw size={17} />
            Refresh
          </button>

          <button
            type="button"
            className="vouchers-primary-button"
            onClick={openCreateForm}
          >
            <FilePlus2 size={17} />
            New Voucher
          </button>
        </div>
      </div>

      {error && (
        <div className="vouchers-alert vouchers-alert-error" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setError("")}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="vouchers-alert vouchers-alert-success" role="status">
          <CheckCircle2 size={18} />
          <span>{success}</span>
          <button
            type="button"
            aria-label="Dismiss message"
            onClick={() => setSuccess("")}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="vouchers-toolbar">
        <div className="vouchers-search">
          <Search size={18} />
          <input
            type="search"
            placeholder="Search voucher number, title, employee..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search vouchers"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="Filter vouchers by status"
          className="vouchers-status-filter"
        >
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="vouchers-table-card">
        <div className="vouchers-table-heading">
          <div>
            <h2>Expense Vouchers</h2>
            <p>{filteredVouchers.length} vouchers found</p>
          </div>
        </div>

        {loading ? (
          <div className="vouchers-state">
            <LoaderCircle size={28} />
            Loading vouchers...
          </div>
        ) : filteredVouchers.length === 0 ? (
          <div className="vouchers-state">
            <FilePlus2 size={34} />
            <h3>No vouchers found</h3>
            <p>Try changing your search or status filter.</p>
          </div>
        ) : (
          <div className="vouchers-table-wrapper">
            <table className="vouchers-table">
              <thead>
                <tr>
                  <th>Voucher</th>
                  <th>Expense</th>
                  <th>Department</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredVouchers.map((voucher) => (
                  <tr key={voucher.id}>
                    <td>
                      <div>
                        {voucher.voucher_number || `#${voucher.id}`}
                      </div>
                      <span className="vouchers-cell-muted">
                        {voucher.employee_name || "—"}
                      </span>
                    </td>

                    <td>
                      <div>{voucher.title}</div>
                      <span className="vouchers-cell-muted">
                        {voucher.category}
                      </span>
                    </td>

                    <td>{getDepartmentName(voucher)}</td>
                    <td>{formatDate(voucher.expense_date)}</td>

                    <td className="vouchers-amount">
                      {formatAmount(voucher.amount)}
                    </td>

                    <td>
                      <span
                        className={`vouchers-status status-${getStatusClass(
                          voucher.status
                        )}`}
                      >
                        {statusLabel(voucher.status)}
                      </span>
                    </td>

                    <td>
                      <div className="vouchers-row-actions">
                        <button
                          type="button"
                          className="vouchers-icon-button"
                          title="View details"
                          onClick={() => openVoucherDetails(voucher)}
                        >
                          <Eye size={17} />
                        </button>

                        {String(voucher.status || "").toLowerCase() ===
                          "draft" && (
                          <>
                            <button
                              type="button"
                              className="vouchers-icon-button"
                              title="Edit draft"
                              onClick={() => openEditForm(voucher)}
                            >
                              <Pencil size={17} />
                            </button>

                            <button
                              type="button"
                              className="vouchers-icon-button vouchers-delete-icon"
                              title="Delete draft"
                              disabled={deletingVoucherId === voucher.id}
                              onClick={() => handleDeleteVoucher(voucher)}
                            >
                              {deletingVoucherId === voucher.id ? (
                                <LoaderCircle size={17} />
                              ) : (
                                <Trash2 size={17} />
                              )}
                            </button>

                            <button
                              type="button"
                              className="vouchers-icon-button"
                              title="Sign and submit"
                              onClick={() => openSubmitModal(voucher)}
                            >
                              <Send size={17} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="vouchers-modal-backdrop">
          <section
            className="vouchers-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="voucher-form-title"
          >
            <div className="vouchers-modal-header">
              <h2 id="voucher-form-title">
                {editingVoucher ? "Edit Draft Voucher" : "Create Voucher"}
              </h2>

              <button
                type="button"
                className="vouchers-icon-button"
                onClick={closeForm}
                disabled={saving}
                aria-label="Close voucher form"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveVoucher}>
              <div className="vouchers-form-grid">
                <div className="vouchers-field vouchers-field-full">
                  <label htmlFor="voucher-title">Expense title *</label>
                  <input
                    id="voucher-title"
                    name="title"
                    value={form.title}
                    onChange={handleFormChange}
                    minLength={3}
                    maxLength={200}
                    required
                  />
                </div>

                <div className="vouchers-field">
                  <label htmlFor="voucher-category">Category *</label>
                  <select
                    id="voucher-category"
                    name="category"
                    value={form.category}
                    onChange={handleFormChange}
                    required
                  >
                    {CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="vouchers-field">
                  <label htmlFor="voucher-amount">Amount (₹) *</label>
                  <input
                    id="voucher-amount"
                    name="amount"
                    type="number"
                    min="0.01"
                    max="999999999"
                    step="0.01"
                    value={form.amount}
                    onChange={handleFormChange}
                    required
                  />
                </div>

                <div className="vouchers-field">
                  <label htmlFor="voucher-date">Expense date *</label>
                  <input
                    id="voucher-date"
                    name="expense_date"
                    type="date"
                    value={form.expense_date}
                    onChange={handleFormChange}
                    required
                  />
                </div>

                <div className="vouchers-field">
                  <label htmlFor="voucher-department">Department ID *</label>
                  <input
                    id="voucher-department"
                    name="department_id"
                    type="number"
                    min="1"
                    step="1"
                    value={form.department_id}
                    onChange={handleFormChange}
                    required
                  />
                  <small>
                    Enter the department ID assigned to your employee account.
                  </small>
                </div>

                <div className="vouchers-field vouchers-field-full">
                  <label htmlFor="voucher-description">Description</label>
                  <textarea
                    id="voucher-description"
                    name="description"
                    value={form.description}
                    onChange={handleFormChange}
                    maxLength={5000}
                    rows={4}
                  />
                </div>
              </div>

              <div className="vouchers-modal-footer">
                <button
                  type="button"
                  className="vouchers-secondary-button"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="vouchers-primary-button"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <LoaderCircle size={17} />
                      Saving...
                    </>
                  ) : editingVoucher ? (
                    "Save Changes"
                  ) : (
                    "Create Draft"
                  )}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {showSubmitModal && voucherToSubmit && (
        <div className="vouchers-modal-backdrop">
          <section
            className="vouchers-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="voucher-submit-title"
          >
            <div className="vouchers-modal-header">
              <h2 id="voucher-submit-title">Sign and Submit Voucher</h2>

              <button
                type="button"
                className="vouchers-icon-button"
                onClick={closeSubmitModal}
                disabled={submittingVoucherId !== null}
                aria-label="Close submit form"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitVoucher}>
              <div className="vouchers-signature-section">
                <p>Upload a PNG or JPEG signature image, up to 5 MB.</p>

                <div className="vouchers-signature-preview">
                  {signaturePreview ? (
                    <img src={signaturePreview} alt="Signature preview" />
                  ) : (
                    <span>Signature preview will appear here</span>
                  )}
                </div>

                <div className="vouchers-field">
                  <label htmlFor="voucher-signature">
                    Signature image *
                  </label>
                  <input
                    ref={signatureInputRef}
                    id="voucher-signature"
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={handleSignatureChange}
                    required
                  />
                </div>

                {signatureError && (
                  <p role="alert">{signatureError}</p>
                )}
              </div>

              <div className="vouchers-modal-footer">
                <button
                  type="button"
                  className="vouchers-secondary-button"
                  onClick={closeSubmitModal}
                  disabled={submittingVoucherId !== null}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="vouchers-primary-button"
                  disabled={
                    !signatureFile || submittingVoucherId !== null
                  }
                >
                  {submittingVoucherId !== null
                    ? "Submitting..."
                    : "Sign and Submit"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {detailsLoading && (
        <div className="vouchers-modal-backdrop">
          <div className="vouchers-state">
            <LoaderCircle size={28} />
            Loading details...
          </div>
        </div>
      )}

      {(detailsError || detailsVoucher) && !detailsLoading && (
        <div className="vouchers-modal-backdrop">
          <section
            className="vouchers-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="voucher-details-title"
          >
            <div className="vouchers-modal-header">
              <h2 id="voucher-details-title">
                {detailsError ? "Unable to load details" : "Voucher Details"}
              </h2>

              <button
                type="button"
                className="vouchers-icon-button"
                onClick={closeDetails}
                aria-label="Close voucher details"
              >
                <X size={20} />
              </button>
            </div>

            {detailsError ? (
              <p>{detailsError}</p>
            ) : (
              <div className="vouchers-details-content">
                <div className="vouchers-details-grid">
                  <div>
                    <strong>Voucher:</strong>{" "}
                    {detailsVoucher.voucher_number ||
                      `#${detailsVoucher.id}`}
                  </div>

                  <div>
                    <strong>Title:</strong> {detailsVoucher.title || "—"}
                  </div>

                  <div>
                    <strong>Category:</strong>{" "}
                    {detailsVoucher.category || "—"}
                  </div>

                  <div>
                    <strong>Amount:</strong>{" "}
                    {formatAmount(detailsVoucher.amount)}
                  </div>

                  <div>
                    <strong>Date:</strong>{" "}
                    {formatDate(detailsVoucher.expense_date)}
                  </div>

                  <div>
                    <strong>Department:</strong>{" "}
                    {getDepartmentName(detailsVoucher)}
                  </div>

                  <div>
                    <strong>Employee:</strong>{" "}
                    {detailsVoucher.employee_name || "—"}
                  </div>

                  <div>
                    <strong>Status:</strong>{" "}
                    {statusLabel(detailsVoucher.status)}
                  </div>

                  <div className="vouchers-details-full">
                    <strong>Description:</strong>
                    <p>
                      {detailsVoucher.description ||
                        "No description provided."}
                    </p>
                  </div>

                  {detailsVoucher.rejection_reason && (
                    <div className="vouchers-details-full">
                      <strong>Rejection reason:</strong>
                      <p>{detailsVoucher.rejection_reason}</p>
                    </div>
                  )}
                </div>

                <div className="vouchers-history">
                  <h3>Approval History</h3>

                  {detailsVoucher.approvals.length === 0 ? (
                    <p>No approval history available yet.</p>
                  ) : (
                    detailsVoucher.approvals.map((item) => (
                      <div key={item.id}>
                        <strong>{statusLabel(item.action)}</strong>

                        <p>
                          {item.actor_name || "User"}
                          {item.actor_role ? ` · ${item.actor_role}` : ""}
                        </p>

                        {item.notes && <p>{item.notes}</p>}

                        {item.rejection_reason && (
                          <p>Reason: {item.rejection_reason}</p>
                        )}

                        <span>{formatDate(item.created_at)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="vouchers-modal-footer">
              {detailsVoucher?.status === "draft" && (
                <button
                  type="button"
                  className="vouchers-primary-button"
                  onClick={() => {
                    const voucher = detailsVoucher;
                    closeDetails();
                    openSubmitModal(voucher);
                  }}
                >
                  <Send size={17} />
                  Sign and Submit
                </button>
              )}

              <button
                type="button"
                className="vouchers-secondary-button"
                onClick={closeDetails}
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default Vouchers;
