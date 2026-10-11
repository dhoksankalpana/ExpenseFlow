
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Eye,
  EyeOff,
  FileCheck2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
  Building2,
} from "lucide-react";

import api from "../services/api";
import "./Register.css";

function Register() {
  const navigate = useNavigate();

  const [departments, setDepartments] = useState([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;

    async function loadDepartments() {
      try {
        const response = await api.get("/auth/departments");

        if (active) {
          setDepartments(response.data.departments);
        }
      } catch {
        if (active) {
          setError("Unable to load departments. Please try again.");
        }
      } finally {
        if (active) {
          setLoadingDepartments(false);
        }
      }
    }

    loadDepartments();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Your password must contain at least 8 characters.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await api.post("/auth/register", {
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        departmentId,
      });

      setSuccess(
        response.data.message || "Account created. You can now sign in."
      );

      setTimeout(() => {
        navigate("/login", {
          replace: true,
          state: { registrationSuccess: true },
        });
      }, 1200);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to create your account. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="register-page">
      <section className="register-visual">
        <Link to="/login" className="register-brand">
          <span className="register-brand-icon">
            <FileCheck2 size={24} />
          </span>
          <span>ExpenseFlow</span>
        </Link>

        <div className="register-visual-content">
          <span className="register-eyebrow">GET STARTED</span>
          <h1>
            Your expenses,
            <br />
            <span>under control.</span>
          </h1>
          <p>
            Create your employee account to prepare expense vouchers,
            track approvals, and keep your expense records organised.
          </p>

          <div className="register-feature">
            <ShieldCheck size={20} />
            <span>Secure employee access</span>
          </div>
          <div className="register-feature">
            <FileCheck2 size={20} />
            <span>Track voucher progress</span>
          </div>
          <div className="register-feature">
            <LockKeyhole size={20} />
            <span>Protected account credentials</span>
          </div>
        </div>

        <p className="register-visual-footer">
          Clear records. Confident decisions.
        </p>
      </section>

      <section className="register-panel">
        <div className="register-card">
          <div className="register-mobile-brand">
            <span className="register-brand-icon">
              <FileCheck2 size={23} />
            </span>
            <span>ExpenseFlow</span>
          </div>

          <span className="register-form-eyebrow">EMPLOYEE REGISTRATION</span>
          <h2>Create your account</h2>
          <p className="register-description">
            Fill in your details to get started.
          </p>

          {error && (
            <div className="register-message register-error" role="alert">
              {error}
            </div>
          )}

          {success && (
            <div className="register-message register-success" role="status">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="register-form">
            <label htmlFor="fullName">Full name</label>
            <div className="register-input-wrap">
              <UserRound size={18} />
              <input
                id="fullName"
                type="text"
                placeholder="Enter your full name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                autoComplete="name"
                minLength={2}
                maxLength={150}
                required
              />
            </div>

            <label htmlFor="registerEmail">Work email</label>
            <div className="register-input-wrap">
              <Mail size={18} />
              <input
                id="registerEmail"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                maxLength={255}
                required
              />
            </div>

            <label htmlFor="departmentId">Department</label>
            <div className="register-input-wrap">
              <Building2 size={18} />
              <select
                id="departmentId"
                value={departmentId}
                onChange={(event) => setDepartmentId(event.target.value)}
                required
                disabled={loadingDepartments || departments.length === 0}
              >
                <option value="">
                  {loadingDepartments
                    ? "Loading departments..."
                    : "Select your department"}
                </option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>

            <label htmlFor="registerPassword">Password</label>
            <div className="register-input-wrap">
              <LockKeyhole size={18} />
              <input
                id="registerPassword"
                type={showPassword ? "text" : "password"}
                placeholder="At least 8 characters"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
              />
              <button
                className="register-password-toggle"
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <label htmlFor="confirmPassword">Confirm password</label>
            <div className="register-input-wrap">
              <LockKeyhole size={18} />
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
              />
              <button
                className="register-password-toggle"
                type="button"
                aria-label={
                  showConfirmPassword
                    ? "Hide confirmation password"
                    : "Show confirmation password"
                }
                onClick={() =>
                  setShowConfirmPassword((current) => !current)
                }
              >
                {showConfirmPassword ? (
                  <EyeOff size={18} />
                ) : (
                  <Eye size={18} />
                )}
              </button>
            </div>

            <p className="register-role-note">
              <ShieldCheck size={16} />
              New accounts are registered with employee access.
            </p>

            <button
              className="register-submit"
              type="submit"
              disabled={
                submitting ||
                loadingDepartments ||
                departments.length === 0
              }
            >
              {submitting ? "Creating account..." : "Create account"}
              {!submitting && <ArrowRight size={18} />}
            </button>
          </form>

          <p className="register-login-prompt">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </section>
    </main>
  );
}

export default Register;
