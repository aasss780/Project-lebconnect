import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import ErrorMessage from "../components/ErrorMessage";
import CategoryPicker from "../components/CategoryPicker";
import {
  composeCategoryErrors,
  OTHER_LABEL,
} from "../constants/categories";
import "./Register.css";

function Register() {
  const navigate = useNavigate();
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
    specCat: "",
    specCust: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setFieldErrors({ specCat: "", specCust: "" });
    const fullName = form.fullName.trim();
    const email = form.email.trim();
    const catErrs = composeCategoryErrors(
      form.specializationCategory,
      form.specializationOther
    );
    if (catErrs.category || catErrs.custom) {
      setFieldErrors({ specCat: catErrs.category, specCust: catErrs.custom });
      return;
    }
    const specializationOther =
      form.specializationCategory === OTHER_LABEL
        ? form.specializationOther.trim()
        : "";
    if (
      !fullName ||
      !email ||
      !form.specializationCategory ||
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
      await api.post("/api/auth/register/candidate", {
        fullName,
        email,
        password: form.password,
        specializationCategory: form.specializationCategory.trim(),
        specializationOther,
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
    <div className="register-page">
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
              <span>Browse 5,400+ job listings</span>
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
            <label>Full Name</label>
            <input
              name="fullName"
              type="text"
              placeholder="Your full name"
              value={form.fullName}
              onChange={handleChange}
              required
            />

            <label>Email Address</label>
            <input
              name="email"
              type="email"
              placeholder="your@email.com"
              value={form.email}
              onChange={handleChange}
              required
            />

            <CategoryPicker
              variant="candidate"
              idPrefix="reg-spec"
              category={form.specializationCategory}
              custom={form.specializationOther}
              categoryError={fieldErrors.specCat}
              customError={fieldErrors.specCust}
              onCategoryChange={(v) =>
                setForm((prev) => ({ ...prev, specializationCategory: v }))
              }
              onCustomChange={(v) =>
                setForm((prev) => ({ ...prev, specializationOther: v }))
              }
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

export default Register;
