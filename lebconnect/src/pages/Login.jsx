import { useState } from "react";

import { useNavigate } from "react-router-dom";

import api from "../api/axios";

import ErrorMessage from "../components/ErrorMessage";

import { dashboardPath, setAuth } from "../utils/auth";

import "./Login.css";



const ADMIN_LOGIN_EMAIL = "admin@lebconnect.com";



/**

 * Validates API user.role vs selected login tab.

 * Never call setAuth before this passes.

 */

function roleMismatchMessage(portal, role) {

  if (portal === "jobseeker") {

    if (role === "candidate") return null;

    return "This account is not a Job Seeker account";

  }

  if (portal === "company") {

    if (role === "company") return null;

    return "This account is not a Company account";

  }

  if (portal === "admin") {

    if (role === "admin") return null;

    return "Invalid administrator credentials.";

  }

  return "Login is not allowed for this account type.";

}



function Login() {

  const navigate = useNavigate();

  const [portal, setPortal] = useState("jobseeker"); // jobseeker | company | admin

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

      setResetSuccess("Password updated. You can close this dialog and sign in.");

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



    if (portal === "admin" && em.toLowerCase() !== ADMIN_LOGIN_EMAIL) {

      setError("Use the administrator email to sign in here.");

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

        err.response?.data?.message ||

        err.message ||

        "Login failed";

      setError(msg);

    } finally {

      setLoading(false);

    }

  };



  return (

    <>

    <div className="login-page">

      <div className="login-left">

        <div className="login-left-overlay"></div>



        <div className="login-left-content">

          <div className="login-top-dot"></div>



          <h1 className="login-hero-title">

            Lebanon&apos;s Professional

            <br />

            Network

          </h1>



          <p className="login-hero-text">

            Connect with top companies, discover career opportunities, and

            build your professional future in Lebanon and beyond.

          </p>



          <div className="stats-row">

            <div className="stat-card">

              <h3>12K+</h3>

              <p>Job Seekers</p>

            </div>



            <div className="stat-card">

              <h3>1.8K+</h3>

              <p>Companies</p>

            </div>



            <div className="stat-card">

              <h3>5.4K+</h3>

              <p>Jobs Posted</p>

            </div>

          </div>



          <div className="testimonial-card">

            <p className="testimonial-text">

              “LebConnect helped me land my dream role at a leading tech

              company in Beirut within just 2 weeks of signing up!”

            </p>



            <div className="testimonial-user">

              <img

                src="https://randomuser.me/api/portraits/women/68.jpg"

                alt="Lara Khoury"

              />



              <div>

                <h4>Lara Khoury</h4>

                <p>Software Engineer, Tripoli</p>

              </div>

            </div>

          </div>

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

              ? "Restricted access"

              : "Sign in to your LebConnect account"}

          </p>



          <div className="login-tabs login-tabs--triple">

            <button

              type="button"

              className={

                portal === "jobseeker" ? "tab-btn active" : "tab-btn"

              }

              onClick={() => handlePortalChange("jobseeker")}

            >

              <span className="tab-icon">◌</span>

              Job Seeker

            </button>



            <button

              type="button"

              className={portal === "company" ? "tab-btn active" : "tab-btn"}

              onClick={() => handlePortalChange("company")}

            >

              <span className="tab-icon">▥</span>

              Company

            </button>



            <button

              type="button"

              className={portal === "admin" ? "tab-btn active tab-btn-admin" : "tab-btn tab-btn-admin"}

              onClick={() => handlePortalChange("admin")}

            >

              Admin

            </button>

          </div>



          {portal === "admin" ? (

            <p className="login-admin-hint">

              Only <strong>{ADMIN_LOGIN_EMAIL}</strong> may use this tab.

            </p>

          ) : null}



          <ErrorMessage message={error} onDismiss={() => setError("")} />



          <form className="login-form" onSubmit={handleSubmit}>

            <label>Email Address</label>

            <div className="input-box">

              <span className="input-icon">✉</span>

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

              <span className="input-icon">⌂</span>

              <input

                type="password"

                placeholder="••••••••"

                value={password}

                onChange={(e) => setPassword(e.target.value)}

                autoComplete="current-password"

              />

              <span className="eye-icon" aria-hidden>

                ◉

              </span>

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

            <p>or continue with</p>

            <span></span>

          </div>



          <div className="social-login-row">

            <button

              type="button"

              className="social-login-btn lc-disabled-nav"

              disabled

              title="OAuth is not configured for this demo"

            >

              <span className="social-mark google-mark">G</span>

              Google

            </button>



            <button

              type="button"

              className="social-login-btn lc-disabled-nav"

              disabled

              title="OAuth is not configured for this demo"

            >

              <span className="social-mark linkedin-mark">in</span>

              LinkedIn

            </button>

          </div>



          <p className="join-line">

            Don&apos;t have an account?{" "}

            <button

              type="button"

              className="join-line-link"

              onClick={() => navigate("/choose-role")}

            >

              Join now

            </button>

          </p>



        </div>

      </div>

    </div>



      {resetOpen ? (

        <div className="lc-reset-overlay">

          <div className="lc-reset-modal">

            <div className="lc-reset-modal-head">

              <h3>Reset password</h3>

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

              Enter the email linked to your account and choose a new password.

              Your new password applies immediately — no verification email for this release.

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



              {resetError ? <p className="lc-reset-msg lc-reset-msg--err">{resetError}</p> : null}

              {resetSuccess ? <p className="lc-reset-msg lc-reset-msg--ok">{resetSuccess}</p> : null}



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

