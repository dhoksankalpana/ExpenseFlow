
import { useState } from "react";
import { Link, Navigate, useNavigate, useLocation } from "react-router-dom";
import {
  ArrowRight,
  Eye,
  EyeOff,
  FileCheck2,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../context/useAuth";
import "./Login.css";

function getDashboardPath(role) {
  switch (role) {
    case "employee":
      return "/employee/dashboard";
    case "director":
      return "/director/dashboard";
    case "accounts":
      return "/accounts/dashboard";
    default:
      return "/login";
  }
}

function Login() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const registrationSuccess = location.state?.registrationSuccess;

  if (loading) {
    return <div className="app-loading">Loading ExpenseFlow...</div>;
  }

  if (user) {
    return <Navigate to={getDashboardPath(user.role)} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const loggedInUser = await login(email.trim(), password);
      navigate(getDashboardPath(loggedInUser.role), { replace: true });
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to log in. Please check the server and try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-visual">
        <div className="brand">
          <div className="brand-icon">
            <FileCheck2 size={25} />
          </div>
          <span>ExpenseFlow</span>
        </div>

        <div className="visual-content">
          <span className="eyebrow">SMARTER EXPENSE MANAGEMENT</span>
          <h1>
            Every expense.
            <br />
            <span>Accounted for.</span>
          </h1>
          <p>
            A streamlined voucher management workspace built for
            transparent approvals and reliable financial records.
          </p>

          <div className="feature-list">
            <div>
              <ShieldCheck size={20} />
              <span>Role-based access control</span>
            </div>
            <div>
              <FileCheck2 size={20} />
              <span>Structured voucher approvals</span>
            </div>
            <div>
              <LockKeyhole size={20} />
              <span>Secure sign-in and sessions</span>
            </div>
          </div>
        </div>

        <p className="visual-footer">
          Clear records. Confident decisions.
        </p>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="mobile-brand">
            <div className="brand-icon">
              <FileCheck2 size={23} />
            </div>
            <span>ExpenseFlow</span>
          </div>

          <span className="form-eyebrow">WELCOME BACK</span>
          <h2>Sign in to your account</h2>
          <p className="form-description">
            Enter your company credentials to continue.
          </p>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <label htmlFor="email">Work email</label>
            <div className="input-wrap">
              <Mail size={18} />
              <input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <label htmlFor="password">Password</label>
            <div className="input-wrap">
              <LockKeyhole size={18} />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                className="password-toggle"
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <button
              className="login-submit"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "Signing in..." : "Sign in"}
              {!submitting && <ArrowRight size={18} />}
            </button>
          </form>

          <div className="security-note">
            <ShieldCheck size={17} />
            <span>Your session is protected by secure authentication.</span>
          </div>
          {registrationSuccess && (
  <div className="login-registration-success" role="status">
    Account created successfully. You can now sign in.
  </div>
)}

<p className="login-register-prompt">
  New to ExpenseFlow? <Link to="/register">Create an account</Link>
</p>
          <p className="login-copyright">
            ExpenseFlow · Internal expense management
          </p>
        </div>
      </section>
    </main>
  );
}

export default Login;
