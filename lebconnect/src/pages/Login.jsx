import { useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../api/axios";
import ErrorMessage from "../components/ErrorMessage";
import { dashboardPath, setAuth } from "../utils/auth";
import { BriefcaseBusiness, Laptop, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

import { lcMotionPage } from "../utils/motionProps";
import ThemeToggle from "../components/ThemeToggle";
import "./Login.css";

/**
 * Validates API user.role vs selected login tab.
 * Never call setAuth before this passes.
 */
function roleMismatchMessage(portal, role) {
  if (portal === "jobseeker") {
    if (role === "candidate") return null;
    return "Sign in using the Job Seeker tab — this email is registered as another account type.";
  }
  if (portal === "company") {
    if (role === "company") return null;
    return "Sign in using the Company tab — this email is registered as another account type.";
  }
  if (portal === "admin") {
    if (role === "admin") return null;
    return "Administrator access only — this account is not an admin.";
  }
  return "Login is not allowed for this account type.";
}

function Login() {
  const navigate = useNavigate();

  const [portal, setPortal] = useState("jobseeker");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetPassword, setResetPasswordState] = useState("");
  const [resetPassword2, setResetPassword2] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");
  const [resetBusy, setResetBusy] = useState(false);

  const openResetModal = () => {
    setResetError("");
    setResetSuccess("");
    setResetEmail(email.trim());
    setResetPasswordState("");
    setResetPassword2("");
    setResetOpen(true);
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setResetError("");
    setResetSuccess("");
    const em = resetEmail.trim();
    const pw = resetPassword;
    const pw2 = resetPassword2;
    if (!em || !pw || !pw2) {
      setResetError("Please fill in every field.");
      return;
    }
    if (pw !== pw2) {
      setResetError("Passwords do not match.");
      return;
    }
    if (pw.length < 6) {
      setResetError("Password must be at least 6 characters.");
      return;
    }
    setResetBusy(true);
    try {
      await api.post("/api/auth/reset-password", {
        email: em,
        newPassword: pw,
      });
      setResetSuccess("Password updated. Close this dialog and sign in.");
    } catch (err) {
      setResetError(
        err.response?.data?.message ||
          err.message ||
          "Unable to reset password."
      );
    } finally {
      setResetBusy(false);
    }
  };

  const handlePortalChange = (next) => {
    setPortal(next);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const em = email.trim();
    if (!em || !password) {
      setError("Please enter email and password.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post("/api/auth/login", {
        email: em,
        password,
      });

      const token = data.token;
      const user = data.user;
      const role = user?.role;

      const mismatch = roleMismatchMessage(portal, role);
      if (mismatch) {
        setError(mismatch);
        return;
      }

      setAuth(token, user);
      navigate(dashboardPath(role));
    } catch (err) {
      const msg =
        err.response?.data?.message || err.message || "Login failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <motion.div className="login-page" {...lcMotionPage(20)}>
        <div className="lc-auth-theme-corner">
          <ThemeToggle solid />
        </div>
        <div className="login-left">
          <div className="login-left-overlay"></div>

          <div className="login-left-content">
            <div
              className="brand-mark auth-shell-brand"
              role="button"
              tabIndex={0}
              aria-label="LebConnect Home"
              onClick={() => navigate("/")}
              onKeyDown={(e) => e.key === "Enter" && navigate("/")}
            >
              <div className="brand-center" />
            </div>

            <h1 className="login-hero-title">
              Lebanon&apos;s Professional
              <br />
              Network
            </h1>

            <p className="login-hero-text">
              One place for job seekers and employers to meet — messaging,
              applications, and company profiles tailored for Lebanon.
            </p>

            <ul className="login-trust-strip" aria-hidden="false">
              <li>Encrypted sign-in • role-based workspaces</li>
              <li>Feeds, jobs, and hiring tools in one platform</li>
              <li>Built for Lebanese teams &amp; applicants</li>
            </ul>
          </div>
        </div>

        <div className="login-right">
          <div className="login-form-wrapper">
            <p
              className="back-home-link"
              role="button"
              tabIndex={0}
              onClick={() => navigate("/")}
              onKeyDown={(e) => e.key === "Enter" && navigate("/")}
            >
              ← Back to Home
            </p>
            <h2>
              {portal === "admin" ? "Administrator sign in" : "Welcome back"}
            </h2>
            <p className="login-subtitle">
              {portal === "admin"
                ? "Restricted access • sign in here only with an admin account"
                : "Sign in to your LebConnect account"}
            </p>

            <div className="login-tabs login-tabs--triple">
              <button
                type="button"
                className={portal === "jobseeker" ? "tab-btn active" : "tab-btn"}
                onClick={() => handlePortalChange("jobseeker")}
              >
                <span className="tab-icon-svg" aria-hidden>
                  <Laptop size={18} strokeWidth={2} />
                </span>
                Job Seeker
              </button>

              <button
                type="button"
                className={portal === "company" ? "tab-btn active" : "tab-btn"}
                onClick={() => handlePortalChange("company")}
              >
                <span className="tab-icon-svg" aria-hidden>
                  <BriefcaseBusiness size={18} strokeWidth={2} />
                </span>
                Company
              </button>

              <button
                type="button"
                className={
                  portal === "admin"
                    ? "tab-btn active tab-btn-admin"
                    : "tab-btn tab-btn-admin"
                }
                onClick={() => handlePortalChange("admin")}
              >
                <span className="tab-icon-svg" aria-hidden>
                  <ShieldCheck size={18} strokeWidth={2} />
                </span>
                Admin
              </button>
            </div>

            <ErrorMessage message={error} onDismiss={() => setError("")} />

            <form className="login-form" onSubmit={handleSubmit}>
              <label>Email Address</label>
              <div className="input-box">
                <span className="input-icon" aria-hidden>
                  ✉
                </span>
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                />
              </div>

              <label>Password</label>
              <div className="input-box">
                <span className="input-icon" aria-hidden>
                  ⌂
                </span>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>

              <button
                type="button"
                className="forgot-password"
                onClick={openResetModal}
              >
                Forgot password?
              </button>

              <button type="submit" className="signin-btn" disabled={loading}>
                {loading ? "Signing in…" : "Sign In"}
              </button>
            </form>

            <div className="divider-row">
              <span></span>
              <p>New to LebConnect?</p>
              <span></span>
            </div>

            <p className="join-line">
              <button
                type="button"
                className="join-line-link lc-login-cta-primary"
                onClick={() => navigate("/choose-role")}
              >
                Create an account
              </button>
            </p>

            <p className="join-line join-line--muted lc-login-mini-hint">
              Pick the Job Seeker, Company, or Admin tab above to match your
              account type.
            </p>
          </div>
        </div>
      </motion.div>

      {resetOpen ? (
        <div className="lc-reset-overlay">
          <div className="lc-reset-modal" role="dialog" aria-modal="true" aria-labelledby="lc-reset-title">
            <div className="lc-reset-modal-head">
              <h3 id="lc-reset-title">Reset password</h3>
              <button
                type="button"
                className="lc-reset-close"
                aria-label="Close"
                onClick={() => setResetOpen(false)}
              >
                ✕
              </button>
            </div>
            <p className="lc-reset-hint">
              Enter the email on your account and choose a new password.
            </p>
            <form className="lc-reset-form" onSubmit={handleResetSubmit}>
              <label className="lc-reset-label">
                Email
                <input
                  type="email"
                  autoComplete="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                />
              </label>
              <label className="lc-reset-label">
                New password
                <input
                  type="password"
                  autoComplete="new-password"
                  value={resetPassword}
                  onChange={(e) => setResetPasswordState(e.target.value)}
                  minLength={6}
                  required
                />
              </label>
              <label className="lc-reset-label">
                Confirm password
                <input
                  type="password"
                  autoComplete="new-password"
                  value={resetPassword2}
                  onChange={(e) => setResetPassword2(e.target.value)}
                  minLength={6}
                  required
                />
              </label>

              {resetError ? (
                <p className="lc-reset-msg lc-reset-msg--err">{resetError}</p>
              ) : null}
              {resetSuccess ? (
                <p className="lc-reset-msg lc-reset-msg--ok">{resetSuccess}</p>
              ) : null}

              <button type="submit" className="lc-reset-submit" disabled={resetBusy}>
                {resetBusy ? "Updating…" : "Update password"}
              </button>
              <button
                type="button"
                className="lc-reset-back-login"
                onClick={() => setResetOpen(false)}
              >
                Close
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default Login;
