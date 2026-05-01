import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import ErrorMessage from "../components/ErrorMessage";
import CategoryPicker from "../components/CategoryPicker";
import {
  composeIndustryErrors,
  OTHER_LABEL,
} from "../constants/categories";
import "./Register.css";
import "./CompanyRegister.css";

function CompanyRegister() {
  const navigate = useNavigate();
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
    indCat: "",
    indCust: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setFieldErrors({ indCat: "", indCust: "" });
    const companyName = form.companyName.trim();
    const email = form.email.trim();
    const location = form.location.trim();
    const catErr = composeIndustryErrors(
      form.industryCategory,
      form.industryOther
    );
    if (catErr.category || catErr.custom) {
      setFieldErrors({ indCat: catErr.category, indCust: catErr.custom });
      return;
    }
    const industryOther =
      form.industryCategory === OTHER_LABEL ? form.industryOther.trim() : "";
    if (
      !companyName ||
      !email ||
      !form.industryCategory ||
      !location ||
      !form.password ||
      !form.confirmPassword
    ) {
      setError("Please fill in all fields.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
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
    <div className="register-page company-register-page">
      <div className="register-left">
        <div className="register-overlay"></div>

        <div className="register-left-content">
          <div className="top-white-dot"></div>

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

          <div className="bottom-joined">
            <div className="avatars">
              <img
                src="https://randomuser.me/api/portraits/men/32.jpg"
                alt="avatar1"
              />
              <img
                src="https://randomuser.me/api/portraits/women/44.jpg"
                alt="avatar2"
              />
              <img
                src="https://randomuser.me/api/portraits/men/67.jpg"
                alt="avatar3"
              />
            </div>

            <p>
              <strong>220+ professionals</strong> joined this week
            </p>
          </div>
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
            <label>Company name</label>
            <input
              name="companyName"
              type="text"
              placeholder="Your company name"
              value={form.companyName}
              onChange={handleChange}
              required
            />

            <label>Email Address</label>
            <input
              name="email"
              type="email"
              placeholder="hr@company.com"
              value={form.email}
              onChange={handleChange}
              required
            />

            <CategoryPicker
              variant="company"
              idPrefix="reg-ind"
              category={form.industryCategory}
              custom={form.industryOther}
              categoryError={fieldErrors.indCat}
              customError={fieldErrors.indCust}
              onCategoryChange={(v) =>
                setForm((prev) => ({ ...prev, industryCategory: v }))
              }
              onCustomChange={(v) =>
                setForm((prev) => ({ ...prev, industryOther: v }))
              }
            />

            <label>Location</label>
            <input
              name="location"
              type="text"
              placeholder="Beirut"
              value={form.location}
              onChange={handleChange}
              required
            />

            <label>Password</label>
            <input
              name="password"
              type="password"
              placeholder="Min. 8 characters"
              value={form.password}
              onChange={handleChange}
              required
              minLength={6}
            />

            <label>Confirm Password</label>
            <input
              name="confirmPassword"
              type="password"
              placeholder="Repeat password"
              value={form.confirmPassword}
              onChange={handleChange}
              required
            />

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
    </div>
  );
}

export default CompanyRegister;
