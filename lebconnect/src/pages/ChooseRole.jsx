import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./ChooseRole.css";

function ChooseRole() {
  const [selectedRole, setSelectedRole] = useState("jobseeker");
  const navigate = useNavigate();

  return (
    <div className="choose-role-page">
      <div className="left-panel">
        <div className="left-overlay"></div>

        <div className="left-content">
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

      <div className="right-panel">
        <div className="auth-form-shell choose-role-shell">
          <div className="auth-form-scroll">
            <p
              className="back-home-link"
              role="button"
              tabIndex={0}
              onClick={() => navigate("/")}
              onKeyDown={(e) => e.key === "Enter" && navigate("/")}
            >
              ← Back to Home
            </p>
            <h2>Join LebConnect</h2>
            <p className="subtitle">Choose how you want to join</p>

            <div
              className={`role-card ${selectedRole === "jobseeker" ? "active" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedRole("jobseeker")}
              onKeyDown={(e) => {
                if (e.key === " ") e.preventDefault();
                if (e.key === "Enter" || e.key === " ")
                  setSelectedRole("jobseeker");
              }}
            >
            <div className="role-card-left">
              <div className="role-icon role-icon-blue">
                <svg viewBox="0 0 24 24" fill="none">
                  <circle
                    cx="12"
                    cy="8"
                    r="3.5"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M5.5 18.5C6.8 15.8 9 14.5 12 14.5C15 14.5 17.2 15.8 18.5 18.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              <div className="role-text">
                <h3>I&apos;m a Job Seeker</h3>
                <p>Find jobs, build your profile, get hired</p>
              </div>
            </div>

            <div
              className={`check-circle ${
                selectedRole === "jobseeker" ? "checked" : ""
              }`}
            >
              {selectedRole === "jobseeker" && "✓"}
            </div>
          </div>

            <div
              className={`role-card ${selectedRole === "company" ? "active" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedRole("company")}
              onKeyDown={(e) => {
                if (e.key === " ") e.preventDefault();
                if (e.key === "Enter" || e.key === " ")
                  setSelectedRole("company");
              }}
            >
            <div className="role-card-left">
              <div className="role-icon role-icon-gray">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M6 20V8H18V20"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M9 8V4H15V8"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M10 12H10.01"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M14 12H14.01"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M10 16H10.01"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M14 16H14.01"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              <div className="role-text">
                <h3>I&apos;m Hiring / a Company</h3>
                <p>Post jobs, find talent, grow your team</p>
              </div>
            </div>

            <div
              className={`check-circle ${
                selectedRole === "company" ? "checked" : ""
              }`}
            >
              {selectedRole === "company" && "✓"}
            </div>
            </div>

            <div className="or-divider or-divider--compact">
              <span></span>
              <p>or sign up with</p>
              <span></span>
            </div>

            <div className="social-row social-row--compact">
              <button
                type="button"
                className="social-btn lc-disabled-nav"
                disabled
                title="OAuth is not configured for this demo"
              >
                <span className="social-icon google-icon">G</span>
                <span>Google</span>
              </button>

              <button
                type="button"
                className="social-btn lc-disabled-nav"
                disabled
                title="OAuth is not configured for this demo"
              >
                <span className="social-icon linkedin-icon">in</span>
                <span>LinkedIn</span>
              </button>
            </div>

            <p className="signin-text signin-text--choose">
              Already have an account?{" "}
              <button
                type="button"
                className="choose-signin-link"
                onClick={() => navigate("/login")}
              >
                Sign in
              </button>
            </p>
          </div>

          <div className="auth-form-footer">
            <button
              type="button"
              className="continue-btn"
              onClick={() =>
                navigate(
                  selectedRole === "jobseeker"
                    ? "/register"
                    : "/company-register"
                )
              }
            >
              {selectedRole === "jobseeker"
                ? "Continue as Job Seeker →"
                : "Continue as Company →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChooseRole;