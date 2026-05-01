import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/axios";
import Modal from "../components/Modal";
import UserAvatar from "../components/UserAvatar";
import CandidateSidebar from "../components/CandidateSidebar";
import { formatRelativeTime, initialsFromName } from "../utils/format";
import { displayNameFromUser } from "../utils/avatar";
import { dashboardPath, getUser, logout } from "../utils/auth";
import { useAuthUser } from "../hooks/useAuthUser";
import "./CandidateDashboard.css";
import "./CompanyDashboardExtras.css";

const MAX_CV_FILE_BYTES = 22 * 1024 * 1024;

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === "string" ? r.result : "");
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

const FALLBACK_JOBS = [
  {
    company: "TechBeirut",
    title: "Senior React Developer",
    location: "Beirut",
    type: "Full-time",
    salary: "$2,500 – $3,500/mo",
    applicants: 14,
    time: "2 days ago",
    status: "Applied",
    logo: "TECH",
    logoClass: "logo-tech",
    apiId: null,
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
    status: "Apply",
    logo: "PM",
    logoClass: "logo-phoenix",
    apiId: null,
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
    status: "Applied",
    logo: "BANK",
    logoClass: "logo-bank",
    apiId: null,
    companyId: null,
  },
];

const FALLBACK_APPLICATIONS = [
  {
    title: "Senior React Developer",
    company: "TechBeirut · Beirut, Lebanon",
    date: "Applied on 2026-03-25",
    status: "Pending",
    color: "pending",
    apiId: null,
  },
  {
    title: "Financial Analyst",
    company: "Blom Invest Bank · Beirut, Lebanon",
    date: "Applied on 2026-03-20",
    status: "Accepted",
    color: "accepted",
    apiId: null,
  },
];

const FALLBACK_SAVED = [
  {
    title: "Senior React Developer",
    company: "TechBeirut · Beirut, Lebanon",
    type: "Full-time",
    salary: "$2,500 – $3,500/mo",
    logo: "TECH",
    logoClass: "logo-tech",
    apiId: null,
  },
];

const LOGO_ROT = ["logo-tech", "logo-phoenix", "logo-bank"];

function mapJob(j, idx, appliedIds, savedIds) {
  const comp = j.company || {};
  const name = comp.companyName || "Company";
  const jid = j.id ?? j._id;
  const applied = jid != null && appliedIds.has(Number(jid));
  const saved = jid != null && savedIds.has(Number(jid));

  return {
    company: name,
    title: j.title,
    location: j.location || "",
    type: j.type || "",
    salary: j.salary || "",
    applicants: j.applicantsCount ?? j.applicants ?? 0,
    time: formatRelativeTime(j.createdAt || j.created_at) || "Recently",
    status: applied ? "Applied" : "Apply",
    logo: initialsFromName(name).slice(0, 4),
    logoClass: LOGO_ROT[idx % LOGO_ROT.length],
    apiId: jid,
    saved,
    companyId: comp.id ?? comp._id,
  };
}

function mapApplication(a) {
  const job = a.job || {};
  const comp = a.company || {};
  const jid = job.id ?? job._id ?? a.job_id;
  const created = a.createdAt || a.created_at;
  return {
    title: job.title || "Job",
    company: `${comp.companyName || ""} · ${job.location || ""}`.trim(),
    date: created
      ? `Applied on ${new Date(created).toLocaleDateString()}`
      : "",
    status:
      a.status === "pending"
        ? "Pending"
        : a.status === "accepted"
          ? "Accepted"
          : a.status === "rejected"
            ? "Rejected"
            : a.status || "Pending",
    color:
      a.status === "accepted"
        ? "accepted"
        : a.status === "rejected"
          ? "rejected"
          : "pending",
    apiId: a.id ?? a._id,
    jobId: jid,
    coverMessage:
      typeof a.message === "string" && a.message.trim()
        ? a.message.trim()
        : "",
    cvLabel: typeof a.cvFileName === "string" && a.cvFileName.trim()
      ? a.cvFileName.trim()
      : "",
    raw: a,
  };
}

function mapSavedJob(j, idx) {
  const comp = j.company || {};
  const name = comp.companyName || "Company";
  return {
    title: j.title,
    company: `${name} · ${j.location || ""}`,
    type: j.type || "",
    salary: j.salary || "",
    logo: initialsFromName(name).slice(0, 4),
    logoClass: LOGO_ROT[idx % LOGO_ROT.length],
    apiId: j.id ?? j._id,
  };
}

function CandidateDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthUser();
  const displayName = displayNameFromUser(user);
  const specialization = user?.specialization || "";

  const [activeTab, setActiveTab] = useState("dashboard");
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [savedJobs, setSavedJobs] = useState([]);
  const [search, setSearch] = useState("");
  const [loadErr, setLoadErr] = useState(false);
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [jobModalDetail, setJobModalDetail] = useState(null);
  const [notifUnread, setNotifUnread] = useState(0);
  const [messagesUnread, setMessagesUnread] = useState(0);
  const [topSearch, setTopSearch] = useState("");
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [applyJobTarget, setApplyJobTarget] = useState(null);
  const [applyCvBase64, setApplyCvBase64] = useState("");
  const [applyCvFileName, setApplyCvFileName] = useState("");
  const [applyMessage, setApplyMessage] = useState("");
  const [applySubmitting, setApplySubmitting] = useState(false);

  const reloadAll = async () => {
    try {
      const [jr, ar, sr] = await Promise.all([
        api.get("/api/jobs"),
        api.get("/api/applications/my"),
        api.get("/api/jobs/saved/my"),
      ]);

      const appliedIds = new Set(
        (ar.data || []).map((x) => Number(x.job?.id ?? x.job?._id ?? x.job_id)).filter(Boolean)
      );

      const savedIds = new Set(
        (sr.data || []).map((x) => Number(x.id ?? x._id)).filter(Boolean)
      );

      setJobs(
        Array.isArray(jr.data) && jr.data.length
          ? jr.data.map((j, i) => mapJob(j, i, appliedIds, savedIds))
          : []
      );

      setApplications(
        Array.isArray(ar.data) && ar.data.length
          ? ar.data.map(mapApplication)
          : []
      );

      setSavedJobs(
        Array.isArray(sr.data) && sr.data.length
          ? sr.data.map((x, i) => mapSavedJob(x, i))
          : []
      );
      setLoadErr(false);
    } catch {
      setJobs(FALLBACK_JOBS);
      setApplications(FALLBACK_APPLICATIONS);
      setSavedJobs(FALLBACK_SAVED);
      setLoadErr(true);
    }
  };

  const loadUnread = async () => {
    try {
      const { data } = await api.get("/api/notifications");
      const list = Array.isArray(data) ? data : [];
      setNotifUnread(list.filter((n) => !n.isRead).length);
    } catch {
      setNotifUnread(0);
    }
  };

  useEffect(() => {
    reloadAll();
    loadUnread();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/api/messages/conversations");
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setMessagesUnread(
          list.reduce((acc, row) => acc + Number(row.unread || 0), 0)
        );
      } catch {
        if (!cancelled) setMessagesUnread(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const t = location.state?.tab;
    const qFromState = location.state?.q;
    const qFromUrl = new URLSearchParams(location.search).get("q");
    if (t === "findJobs" || t === "applications" || t === "savedJobs") {
      setActiveTab(t);
    }
    if (qFromState || qFromUrl) {
      setActiveTab("findJobs");
      setSearch(qFromState || qFromUrl || "");
    }
  }, [location.state, location.search]);

  useEffect(() => {
    const jid = location.state?.openApplyJobId;
    if (jid == null || jid === "") return;

    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/api/jobs/${jid}`);
        if (cancelled) return;
        const comp = data.company || {};
        const nm = comp.companyName || "Company";
        setApplyJobTarget({
          apiId: data.id ?? data._id ?? Number(jid),
          title: data.title || "Job",
          company: nm,
          status: "Apply",
          logo: initialsFromName(nm).slice(0, 4),
          logoClass: "logo-tech",
        });
        setApplyCvBase64("");
        setApplyCvFileName("");
        setApplyMessage("");
        setApplyModalOpen(true);
      } catch {
        if (!cancelled) alert("Could not load that job to apply.");
      }
    })();

    const rest = { ...location.state };
    delete rest.openApplyJobId;
    navigate(location.pathname + location.search, { replace: true, state: rest });
  }, [location.state?.openApplyJobId, navigate, location.pathname, location.search]);

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter(
      (j) =>
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        j.location.toLowerCase().includes(q) ||
        (j.type && j.type.toLowerCase().includes(q))
    );
  }, [jobs, search]);

  const modalJobApplied = useMemo(() => {
    if (!jobModalDetail) return false;
    const jid = Number(jobModalDetail.id ?? jobModalDetail._id);
    if (!Number.isFinite(jid)) return false;
    return applications.some((a) => Number(a.jobId) === jid);
  }, [applications, jobModalDetail]);

  const openJobModalById = async (jobId) => {
    if (!jobId) return;
    try {
      const { data } = await api.get(`/api/jobs/${jobId}`);
      setJobModalDetail(data);
      setJobModalOpen(true);
    } catch {
      setJobModalDetail(null);
      setJobModalOpen(false);
    }
  };

  const pickApplyCv = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (typeof file.size === "number" && file.size > MAX_CV_FILE_BYTES) {
      alert(
        "That file is too large to submit safely (choose one under ~22 MB, or PDF-compress before uploading)."
      );
      e.target.value = "";
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setApplyCvBase64(dataUrl);
      setApplyCvFileName(file.name || "cv-upload");
    } catch {
      alert("Could not read that file.");
    } finally {
      e.target.value = "";
    }
  };

  const openApplyModalFromJobCard = (job) => {
    if (!job?.apiId) {
      alert("Job is not linked to the server listing.");
      return;
    }
    if (job.status === "Applied") return;
    setApplyJobTarget(job);
    setApplyCvBase64("");
    setApplyCvFileName("");
    setApplyMessage("");
    setApplyModalOpen(true);
  };

  const submitApplyModal = async (e) => {
    e.preventDefault();
    if (!applyJobTarget?.apiId) return;
    const approxBytes =
      typeof applyCvBase64 === "string"
        ? Math.ceil((applyCvBase64.length * 3) / 4)
        : 0;
    if (approxBytes > MAX_CV_FILE_BYTES + 2048) {
      alert(
        "This CV attachment is too large after encoding (~25 MB max). Compress the file or use a shorter export."
      );
      return;
    }
    if (!applyCvBase64.trim()) {
      alert("CV is required — upload your résumé file.");
      return;
    }
    setApplySubmitting(true);
    try {
      await api.post("/api/applications", {
        jobId: applyJobTarget.apiId,
        cv: applyCvBase64,
        cvFileName: applyCvFileName || "cv-upload",
        message: applyMessage.trim(),
      });
      setApplyModalOpen(false);
      setApplyJobTarget(null);
      setApplyCvBase64("");
      setApplyCvFileName("");
      setApplyMessage("");
      await reloadAll();
    } catch (err) {
      const status = err.response?.status;
      const msg =
        err.response?.data?.message ||
        err.message ||
        (status === 413 ? "Payload too large — compress your CV and try again." : null) ||
        "Could not submit application.";
      if (
        typeof msg === "string" &&
        msg.toLowerCase().includes("already applied")
      ) {
        setApplyModalOpen(false);
        await reloadAll();
      }
      alert(msg);
    } finally {
      setApplySubmitting(false);
    }
  };

  const toggleSave = async (job) => {
    if (!job.apiId) return;
    try {
      if (job.saved) {
        await api.delete(`/api/jobs/${job.apiId}/save`);
      } else {
        await api.post(`/api/jobs/${job.apiId}/save`);
      }
      reloadAll();
    } catch (e) {
      alert(e.response?.data?.message || e.message || "Save failed");
    }
  };

  const signOut = () => {
    logout();
    navigate("/login");
  };

  const goRoleHome = () => {
    if (user?.role) navigate(dashboardPath(user.role));
    else navigate("/");
  };

  const handleTopSearchKeyDown = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const q = topSearch.trim();
    if (!q) {
      goRoleHome();
      return;
    }
    navigate("/candidate-dashboard", { state: { tab: "findJobs", q } });
  };

  const renderDashboardHome = () => (
    <>
      <div className="subtabs">
        <button className="subtab active">Dashboard</button>
        <button className="subtab" onClick={() => setActiveTab("findJobs")}>
          Find Jobs
        </button>
        <button
          className="subtab"
          onClick={() => setActiveTab("applications")}
        >
          My Applications
        </button>
        <button className="subtab" onClick={() => setActiveTab("savedJobs")}>
          Saved Jobs
        </button>
      </div>

      {loadErr && (
        <p style={{ opacity: 0.8, marginBottom: "0.5rem" }}>
          Showing sample data — API unavailable.
        </p>
      )}

      <div className="welcome-card">
        <div>
          <p className="welcome-small">Welcome back,</p>
          <h2>{displayName}! 👋</h2>
          <p className="welcome-text">
            You have notifications and messages on your feed.
          </p>
        </div>

        <button
          type="button"
          className="primary-btn"
          onClick={() => setActiveTab("findJobs")}
        >
          ⌕ Find Jobs
        </button>
      </div>

      <div className="stats-cards">
        <div className="mini-stat-card">
          <div className="mini-icon blue-bg">📄</div>
          <h3>{applications.length}</h3>
          <p>Applications</p>
        </div>

        <div className="mini-stat-card">
          <div className="mini-icon green-bg">🔖</div>
          <h3>{savedJobs.length}</h3>
          <p>Saved Jobs</p>
        </div>

        <div className="mini-stat-card">
          <div className="mini-icon orange-bg">✉</div>
          <h3>—</h3>
          <p>Messages</p>
        </div>

        <div className="mini-stat-card">
          <div className="mini-icon purple-bg">◉</div>
          <h3>—</h3>
          <p>Profile Views</p>
        </div>
      </div>

      <div className="panel-card">
        <div className="panel-head">
          <h3>Recent Applications</h3>
          <button
            type="button"
            className="link-like"
            style={{
              background: "none",
              border: "none",
              color: "inherit",
              cursor: "pointer",
            }}
            onClick={() => setActiveTab("applications")}
          >
            View all
          </button>
        </div>

        <div className="recent-apps">
          {applications.slice(0, 3).map((a) => (
            <div className="recent-app-item" key={a.title + a.date}>
              <div>
                <h4>{a.title}</h4>
                <p>{a.company.split("·")[0]?.trim()} · {a.date.replace("Applied on ", "")}</p>
              </div>
              <span className={`status-pill ${a.color}`}>
                ● {a.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel-card">
        <div className="panel-head">
          <h3>Recommended for You</h3>
          <button
            type="button"
            style={{
              background: "none",
              border: "none",
              color: "inherit",
              cursor: "pointer",
            }}
            onClick={() => setActiveTab("findJobs")}
          >
            See all
          </button>
        </div>

        <div className="recommended-list">
          {jobs.length === 0 ? (
            <p style={{ opacity: 0.8 }}>No job listings yet.</p>
          ) : (
            jobs.slice(0, 4).map((job) => (
              <div className="simple-job-row" key={`${job.title}-${job.apiId}`}>
                <div className="simple-job-left">
                  <div className={`job-logo ${job.logoClass}`}>{job.logo}</div>
                  <div>
                    <h4>{job.title}</h4>
                    <p>{job.company}</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="apply-small-btn"
                  onClick={() => openApplyModalFromJobCard(job)}
                  disabled={job.status === "Applied"}
                >
                  {job.status === "Applied" ? "Applied" : "Apply"}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );

  const renderFindJobs = () => (
    <>
      <div className="subtabs">
        <button className="subtab" onClick={() => setActiveTab("dashboard")}>
          Dashboard
        </button>
        <button className="subtab active">Find Jobs</button>
        <button
          className="subtab"
          onClick={() => setActiveTab("applications")}
        >
          My Applications
        </button>
        <button className="subtab" onClick={() => setActiveTab("savedJobs")}>
          Saved Jobs
        </button>
      </div>

      <div className="filters-bar">
        <div className="inner-search">
          <span>⌕</span>
          <input
            type="text"
            placeholder="Search jobs or companies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select disabled>
          <option>All</option>
        </select>

        <select disabled>
          <option>All</option>
        </select>

        <select disabled>
          <option>All</option>
        </select>
      </div>

      <p className="results-count">{filteredJobs.length} jobs found</p>

      <div className="job-list">
        {filteredJobs.map((job) => (
          <div
            className="find-job-card"
            key={`${job.title}-${job.apiId ?? job.company}`}
          >
            <div className="find-job-left">
              <div className={`job-logo ${job.logoClass}`}>{job.logo}</div>

              <div className="find-job-info">
                <h3>{job.title}</h3>
                <p
                  className="company-line lc-link"
                  role={job.companyId ? "button" : undefined}
                  tabIndex={job.companyId ? 0 : undefined}
                  onClick={() =>
                    job.companyId &&
                    navigate(`/company-profile/${job.companyId}`)
                  }
                  onKeyDown={(e) =>
                    job.companyId &&
                    e.key === "Enter" &&
                    navigate(`/company-profile/${job.companyId}`)
                  }
                >
                  {job.company}
                </p>

                <div className="job-tags">
                  <span className="tag tag-location">📍 {job.location}</span>
                  <span className="tag tag-type">{job.type}</span>
                  <span className="tag tag-salary">{job.salary}</span>
                </div>

                <p className="meta-line">
                  👥 {job.applicants} applicants · {job.time}
                </p>
              </div>
            </div>

            <div className="find-job-right">
              <button
                type="button"
                className="bookmark"
                onClick={() => toggleSave(job)}
                title={job.saved ? "Unsave" : "Save"}
              >
                {job.saved ? "🔖" : "🔖"}
              </button>
              <button
                type="button"
                className="apply-small-btn"
                style={{ marginRight: 8 }}
                onClick={() => openJobModalById(job.apiId)}
              >
                View
              </button>
              <button
                type="button"
                className={
                  job.status === "Applied" ? "applied-btn" : "apply-btn"
                }
                onClick={() =>
                  job.status === "Applied"
                    ? null
                    : openApplyModalFromJobCard(job)
                }
                disabled={job.status === "Applied"}
              >
                {job.status === "Applied" ? "✓ Applied" : "Apply"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );

  const renderApplications = () => (
    <>
      <div className="subtabs">
        <button className="subtab" onClick={() => setActiveTab("dashboard")}>
          Dashboard
        </button>
        <button className="subtab" onClick={() => setActiveTab("findJobs")}>
          Find Jobs
        </button>
        <button className="subtab active">My Applications</button>
        <button className="subtab" onClick={() => setActiveTab("savedJobs")}>
          Saved Jobs
        </button>
      </div>

      <div className="application-summary">
        <div className="summary-card">
          <div className="mini-icon yellow-bg">◔</div>
          <h3>
            {applications.filter((x) => x.status === "Pending").length}
          </h3>
          <p>In Review</p>
        </div>

        <div className="summary-card">
          <div className="mini-icon green-bg">✓</div>
          <h3>
            {applications.filter((x) => x.status === "Accepted").length}
          </h3>
          <p>Accepted</p>
        </div>

        <div className="summary-card">
          <div className="mini-icon red-bg">✕</div>
          <h3>
            {applications.filter((x) => x.status === "Rejected").length}
          </h3>
          <p>Rejected</p>
        </div>
      </div>

      <div className="application-tabs">
        <button type="button" className="app-tab active">
          All
        </button>
      </div>

      <div className="applications-list">
        {applications.map((item) => (
          <div className="application-card" key={item.apiId ?? item.title}>
            <div className="application-left">
              <div className="job-logo logo-tech">
                {initialsFromName(
                  item.company.split("·")[0]?.trim() || item.title || "Jo"
                ).slice(0, 4)}
              </div>

              <div>
                <h3>{item.title}</h3>
                <p>{item.company}</p>
                <span className="application-date">🗓 {item.date}</span>
                {item.coverMessage ? (
                  <p className="application-date" style={{ marginTop: 6 }}>
                    💬 {item.coverMessage}
                  </p>
                ) : (
                  <p className="application-date" style={{ marginTop: 6, opacity: 0.7 }}>
                    No cover message
                  </p>
                )}
                {item.cvLabel ? (
                  <p className="application-date">📎 {item.cvLabel}</p>
                ) : null}
              </div>
            </div>

            <div className="application-right">
              <span className={`status-pill ${item.color}`}>
                ● {item.status}
              </span>

              <div className="application-actions">
                {item.status === "Accepted" && (
                  <button type="button" className="message-btn">
                    ✉ Message
                  </button>
                )}
                <button
                  type="button"
                  className="view-job-btn"
                  onClick={() => openJobModalById(item.jobId)}
                >
                  View Job
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );

  const renderSavedJobs = () => (
    <>
      <div className="subtabs">
        <button className="subtab" onClick={() => setActiveTab("dashboard")}>
          Dashboard
        </button>
        <button className="subtab" onClick={() => setActiveTab("findJobs")}>
          Find Jobs
        </button>
        <button
          className="subtab"
          onClick={() => setActiveTab("applications")}
        >
          My Applications
        </button>
        <button className="subtab active">Saved Jobs</button>
      </div>

      <p className="results-count">{savedJobs.length} saved jobs</p>

      <div className="saved-list">
        {savedJobs.map((job) => (
          <div className="saved-job-card" key={job.apiId ?? job.title}>
            <div className="saved-job-left">
              <div className={`job-logo ${job.logoClass}`}>{job.logo}</div>
              <div>
                <h3>{job.title}</h3>
                <p>{job.company}</p>

                <div className="job-tags">
                  <span className="tag tag-location">{job.type}</span>
                  <span className="tag tag-salary">{job.salary}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="apply-btn"
              onClick={() =>
                openApplyModalFromJobCard({
                  apiId: job.apiId,
                  title: job.title,
                  company: job.company.split("·")[0]?.trim() || "Company",
                  logo: job.logo,
                  logoClass: job.logoClass,
                  status: "Apply",
                  location: "",
                  type: job.type,
                  salary: job.salary,
                  applicants: 0,
                  time: "",
                  saved: true,
                  companyId: null,
                })
              }
            >
              Apply
            </button>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <div className="candidate-page">
      <header className="topbar">
        <div className="topbar-left">
          <div
            className="brand-mark"
            role="button"
            tabIndex={0}
            onClick={goRoleHome}
          >
            <div className="brand-center"></div>
          </div>

          <div className="top-search">
            <span>⌕</span>
            <input
              type="text"
              placeholder="Search jobs, companies..."
              value={topSearch}
              onChange={(e) => setTopSearch(e.target.value)}
              onKeyDown={handleTopSearchKeyDown}
            />
          </div>
        </div>

        <div className="topbar-right">
          <div
            className="top-nav"
            role="button"
            tabIndex={0}
            onClick={goRoleHome}
          >
            <span>⌂</span>
            <p>Home</p>
          </div>

          <div
            className="top-nav lc-msg-nav-active"
            role="button"
            tabIndex={0}
            onClick={() => navigate("/messages")}
          >
            <span>✉</span>
            <p>Messaging</p>
            {messagesUnread > 0 ? (
              <div className="notif-badge msg-top-badge">{messagesUnread}</div>
            ) : null}
          </div>

          <div
            className="top-nav notif-nav"
            role="button"
            tabIndex={0}
            onClick={() => navigate("/notifications")}
          >
            <span>🔔</span>
            <p>Notifications</p>
            <div className="notif-badge">{notifUnread}</div>
          </div>

          <div className="top-divider"></div>

          <div className="top-user">
            <UserAvatar user={user} size={40} />
            <div>
              <h4>{displayName}</h4>
              <p>{specialization || "Candidate"}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="layout">
        <CandidateSidebar
          user={user}
          activeKey={activeTab}
          notifUnread={notifUnread}
          messagesUnread={messagesUnread}
          onDashboard={() => setActiveTab("dashboard")}
          onFeed={() => navigate("/dashboard")}
          onFindJobs={() => setActiveTab("findJobs")}
          onApplications={() => setActiveTab("applications")}
          onSavedJobs={() => setActiveTab("savedJobs")}
          onMessages={() => navigate("/messages")}
          onNotifications={() => navigate("/notifications")}
          onMyProfile={() => {
            const uid = user?.id ?? user?._id;
            if (uid) navigate(`/candidate-profile/${uid}`);
          }}
          onSignOut={signOut}
        />

        <main className="main-content">
          {activeTab === "dashboard" && renderDashboardHome()}
          {activeTab === "findJobs" && renderFindJobs()}
          {activeTab === "applications" && renderApplications()}
          {activeTab === "savedJobs" && renderSavedJobs()}
        </main>

      </div>

      <Modal
        open={jobModalOpen}
        title={jobModalDetail?.title || "Job details"}
        onClose={() => {
          setJobModalOpen(false);
          setJobModalDetail(null);
        }}
      >
        {jobModalDetail ? (
          <div className="lc-job-modal">
            <p style={{ fontWeight: 600, marginBottom: 8 }}>
              {jobModalDetail.company?.companyName || "Company"} ·{" "}
              {jobModalDetail.location}
            </p>
            <p style={{ marginBottom: 8 }}>
              <span style={{ marginRight: 12 }}>{jobModalDetail.type}</span>
              <span>{jobModalDetail.salary}</span>
            </p>
            <p style={{ whiteSpace: "pre-wrap", color: "#374151" }}>
              {jobModalDetail.description || "No description."}
            </p>
            {(() => {
              let req = jobModalDetail.requirements;
              if (typeof req === "string") {
                try {
                  req = JSON.parse(req);
                } catch {
                  req = [];
                }
              }
              const list = Array.isArray(req) ? req : [];
              if (!list.length) return null;
              return (
                <div style={{ marginTop: 12 }}>
                  <strong>Requirements</strong>
                  <ul style={{ marginTop: 8 }}>
                    {list.map((r) => (
                      <li key={String(r)}>{String(r)}</li>
                    ))}
                  </ul>
                </div>
              );
            })()}
            <div
              style={{
                marginTop: 16,
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              {loadErr || modalJobApplied ? null : (
                <button
                  type="button"
                  className="apply-btn"
                  onClick={() => {
                    const comp = jobModalDetail.company?.companyName || "";
                    const jid =
                      jobModalDetail.id ??
                      jobModalDetail._id;
                    setJobModalOpen(false);
                    openApplyModalFromJobCard({
                      apiId: jid,
                      title: jobModalDetail.title,
                      company: comp || "Company",
                      logo: initialsFromName(comp || jobModalDetail.title).slice(
                        0,
                        4
                      ),
                      logoClass: "logo-tech",
                      location: jobModalDetail.location || "",
                      type: jobModalDetail.type || "",
                      salary: jobModalDetail.salary || "",
                      applicants: 0,
                      time: "",
                      status: "Apply",
                      saved: false,
                      companyId:
                        jobModalDetail.company?.id ??
                        jobModalDetail.company?._id ??
                        null,
                    });
                  }}
                >
                  Apply
                </button>
              )}
              {modalJobApplied ? (
                <span style={{ alignSelf: "center", fontWeight: 600, color: "#0b73db" }}>
                  ✓ Applied
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        wide
        open={applyModalOpen}
        title={applyJobTarget?.title ? `Apply · ${applyJobTarget.title}` : "Apply"}
        onClose={() => {
          if (applySubmitting) return;
          setApplyModalOpen(false);
          setApplyJobTarget(null);
          setApplyCvBase64("");
          setApplyCvFileName("");
          setApplyMessage("");
        }}
      >
        <form className="co-job-modal-form" onSubmit={submitApplyModal}>
          {applyJobTarget?.company ? (
            <p style={{ marginTop: 0, color: "#475569", fontSize: 14 }}>
              {applyJobTarget.company}
              {applyJobTarget.location ? ` · ${applyJobTarget.location}` : ""}
            </p>
          ) : null}
          <p style={{ marginTop: 0, fontWeight: 600 }}>
            Résumé / CV upload is required. Optional message to employer.
          </p>
          <label className="co-modal-label">
            CV upload
            <input
              type="file"
              accept=".pdf,.doc,.docx,image/*"
              onChange={pickApplyCv}
            />
            <span style={{ fontSize: 13, fontWeight: 500 }}>
              {applyCvFileName || "No file chosen"}
            </span>
          </label>
          <label className="co-modal-label">
            Cover message
            <textarea
              className="co-modal-input co-modal-textarea"
              placeholder="Briefly explain why you're a fit…"
              value={applyMessage}
              onChange={(e) => setApplyMessage(e.target.value)}
              rows={4}
            />
          </label>
          <div className="co-modal-actions">
            <button
              type="button"
              className="apply-btn ghost"
              disabled={applySubmitting}
              onClick={() => {
                if (applySubmitting) return;
                setApplyModalOpen(false);
                setApplyJobTarget(null);
                setApplyCvBase64("");
                setApplyCvFileName("");
                setApplyMessage("");
              }}
            >
              Cancel
            </button>
            <button type="submit" className="apply-btn" disabled={applySubmitting}>
              {applySubmitting ? "Sending…" : "Submit application"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default CandidateDashboard;
