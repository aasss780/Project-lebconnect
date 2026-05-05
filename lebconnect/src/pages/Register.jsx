import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import ErrorMessage from "../components/ErrorMessage";
import CategoryPicker from "../components/CategoryPicker";
import { useToast } from "../context/ToastContext";
import {
  composeCategoryErrors,
  OTHER_LABEL,
} from "../constants/categories";
import { motion } from "framer-motion";

import { lcMotionPage } from "../utils/motionProps";
import ThemeToggle from "../components/ThemeToggle";
import PasswordStrengthMeter from "../components/PasswordStrengthMeter";
import { analyzePasswordStrength } from "../utils/passwordStrength";
import "./Register.css";

const MIN_PASSWORD = 6;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Register() {
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    specializationCategory: "",
    specializationOther: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    specCat: "",
    specCust: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const next = {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      specCat: "",
      specCust: "",
    };

    const fullName = form.fullName.trim();
    const email = form.email.trim();
    const catErrs = composeCategoryErrors(
      form.specializationCategory,
      form.specializationOther
    );
    next.specCat = catErrs.category || "";
    next.specCust = catErrs.custom || "";

    if (!fullName) next.fullName = "Please enter your full name.";
    else if (fullName.length < 2)
      next.fullName = "Use at least 2 characters for your name.";

    if (!email) next.email = "Please enter your email.";
    else if (!EMAIL_RE.test(email))
      next.email = "Enter a valid email address.";

    if (!form.password) next.password = "Please choose a password.";
    else if (form.password.length < MIN_PASSWORD)
      next.password = `Use at least ${MIN_PASSWORD} characters.`;
    else if (analyzePasswordStrength(form.password).score === 0) {
      next.password = "Please use a stronger password.";
    }

    if (!form.confirmPassword)
      next.confirmPassword = "Please confirm your password.";
    else if (form.password !== form.confirmPassword)
      next.confirmPassword = "Passwords do not match.";

    setFieldErrors(next);
    if (Object.values(next).some(Boolean)) return;

    const specializationOther =
      form.specializationCategory === OTHER_LABEL
        ? form.specializationOther.trim()
        : "";

    setLoading(true);
    try {
      await api.post("/api/auth/register/candidate", {
        fullName,
        email,
        password: form.password,
        specializationCategory: form.specializationCategory.trim(),
        specializationOther,
      });
      toast.success("Account created. Sign in to continue.");
      navigate("/login");
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Registration failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div className="register-page" {...lcMotionPage(20)}>
      <div className="lc-auth-theme-corner">
        <ThemeToggle solid />
      </div>
      <div className="register-left">
        <div className="register-overlay"></div>

        <div className="register-left-content">
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

          <div className="join-badge">
            <span className="join-badge-dot"></span>
            <span>Free to join — always</span>
          </div>

          <h1 className="hero-title">
            Start your journey with
            <br />
            LebConnect
          </h1>

          <p className="hero-text">
            Join thousands of Lebanese professionals who found their next
            opportunity through our platform.
          </p>

          <div className="features-list">
            <div className="feature-item">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 10.5L12 4L20 10.5V19C20 19.5523 19.5523 20 19 20H5C4.44772 20 4 19.5523 4 19V10.5Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                  <path
                    d="M9 20V13H15V20"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                </svg>
              </div>
              <span>Browse roles from Lebanese employers</span>
            </div>

            <div className="feature-item">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M7 4H17L20 7V20H7V4Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                  <path
                    d="M17 4V7H20"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                  <path
                    d="M10 11H16"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                  <path
                    d="M10 15H16"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                </svg>
              </div>
              <span>Build a standout profile</span>
            </div>

            <div className="feature-item">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 8V12L15 15"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="8"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                </svg>
              </div>
              <span>Get notified on new matches</span>
            </div>

            <div className="feature-item">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M5 6.5C5 5.67157 5.67157 5 6.5 5H17.5C18.3284 5 19 5.67157 19 6.5V14.5C19 15.3284 18.3284 16 17.5 16H10L6 19V16H6.5C5.67157 16 5 15.3284 5 14.5V6.5Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                </svg>
              </div>
              <span>Chat directly with recruiters</span>
            </div>
          </div>

          <p className="auth-left-trust-muted">
            Built for candidates and hiring teams in Lebanon — no demo accounts, no fake
            join counts.
          </p>
        </div>
      </div>

      <div className="register-right">
        <div className="register-form-wrapper">
          <p
            className="back-home-link"
            role="button"
            tabIndex={0}
            onClick={() => navigate("/")}
            onKeyDown={(e) => e.key === "Enter" && navigate("/")}
          >
            ← Back to Home
          </p>

          <h2>Create your account</h2>
          <p className="account-type">
            Job Seeker account{" "}
            <button
              type="button"
              className="account-type-change"
              onClick={() => navigate("/choose-role")}
            >
              Change
            </button>
          </p>

          <ErrorMessage message={error} onDismiss={() => setError("")} />

          <form className="register-form" onSubmit={handleSubmit}>
            <label htmlFor="reg-fullName">Full Name</label>
            <input
              id="reg-fullName"
              name="fullName"
              type="text"
              placeholder="Your full name"
              value={form.fullName}
              onChange={handleChange}
              className={fieldErrors.fullName ? "lc-input-has-error" : ""}
              autoComplete="name"
              aria-invalid={!!fieldErrors.fullName}
            />
            {fieldErrors.fullName ? (
              <span className="lc-inline-error" role="alert">
                {fieldErrors.fullName}
              </span>
            ) : null}

            <label htmlFor="reg-email">Email Address</label>
            <input
              id="reg-email"
              name="email"
              type="email"
              placeholder="your@email.com"
              value={form.email}
              onChange={handleChange}
              className={fieldErrors.email ? "lc-input-has-error" : ""}
              autoComplete="email"
              aria-invalid={!!fieldErrors.email}
            />
            {fieldErrors.email ? (
              <span className="lc-inline-error" role="alert">
                {fieldErrors.email}
              </span>
            ) : null}

            <CategoryPicker
              variant="candidate"
              idPrefix="reg-spec"
              category={form.specializationCategory}
              custom={form.specializationOther}
              categoryError={fieldErrors.specCat}
              customError={fieldErrors.specCust}
              onCategoryChange={(v) => {
                setForm((prev) => ({ ...prev, specializationCategory: v }));
                setFieldErrors((prev) => ({ ...prev, specCat: "", specCust: "" }));
              }}
              onCustomChange={(v) => {
                setForm((prev) => ({ ...prev, specializationOther: v }));
                setFieldErrors((prev) => ({ ...prev, specCust: "" }));
              }}
            />

            <label htmlFor="reg-password">Password</label>
            <input
              id="reg-password"
              name="password"
              type="password"
              placeholder={`Minimum ${MIN_PASSWORD} characters`}
              value={form.password}
              onChange={handleChange}
              className={fieldErrors.password ? "lc-input-has-error" : ""}
              autoComplete="new-password"
              aria-invalid={!!fieldErrors.password}
            />
            <PasswordStrengthMeter password={form.password} />
            {fieldErrors.password ? (
              <span className="lc-inline-error" role="alert">
                {fieldErrors.password}
              </span>
            ) : null}

            <label htmlFor="reg-confirmPassword">Confirm Password</label>
            <input
              id="reg-confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="Repeat password"
              value={form.confirmPassword}
              onChange={handleChange}
              className={fieldErrors.confirmPassword ? "lc-input-has-error" : ""}
              autoComplete="new-password"
              aria-invalid={!!fieldErrors.confirmPassword}
            />
            {fieldErrors.confirmPassword ? (
              <span className="lc-inline-error" role="alert">
                {fieldErrors.confirmPassword}
              </span>
            ) : null}

            <div className="terms-row">
              <input type="checkbox" required />
              <p>
                I agree to LebConnect&apos;s <span>Terms of Service</span> and{" "}
                <span>Privacy Policy</span>
              </p>
            </div>

            <button
              type="submit"
              className="create-account-btn"
              disabled={loading}
            >
              {loading ? "Creating…" : "Create Account"}
            </button>
          </form>

          <p className="signin-text">
            Already have an account?{" "}
            <button
              type="button"
              className="signin-text-link"
              onClick={() => navigate("/login")}
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export default Register;
