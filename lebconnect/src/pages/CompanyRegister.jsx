import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import ErrorMessage from "../components/ErrorMessage";
import CategoryPicker from "../components/CategoryPicker";
import { useToast } from "../context/ToastContext";
import {
  composeIndustryErrors,
  OTHER_LABEL,
} from "../constants/categories";
import { motion } from "framer-motion";

import { lcMotionPage } from "../utils/motionProps";
import ThemeToggle from "../components/ThemeToggle";
import PasswordStrengthMeter from "../components/PasswordStrengthMeter";
import { analyzePasswordStrength } from "../utils/passwordStrength";
import "./Register.css";
import "./CompanyRegister.css";

const MIN_PASSWORD = 6;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function CompanyRegister() {
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({
    companyName: "",
    email: "",
    password: "",
    confirmPassword: "",
    industryCategory: "",
    industryOther: "",
    location: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({
    companyName: "",
    email: "",
    location: "",
    password: "",
    confirmPassword: "",
    indCat: "",
    indCust: "",
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
      companyName: "",
      email: "",
      location: "",
      password: "",
      confirmPassword: "",
      indCat: "",
      indCust: "",
    };

    const companyName = form.companyName.trim();
    const email = form.email.trim();
    const location = form.location.trim();
    const catErr = composeIndustryErrors(
      form.industryCategory,
      form.industryOther
    );
    next.indCat = catErr.category || "";
    next.indCust = catErr.custom || "";

    if (!companyName) next.companyName = "Please enter your company name.";
    else if (companyName.length < 2)
      next.companyName = "Use at least 2 characters for the company name.";

    if (!email) next.email = "Please enter your email.";
    else if (!EMAIL_RE.test(email))
      next.email = "Enter a valid email address.";

    if (!location) next.location = "Please enter a location.";
    else if (location.length < 2)
      next.location = "Use at least 2 characters for location.";

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

    const industryOther =
      form.industryCategory === OTHER_LABEL ? form.industryOther.trim() : "";

    setLoading(true);
    try {
      await api.post("/api/auth/register/company", {
        companyName,
        email,
        password: form.password,
        industryCategory: form.industryCategory.trim(),
        industryOther,
        location,
      });
      toast.success("Company account created. Sign in to continue.");
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
    <motion.div className="register-page company-register-page" {...lcMotionPage(20)}>
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
            Publish roles, manage applicants, and grow your team — built for Lebanese
            hiring teams who need a single place to connect with talent.
          </p>

          <div className="features-list">
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
                </svg>
              </div>
              <span>Post jobs and reach candidates</span>
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
              <span>Track applicants in one place</span>
            </div>
          </div>

          <p className="auth-left-trust-muted">
            Post real roles and reach verified candidates — no demo credentials on sign-in.
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

          <h2>Create company account</h2>
          <p className="account-type">
            Company account{" "}
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
            <label htmlFor="co-name">Company name</label>
            <input
              id="co-name"
              name="companyName"
              type="text"
              placeholder="Your company name"
              value={form.companyName}
              onChange={handleChange}
              className={fieldErrors.companyName ? "lc-input-has-error" : ""}
              autoComplete="organization"
              aria-invalid={!!fieldErrors.companyName}
            />
            {fieldErrors.companyName ? (
              <span className="lc-inline-error" role="alert">
                {fieldErrors.companyName}
              </span>
            ) : null}

            <label htmlFor="co-email">Email Address</label>
            <input
              id="co-email"
              name="email"
              type="email"
              placeholder="hr@company.com"
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
              variant="company"
              idPrefix="reg-ind"
              category={form.industryCategory}
              custom={form.industryOther}
              categoryError={fieldErrors.indCat}
              customError={fieldErrors.indCust}
              onCategoryChange={(v) => {
                setForm((prev) => ({ ...prev, industryCategory: v }));
                setFieldErrors((prev) => ({ ...prev, indCat: "", indCust: "" }));
              }}
              onCustomChange={(v) => {
                setForm((prev) => ({ ...prev, industryOther: v }));
                setFieldErrors((prev) => ({ ...prev, indCust: "" }));
              }}
            />

            <label htmlFor="co-location">Location</label>
            <input
              id="co-location"
              name="location"
              type="text"
              placeholder="e.g. Beirut"
              value={form.location}
              onChange={handleChange}
              className={fieldErrors.location ? "lc-input-has-error" : ""}
              autoComplete="address-level2"
              aria-invalid={!!fieldErrors.location}
            />
            {fieldErrors.location ? (
              <span className="lc-inline-error" role="alert">
                {fieldErrors.location}
              </span>
            ) : null}

            <label htmlFor="co-password">Password</label>
            <input
              id="co-password"
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

            <label htmlFor="co-confirmPassword">Confirm Password</label>
            <input
              id="co-confirmPassword"
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

export default CompanyRegister;
