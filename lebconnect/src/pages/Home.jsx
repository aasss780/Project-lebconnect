import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { formatRelativeTime, initialsFromName } from "../utils/format";
import { getRole, getUser, isLoggedIn } from "../utils/auth";

const CATEGORY_FILTER = {
  all: () => true,
  tech: (j) =>
    /tech|software|developer|engineer|it |react|node|devops|data/i.test(
      `${j.title} ${j.company} ${j.type}`
    ),
  finance: (j) =>
    /finance|bank|analyst|account|invest/i.test(
      `${j.title} ${j.company} ${j.type}`
    ),
  marketing: (j) =>
    /market|brand|content|seo|growth|sales/i.test(
      `${j.title} ${j.company} ${j.type}`
    ),
  design: (j) =>
    /design|ux|ui|graphic|creative/i.test(
      `${j.title} ${j.company} ${j.type}`
    ),
  media: (j) =>
    /media|journal|video|copy|social|broadcast/i.test(
      `${j.title} ${j.company} ${j.type}`
    ),
};
import "./Home.css";

const features = [
  {
    icon: "👤",
    title: "Smart Profile Builder",
    text: "Create a compelling professional profile with skills, experience, and CV upload. Get noticed by top Lebanese employers.",
    tint: "blue",
  },
  {
    icon: "🔍",
    title: "Advanced Job Search",
    text: "Filter jobs by location, salary, category, and company. Find exactly what you're looking for across Lebanon.",
    tint: "green",
  },
  {
    icon: "💬",
    title: "Direct Messaging",
    text: "Chat directly with companies or candidates. Build meaningful professional connections in real-time.",
    tint: "orange",
  },
  {
    icon: "🔔",
    title: "Smart Notifications",
    text: "Stay updated on application status, new messages, and job matches tailored to your profile.",
    tint: "purple",
  },
  {
    icon: "🏢",
    title: "Company Profiles",
    text: "Explore detailed company profiles, culture, team size, and active job listings before applying.",
    tint: "teal",
  },
  {
    icon: "🛡️",
    title: "Verified Accounts",
    text: "All companies and candidates go through email verification, ensuring a secure and trusted platform.",
    tint: "red",
  },
];

const FALLBACK_JOBS = [
  {
    company: "TechBeirut",
    title: "Senior React Developer",
    location: "Beirut",
    type: "Full-time",
    salary: "$2,500 – $3,500/mo",
    applicants: 14,
    time: "2 days ago",
    logo: "TECH",
    logoClass: "logo-tech",
    apiJobId: null,
    companyId: null,
  },
  {
    company: "Phoenix Media Group",
    title: "Digital Marketing Specialist",
    location: "Beirut",
    type: "Full-time",
    salary: "$1,800 – $2,400/mo",
    applicants: 22,
    time: "1 day ago",
    logo: "PM",
    logoClass: "logo-phoenix",
    apiJobId: null,
    companyId: null,
  },
  {
    company: "Blom Invest Bank",
    title: "Financial Analyst",
    location: "Beirut",
    type: "Full-time",
    salary: "$2,000 – $3,000/mo",
    applicants: 31,
    time: "3 days ago",
    logo: "B",
    logoClass: "logo-bank",
    apiJobId: null,
    companyId: null,
  },
  {
    company: "Cedar Tech Solutions",
    title: "Node.js Backend Developer",
    location: "Tripoli",
    type: "Full-time",
    salary: "$2,000 – $2,800/mo",
    applicants: 9,
    time: "5 days ago",
    logo: "CT",
    logoClass: "logo-cedar",
    apiJobId: null,
    companyId: null,
  },
  {
    company: "TechBeirut",
    title: "UX/UI Designer",
    location: "Beirut",
    type: "Full-time",
    salary: "$1,500 – $2,500/mo",
    applicants: 17,
    time: "1 week ago",
    logo: "TECH",
    logoClass: "logo-tech",
    apiJobId: null,
    companyId: null,
  },
  {
    company: "Phoenix Media Group",
    title: "Content Creator & Copywriter",
    location: "Saida",
    type: "Part-time",
    salary: "$800 – $1,200/mo",
    applicants: 28,
    time: "4 days ago",
    logo: "PM",
    logoClass: "logo-phoenix",
    apiJobId: null,
    companyId: null,
  },
];

const FALLBACK_COMPANIES = [
  {
    id: null,
    name: "TechBeirut",
    field: "Technology",
    city: "Beirut",
    roles: "4 open roles",
    logo: "TTech",
    cls: "company-logo-tech",
  },
  {
    id: null,
    name: "Blom Invest Bank",
    field: "Banking & Finance",
    city: "Beirut",
    roles: "6 open roles",
    logo: "Hana",
    cls: "company-logo-bank",
  },
  {
    id: null,
    name: "Cedar Tech Solutions",
    field: "IT Consulting",
    city: "Tripoli",
    roles: "3 open roles",
    logo: "🌳",
    cls: "company-logo-tree",
  },
  {
    id: null,
    name: "Phoenix Media Group",
    field: "Media & Marketing",
    city: "Beirut",
    roles: "5 open roles",
    logo: "Content",
    cls: "company-logo-orange",
  },
];

function StarDisplay({ rating }) {
  const n = Number(rating) || 0;
  return (
    <div className="stars lc-star-display" aria-label={`${n} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= n ? "lc-star-on" : "lc-star-muted"}>
          ★
        </span>
      ))}
    </div>
  );
}

const JOB_LOGO_CLASSES = ["logo-tech", "logo-phoenix", "logo-bank", "logo-cedar"];
const COMPANY_CARD_CLS = [
  "company-logo-tech",
  "company-logo-bank",
  "company-logo-tree",
  "company-logo-orange",
];

function formatStatNum(n) {
  if (n == null || Number.isNaN(Number(n))) return null;
  const v = Number(n);
  return `${v.toLocaleString()}+`;
}

function mapJobFromApi(j, idx) {
  const comp = j.company || {};
  const name = comp.companyName || comp.company_name || "Company";
  const jid = j.id ?? j._id;
  const companyId = comp.id ?? comp._id ?? comp.company_user_id ?? null;
  const initials =
    initialsFromName(name).length > 4 ? initialsFromName(name).slice(0, 4) : initialsFromName(name);

  return {
    company: name,
    title: j.title,
    location: j.location || "",
    type: j.type || "",
    salary: j.salary || "",
    applicants: j.applicantsCount ?? j.applicants_count ?? 0,
    time: formatRelativeTime(j.createdAt || j.created_at) || "Recently",
    logo: initials || "LB",
    logoClass: JOB_LOGO_CLASSES[idx % JOB_LOGO_CLASSES.length],
    apiJobId: jid,
    companyId,
  };
}

function mapCompanyFromApi(c, idx) {
  const id = c.id ?? c._id;
  const open = c.openRolesCount ?? c.open_roles_count ?? 0;
  return {
    id,
    name: c.companyName || c.company_name || "Company",
    field: c.industry || "",
    city: c.location || "",
    roles: `${open} open roles`,
    logo: (c.companyName || "Co").slice(0, 6),
    cls: COMPANY_CARD_CLS[idx % COMPANY_CARD_CLS.length],
  };
}

function Home() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [jobsList, setJobsList] = useState(FALLBACK_JOBS);
  const [companiesList, setCompaniesList] = useState(FALLBACK_COMPANIES);
  const [jobSearch, setJobSearch] = useState("");
  const [jobCategory, setJobCategory] = useState("all");
  const [savedJobIds, setSavedJobIds] = useState(() => new Set());

  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewGuestName, setReviewGuestName] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewFieldErrors, setReviewFieldErrors] = useState({
    name: "",
    comment: "",
  });

  const reviewer = isLoggedIn() ? getUser() : null;
  const autoReviewerName =
    reviewer &&
    (
      reviewer.fullName?.trim() ||
      reviewer.companyName?.trim() ||
      reviewer.email?.trim() ||
      ""
    );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setReviewsLoading(true);
      try {
        const { data } = await api.get("/api/site-reviews");
        if (!cancelled) setReviews(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setReviews([]);
      } finally {
        if (!cancelled) setReviewsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [st, hj, hc] = await Promise.all([
          api.get("/api/home/stats").catch(() => null),
          api.get("/api/home/jobs").catch(() => null),
          api.get("/api/home/companies").catch(() => null),
        ]);

        if (cancelled) return;

        if (st?.data) setStats(st.data);

        if (hj?.data?.length) {
          setJobsList(hj.data.map((j, i) => mapJobFromApi(j, i)));
        }

        if (hc?.data?.length) {
          setCompaniesList(hc.data.map((c, i) => mapCompanyFromApi(c, i)));
        }
      } catch {
        /* fall back to static */
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (getRole() !== "candidate" || !isLoggedIn()) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/api/jobs/saved/my");
        if (cancelled) return;
        const ids = new Set(
          (Array.isArray(data) ? data : []).map((j) => j.id ?? j._id).filter(Boolean)
        );
        setSavedJobIds(ids);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const seekers = stats?.jobSeekers;
  const comps = stats?.companies;
  const jobsPosted = stats?.jobsPosted;
  const placement = stats?.placementRate;

  const heroSeekers = formatStatNum(seekers) ?? "12,000+";
  const heroCompanies = formatStatNum(comps) ?? "1,800+";
  const heroJobs = formatStatNum(jobsPosted) ?? "5,400+";

  const bandPlacement =
    placement != null ? `${placement}%` : "94%";

  const filteredJobsList = useMemo(() => {
    const q = jobSearch.trim().toLowerCase();
    const catFn = CATEGORY_FILTER[jobCategory] || CATEGORY_FILTER.all;
    return jobsList.filter((j) => {
      if (!catFn(j)) return false;
      if (!q) return true;
      return (
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        j.location.toLowerCase().includes(q) ||
        (j.type && j.type.toLowerCase().includes(q))
      );
    });
  }, [jobsList, jobSearch, jobCategory]);

  const toggleSaveJob = async (e, job) => {
    e.stopPropagation();
    if (!isLoggedIn()) {
      navigate("/login");
      return;
    }
    if (getRole() !== "candidate") {
      alert("Only candidates can save jobs.");
      return;
    }
    if (!job.apiJobId) return;
    const jid = job.apiJobId;
    try {
      if (savedJobIds.has(jid)) {
        await api.delete(`/api/jobs/${jid}/save`);
        setSavedJobIds((prev) => {
          const n = new Set(prev);
          n.delete(jid);
          return n;
        });
      } else {
        await api.post(`/api/jobs/${jid}/save`);
        setSavedJobIds((prev) => new Set(prev).add(jid));
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Could not update saved jobs.");
    }
  };

  const submitSiteReview = async (e) => {
    e.preventDefault();
    setReviewMessage("");
    const err = { name: "", comment: "" };
    const comment = reviewComment.trim();
    if (!autoReviewerName) {
      const n = reviewGuestName.trim();
      if (!n) err.name = "Please enter your name.";
      else if (n.length < 2) err.name = "Name is too short.";
    }
    if (!comment) err.comment = "Please write a comment.";
    else if (comment.length < 3) err.comment = "Comment must be at least 3 characters.";
    setReviewFieldErrors(err);
    if (err.name || err.comment) return;

    const body = {
      rating: reviewRating,
      comment,
    };
    if (!autoReviewerName) body.name = reviewGuestName.trim();

    setReviewSaving(true);
    try {
      await api.post("/api/site-reviews", body);
      setReviewComment("");
      setReviewGuestName("");
      setReviewRating(5);
      setReviewMessage("Thanks — your review was posted.");
      const { data } = await api.get("/api/site-reviews");
      setReviews(Array.isArray(data) ? data : []);
    } catch (er) {
      setReviewMessage(
        er.response?.data?.message ||
          er.message ||
          "Could not submit review."
      );
    } finally {
      setReviewSaving(false);
    }
  };

  const handleApply = async (job) => {
    if (!isLoggedIn()) {
      navigate("/login");
      return;
    }
    const role = getRole();
    if (role === "company" || role === "admin") {
      alert("Only candidates can apply to jobs.");
      return;
    }
    if (!job.apiJobId) {
      alert("Open Find Jobs from your dashboard to apply.");
      return;
    }
    navigate("/candidate-dashboard", {
      replace: false,
      state: { tab: "findJobs", openApplyJobId: job.apiJobId },
    });
  };

  return (
    <div className="home-page">
      <header className="home-navbar">
        <div className="nav-inner">
          <div className="nav-left">
            <div
              className="brand-mark"
              role="button"
              tabIndex={0}
              onClick={() => navigate("/")}
              onKeyDown={(e) => e.key === "Enter" && navigate("/")}
            >
              <div className="brand-center"></div>
            </div>
            <nav className="nav-links">
              <a href="#jobs">Jobs</a>
              <a href="#companies">Companies</a>
              <a href="#features">Features</a>
              <a href="#footer">About</a>
            </nav>
          </div>

          <div className="nav-actions">
            <button
              type="button"
              className="nav-btn nav-btn-outline"
              onClick={() => navigate("/login")}
            >
              Sign In
            </button>
            <button
              type="button"
              className="nav-btn nav-btn-filled"
              onClick={() => navigate("/choose-role")}
            >
              Join Now
            </button>
          </div>
        </div>
      </header>

      <section className="hero-section">
        <div className="hero-overlay"></div>
        <div className="hero-inner">
          <div className="hero-badge">
            <span className="badge-mini">LB</span>
            Lebanon&apos;s #1 Professional Network
          </div>

          <h1 className="hero-title">
            Find Your Next
            <br />
            <span>Opportunity</span>
            <br />
            in Lebanon
          </h1>

          <p className="hero-description">
            Connect with top Lebanese companies and discover jobs in Beirut,
            Tripoli, Saida, and beyond. Your career starts here.
          </p>

          <div className="hero-buttons">
            <button
              type="button"
              className="hero-btn hero-btn-light"
              onClick={() => navigate("/choose-role")}
            >
              Get Started
            </button>
            <button
              type="button"
              className="hero-btn hero-btn-outline"
              onClick={() =>
                navigate(isLoggedIn() ? "/company-dashboard" : "/choose-role")
              }
            >
              Post a Job
            </button>
          </div>

          <div className="hero-stats">
            <div className="hero-stat">
              <h3>{heroSeekers}</h3>
              <p>Job Seekers</p>
            </div>
            <div className="hero-stat">
              <h3>{heroCompanies}</h3>
              <p>Companies</p>
            </div>
            <div className="hero-stat">
              <h3>{heroJobs}</h3>
              <p>Jobs Posted</p>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="content-section features-section">
        <p className="section-kicker centered">WHY LEBCONNECT</p>
        <h2 className="section-title centered">
          Everything You Need to
          <br />
          <span>Succeed Professionally</span>
        </h2>
        <p className="section-subtitle centered section-subtitle-wide">
          Built specifically for Lebanon&apos;s professional landscape with features that matter.
        </p>

        <div className="features-grid">
          {features.map((item) => (
            <div className="feature-card" key={item.title}>
              <div className={`feature-badge ${item.tint}`}>{item.icon}</div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="jobs" className="content-section jobs-section">
        <div className="jobs-header">
          <div>
            <p className="section-kicker">LATEST OPENINGS</p>
            <h2 className="section-title section-title-left">
              Jobs Across
              <br />
              <span>Lebanon</span>
            </h2>
          </div>

          <p className="jobs-side-text">
            Browse opportunities in tech, finance, marketing,
            <br />
            and more — from Beirut to Tripoli.
          </p>
        </div>

        <div className="jobs-toolbar" style={{ marginBottom: 16, maxWidth: 400 }}>
          <label htmlFor="home-job-search" className="sr-only">
            Search jobs
          </label>
          <input
            id="home-job-search"
            type="search"
            placeholder="Filter jobs by title, company, location…"
            value={jobSearch}
            onChange={(e) => setJobSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              fontSize: 15,
            }}
          />
        </div>

        <div className="category-row">
          {[
            ["all", "All"],
            ["tech", "Technology"],
            ["finance", "Finance"],
            ["marketing", "Marketing"],
            ["design", "Design"],
            ["media", "Media"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={
                jobCategory === key ? "category-btn active" : "category-btn"
              }
              onClick={() => setJobCategory(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="jobs-grid">
          {filteredJobsList.length === 0 ? (
            <p style={{ gridColumn: "1 / -1", padding: "24px 0", color: "#64748b" }}>
              No jobs match your filters. Try another category or clear the search.
            </p>
          ) : null}
          {filteredJobsList.map((job, idx) => (
            <div
              className="job-card"
              key={`${job.title}-${job.company}-${idx}`}
            >
              <div className="job-card-top">
                <div className="job-company">
                  <div className={`job-logo ${job.logoClass}`}>{job.logo}</div>
                  <div>
                    <button
                      type="button"
                      className="job-company-name"
                      style={{
                        background: "none",
                        border: "none",
                        padding: 0,
                        cursor: job.companyId ? "pointer" : "default",
                        textAlign: "left",
                        font: "inherit",
                        color: "inherit",
                      }}
                      onClick={() =>
                        job.companyId &&
                        navigate(`/company-profile/${job.companyId}`)
                      }
                    >
                      {job.company}
                    </button>
                    <h3>{job.title}</h3>
                  </div>
                </div>
                <button
                  type="button"
                  className="job-bookmark"
                  title={savedJobIds.has(job.apiJobId) ? "Remove save" : "Save job"}
                  onClick={(e) => toggleSaveJob(e, job)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "1.25rem",
                  }}
                >
                  {savedJobIds.has(job.apiJobId) ? "📌" : "🔖"}
                </button>
              </div>

              <div className="job-tags">
                <span className="tag tag-location">📍 {job.location}</span>
                <span className="tag tag-type">{job.type}</span>
                <span className="tag tag-salary">{job.salary}</span>
              </div>

              <div className="job-meta">
                <span>👥 {job.applicants} applicants</span>
                <span>{job.time}</span>
              </div>

              <button
                type="button"
                className="apply-btn"
                onClick={() => handleApply(job)}
              >
                Apply Now
              </button>
            </div>
          ))}
        </div>
      </section>

      <section id="companies" className="content-section companies-section">
        <p className="section-kicker centered">TOP EMPLOYERS</p>
        <h2 className="section-title centered">
          Companies Hiring
          <br />
          <span>Right Now</span>
        </h2>

        <div className="companies-grid">
          {companiesList.map((company, idx) => (
            <div
              className="company-card"
              key={company.id ?? `${company.name}-${idx}`}
              role={company.id ? "button" : undefined}
              onClick={() => {
                if (company.id) navigate(`/company-profile/${company.id}`);
              }}
              style={company.id ? { cursor: "pointer" } : undefined}
            >
              <div className={`company-logo ${company.cls}`}>{company.logo}</div>
              <h3>{company.name}</h3>
              <p className="company-field">{company.field}</p>
              <p className="company-city">📍 {company.city}</p>
              <div className="open-roles">{company.roles}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="reviews" className="content-section testimonials-section">
        <h2 className="section-title centered">
          Trusted by Professionals
          <br />
          <span>Across Lebanon</span>
        </h2>

        {reviewsLoading ? (
          <p className="reviews-status-line">Loading reviews…</p>
        ) : null}

        {!reviewsLoading && reviews.length === 0 ? (
          <p className="reviews-status-line reviews-status-line--muted">
            No reviews yet — be the first to share feedback below.
          </p>
        ) : null}

        <div className="testimonials-grid">
          {reviews.map((item) => (
            <div className="testimonial-card" key={item.id}>
              <StarDisplay rating={item.rating} />
              <p className="testimonial-text">{item.comment}</p>
              <div className="testimonial-user">
                <div className="review-avatar-chip" aria-hidden="true">
                  {initialsFromName(item.name || "?")}
                </div>
                <div>
                  <h4>{item.name}</h4>
                  <p>{formatRelativeTime(item.createdAt)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="leave-review-panel">
          <h3 className="leave-review-title">Leave a Review</h3>
          <p className="leave-review-sub">
            Share your honest experience — your voice helps shape LebConnect.
          </p>
          <form className="leave-review-form" onSubmit={submitSiteReview}>
            {!autoReviewerName ? (
              <label className="leave-review-label">
                Your name
                <input
                  type="text"
                  className={reviewFieldErrors.name ? "lc-input-has-error" : ""}
                  value={reviewGuestName}
                  onChange={(e) => setReviewGuestName(e.target.value)}
                  placeholder="How should we show your name?"
                  autoComplete="name"
                />
                {reviewFieldErrors.name ? (
                  <span className="lc-inline-error" role="alert">
                    {reviewFieldErrors.name}
                  </span>
                ) : null}
              </label>
            ) : (
              <p className="leave-review-signed">
                Posting as <strong>{autoReviewerName}</strong>
              </p>
            )}

            <div className="leave-review-rating-block">
              <span className="leave-review-label-text">Rating</span>
              <div className="leave-review-stars-input" role="group" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={
                      n <= reviewRating
                        ? "lc-star-btn lc-star-btn--on"
                        : "lc-star-btn"
                    }
                    onClick={() => setReviewRating(n)}
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            <label className="leave-review-label">
              Comment
              <textarea
                className={reviewFieldErrors.comment ? "lc-input-has-error" : ""}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                rows={4}
                placeholder="What worked well? What could be better?"
              />
              {reviewFieldErrors.comment ? (
                <span className="lc-inline-error" role="alert">
                  {reviewFieldErrors.comment}
                </span>
              ) : null}
            </label>

            {reviewMessage ? (
              <p
                className={
                  reviewMessage.startsWith("Thanks")
                    ? "leave-review-banner leave-review-banner--ok"
                    : "leave-review-banner leave-review-banner--err"
                }
                role="status"
              >
                {reviewMessage}
              </p>
            ) : null}

            <button type="submit" className="leave-review-submit" disabled={reviewSaving}>
              {reviewSaving ? "Submitting…" : "Submit review"}
            </button>
          </form>
        </div>
      </section>

      <section className="stats-band">
        <div className="band-item">
          <div className="band-icon">👤</div>
          <h3>{heroSeekers}</h3>
          <p>Job Seekers</p>
        </div>
        <div className="band-item">
          <div className="band-icon">🏢</div>
          <h3>{heroCompanies}</h3>
          <p>Companies</p>
        </div>
        <div className="band-item">
          <div className="band-icon">💼</div>
          <h3>{heroJobs}</h3>
          <p>Jobs Posted</p>
        </div>
        <div className="band-item">
          <div className="band-icon">✔</div>
          <h3>{bandPlacement}</h3>
          <p>Placement Rate</p>
        </div>
      </section>

      <footer id="footer" className="footer-section">
        <div className="footer-cta">
          <div>
            <h2>Ready to Launch Your Career?</h2>
            <p>Join 12,000+ professionals on Lebanon&apos;s top hiring platform.</p>
          </div>

          <button
            type="button"
            className="footer-cta-btn"
            onClick={() => navigate("/choose-role")}
          >
            Join LebConnect Free →
          </button>
        </div>

        <div className="footer-bottom">
          <div className="footer-brand">
            <div className="footer-white-dot"></div>
            <p>
              Lebanon&apos;s premier professional network connecting
              talent with opportunities nationwide.
            </p>
          </div>

          <div className="footer-columns">
            <div>
              <h4>PLATFORM</h4>
              <a href="#jobs">Find Jobs</a>
              <button
                type="button"
                className="footer-link-btn"
                onClick={() =>
                  navigate(
                    isLoggedIn() ? "/company-dashboard" : "/choose-role"
                  )
                }
              >
                Post a Job
              </button>
              <a href="#companies">Companies</a>
            </div>
            <div>
              <h4>COMPANY</h4>
              <a href="#footer">About Us</a>
              <a href="#footer">Careers</a>
              <a href="#footer">Blog</a>
            </div>
            <div>
              <h4>SUPPORT</h4>
              <a href="#footer">Help Center</a>
              <a href="#footer">Privacy Policy</a>
              <a href="#footer">Terms of Use</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Home;
