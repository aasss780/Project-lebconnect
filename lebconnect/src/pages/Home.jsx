import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useToast } from "../context/ToastContext";
import { formatRelativeTime, initialsFromName } from "../utils/format";
import { getRole, getUser, isLoggedIn } from "../utils/auth";
import { motion } from "framer-motion";
import { lcMotionPage, LC_STAGGER_CONTAINER, LC_STAGGER_ITEM } from "../utils/motionProps";
import ThemeToggle from "../components/ThemeToggle";

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
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [jobsList, setJobsList] = useState([]);
  const [companiesList, setCompaniesList] = useState([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsLoadError, setStatsLoadError] = useState(false);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsLoadError, setJobsLoadError] = useState(false);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [companiesLoadError, setCompaniesLoadError] = useState(false);
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
      setStatsLoading(true);
      setJobsLoading(true);
      setCompaniesLoading(true);
      const [st, hj, hc] = await Promise.allSettled([
        api.get("/api/home/stats"),
        api.get("/api/home/jobs"),
        api.get("/api/home/companies"),
      ]);
      if (cancelled) return;

      if (st.status === "fulfilled") {
        setStats(st.value?.data && typeof st.value.data === "object" ? st.value.data : {});
        setStatsLoadError(false);
      } else {
        setStats({});
        setStatsLoadError(true);
      }
      setStatsLoading(false);

      if (hj.status === "fulfilled") {
        const list = Array.isArray(hj.value?.data) ? hj.value.data : [];
        setJobsList(list.map((j, i) => mapJobFromApi(j, i)));
        setJobsLoadError(false);
      } else {
        setJobsList([]);
        setJobsLoadError(true);
      }
      setJobsLoading(false);

      if (hc.status === "fulfilled") {
        const list = Array.isArray(hc.value?.data) ? hc.value.data : [];
        setCompaniesList(list.map((c, i) => mapCompanyFromApi(c, i)));
        setCompaniesLoadError(false);
      } else {
        setCompaniesList([]);
        setCompaniesLoadError(true);
      }
      setCompaniesLoading(false);
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

  const heroSeekersLabel = statsLoading ? "…" : formatStatNum(seekers) ?? "0+";
  const heroCompaniesLabel = statsLoading ? "…" : formatStatNum(comps) ?? "0+";
  const heroJobsLabel = statsLoading ? "…" : formatStatNum(jobsPosted) ?? "0+";

  const bandPlacement = statsLoading ? "…" : `${Number(placement || 0)}%`;

  const footerJoinLine =
    seekers != null
      ? `Join ${formatStatNum(seekers) ?? "0+"} job seekers on LebConnect.`
      : "Join professionals across Lebanon on LebConnect.";

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

  const jobsMarqueeTrack = useMemo(() => {
    if (!filteredJobsList.length) return [];
    return [...filteredJobsList, ...filteredJobsList];
  }, [filteredJobsList]);

  const companiesMarqueeTrack = useMemo(() => {
    if (!companiesList.length) return [];
    return [...companiesList, ...companiesList];
  }, [companiesList]);

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
      toast.success("Review published. Thank you for the feedback!");
      const { data } = await api.get("/api/site-reviews");
      setReviews(Array.isArray(data) ? data : []);
    } catch (er) {
      const errText =
        er.response?.data?.message ||
        er.message ||
        "Could not submit review.";
      setReviewMessage(errText);
      toast.error(errText);
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

  const openCompanyProfile = (company) => {
    if (company?.id) navigate(`/company-profile/${company.id}`);
    else
      toast.toast(
        "This company profile is not available right now.",
        "info"
      );
  };

  return (
    <motion.div className="home-page" {...lcMotionPage()}>
      <header className="home-navbar">
        <div className="nav-inner">
          <div className="nav-left">
            <div className="nav-brand-cluster">
              <div
                className="brand-mark home-brand-mark"
                role="button"
                tabIndex={0}
                onClick={() => navigate("/")}
                onKeyDown={(e) => e.key === "Enter" && navigate("/")}
                aria-label="LebConnect home"
              >
                <div className="brand-center"></div>
              </div>
              <span className="nav-brand-wordmark" aria-hidden="true">
                LebConnect
              </span>
            </div>
            <nav className="nav-links">
              <a className="lc-nav-link lc-nav-explore-jobs" href="#jobs">
                Explore Jobs
              </a>
              <a className="lc-nav-link" href="#companies">Companies</a>
              <a className="lc-nav-link" href="#features">Features</a>
              <a className="lc-nav-link" href="#reviews">Reviews</a>
            </nav>
          </div>

          <div className="nav-actions">
            <div className="lc-home-nav-theme">
              <ThemeToggle solid />
            </div>
            <button
              type="button"
              className="nav-btn nav-btn-filled lc-btn-hit"
              onClick={() => navigate("/choose-role")}
            >
              Join Now
            </button>
            <button
              type="button"
              className="nav-btn nav-btn-outline lc-btn-hit"
              onClick={() => navigate("/login")}
            >
              Sign In
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

          <div className="hero-buttons hero-buttons--triple">
            <button
              type="button"
              className="hero-btn hero-btn-light lc-btn-hit"
              onClick={() => navigate("/choose-role")}
            >
              Join Now
            </button>
            <button
              type="button"
              className="hero-btn hero-btn-outline lc-btn-hit"
              onClick={() => navigate("/login")}
            >
              Sign In
            </button>
            <a className="hero-btn hero-btn-ghost lc-btn-hit" href="#jobs">
              Explore Jobs
            </a>
          </div>

          <motion.div
            className="hero-stats"
            variants={LC_STAGGER_CONTAINER}
            initial="hidden"
            animate="visible"
          >
            <motion.div className="hero-stat" variants={LC_STAGGER_ITEM}>
              <h3>{heroSeekersLabel}</h3>
              <p>Job Seekers</p>
            </motion.div>
            <motion.div className="hero-stat" variants={LC_STAGGER_ITEM}>
              <h3>{heroCompaniesLabel}</h3>
              <p>Companies</p>
            </motion.div>
            <motion.div className="hero-stat" variants={LC_STAGGER_ITEM}>
              <h3>{heroJobsLabel}</h3>
              <p>Jobs Posted</p>
            </motion.div>
          </motion.div>
          <p
            className="lc-home-metrics-footnote"
          >
            {statsLoadError ? "Stats unavailable right now." : "Live counts from LebConnect."}
          </p>
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

        <motion.div
          className="features-grid"
          variants={LC_STAGGER_CONTAINER}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
        >
          {features.map((item) => (
            <motion.div className="feature-card" key={item.title} variants={LC_STAGGER_ITEM}>
              <div className={`feature-badge ${item.tint}`}>{item.icon}</div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </motion.div>
          ))}
        </motion.div>
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

          <div className="jobs-side-text">
            <p>
              Browse opportunities in tech, finance, marketing, and more — from Beirut to Tripoli.
            </p>
            {jobsLoadError ? (
              <p className="jobs-api-footnote">
                Could not load jobs right now.
              </p>
            ) : null}
          </div>
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

        {jobsLoading ? (
          <p className="lc-home-marquee-empty">Loading jobs…</p>
        ) : jobsLoadError ? (
          <div className="lc-home-empty-card">
            <div className="lc-home-empty-icon" aria-hidden>⚠</div>
            <h3>Could not load jobs right now.</h3>
            <p>Please refresh and try again.</p>
          </div>
        ) : jobsList.length === 0 ? (
          <div className="lc-home-empty-card">
            <div className="lc-home-empty-icon" aria-hidden>💼</div>
            <h3>No jobs available yet.</h3>
            <p>Check back soon for new opportunities.</p>
            <button
              type="button"
              className="lc-home-empty-btn"
              onClick={() => navigate("/choose-role")}
            >
              Join as Company to post a job
            </button>
          </div>
        ) : filteredJobsList.length === 0 ? (
          <p className="lc-home-marquee-empty">
            No jobs match your filters. Try another category or clear the search.
          </p>
        ) : (
          <div
            className="lc-home-marquee lc-home-marquee--jobs"
            aria-label="Featured jobs — horizontally scrolling"
          >
            <div className="lc-home-marquee-mask">
              <div
                className={
                  filteredJobsList.length === 1
                    ? "lc-home-marquee-track lc-home-marquee-track--single-set"
                    : "lc-home-marquee-track lc-home-marquee-track--jobs"
                }
              >
                {jobsMarqueeTrack.map((job, idx) => (
                  <div
                    className="job-card lc-home-marquee-job-card"
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
                              job.companyId && navigate(`/company-profile/${job.companyId}`)
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
                        title={
                          savedJobIds.has(job.apiJobId) ? "Remove save" : "Save job"
                        }
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

                    <div className="job-tags lc-home-marquee-job-tags">
                      <span className="tag tag-location">📍 {job.location}</span>
                      <span className="tag tag-type">{job.type}</span>
                    </div>

                    <div className="job-meta lc-home-marquee-job-meta">
                      <span>👥 {job.applicants} applicants</span>
                      <span>{job.time}</span>
                    </div>

                    <div className="lc-home-marquee-job-actions">
                      <button
                        type="button"
                        className="lc-home-marquee-btn lc-home-marquee-btn--ghost"
                        onClick={() => handleApply(job)}
                      >
                        View Job
                      </button>
                      <button
                        type="button"
                        className="lc-home-marquee-btn lc-home-marquee-btn--primary"
                        onClick={() => handleApply(job)}
                      >
                        Apply Now
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <section id="companies" className="content-section companies-section">
        <p className="section-kicker centered">TOP EMPLOYERS</p>
        <h2 className="section-title centered">
          Companies Hiring
          <br />
          <span>Right Now</span>
        </h2>
        {companiesLoadError ? (
          <p className="companies-api-footnote">
            Could not load companies right now.
          </p>
        ) : null}

        {companiesLoading ? (
          <p className="lc-home-marquee-empty">Loading companies…</p>
        ) : companiesLoadError ? (
          <div className="lc-home-empty-card">
            <div className="lc-home-empty-icon" aria-hidden>⚠</div>
            <h3>Could not load companies right now.</h3>
            <p>Please refresh and try again.</p>
          </div>
        ) : companiesList.length === 0 ? (
          <div className="lc-home-empty-card">
            <div className="lc-home-empty-icon" aria-hidden>🏢</div>
            <h3>No companies hiring right now.</h3>
            <p>Companies will appear here when they post jobs.</p>
            <button
              type="button"
              className="lc-home-empty-btn"
              onClick={() => navigate("/company-register")}
            >
              Register your company
            </button>
          </div>
        ) : (
          <div
            className="lc-home-marquee lc-home-marquee--companies"
            aria-label="Companies hiring — horizontally scrolling"
          >
            <div className="lc-home-marquee-mask">
              <div
                className={
                  companiesList.length <= 1
                    ? "lc-home-marquee-track lc-home-marquee-track--single-set lc-home-marquee-track--companies"
                    : "lc-home-marquee-track lc-home-marquee-track--companies"
                }
              >
                {companiesMarqueeTrack.map((company, idx) => (
                  <div
                    className="company-card lc-home-marquee-company-card"
                    key={`${company.id ?? company.name}-${idx}`}
                  >
                    <div className="lc-home-marquee-company-row">
                      <div className={`company-logo ${company.cls}`}>{company.logo}</div>
                      <div className="lc-home-marquee-company-main">
                        <h3>{company.name}</h3>
                        <p className="company-field">{company.field || "Industry"}</p>
                        <p className="company-city">📍 {company.city || "Lebanon"}</p>
                        <div className="lc-home-marquee-company-badges">
                          <span className="lc-home-hiring-pill">
                            Hiring now
                          </span>
                          <span className="open-roles">{company.roles}</span>
                        </div>
                        <button
                          type="button"
                          className="lc-home-marquee-btn lc-home-marquee-btn--primary lc-home-marquee-btn--stretch"
                          onClick={() => openCompanyProfile(company)}
                        >
                          View Company
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
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
          <h3>{heroSeekersLabel}</h3>
          <p>Job Seekers</p>
        </div>
        <div className="band-item">
          <div className="band-icon">🏢</div>
          <h3>{heroCompaniesLabel}</h3>
          <p>Companies</p>
        </div>
        <div className="band-item">
          <div className="band-icon">💼</div>
          <h3>{heroJobsLabel}</h3>
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
          <div className="footer-cta-glow" aria-hidden="true" />
          <div>
            <p className="footer-cta-kicker">NEXT STEP</p>
            <h2>Ready to Launch Your Career?</h2>
            <p>{footerJoinLine}</p>
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
            <div className="footer-brand-head">
              <div className="footer-lc-badge" aria-hidden="true">
                LC
              </div>
              <h3>LebConnect</h3>
            </div>
            <p>
              Lebanon&apos;s professional network for jobs, companies, and career growth.
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
        <div className="footer-legal">
          <p>© 2026 LebConnect. All rights reserved.</p>
          <p>Built for Lebanese professionals.</p>
        </div>
      </footer>
    </motion.div>
  );
}

export default Home;
