import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/axios";
import CandidateSidebar from "../components/CandidateSidebar";
import Modal from "../components/Modal";
import UserAvatar from "../components/UserAvatar";
import { formatRelativeTime, initialsFromName } from "../utils/format";
import { displayNameFromUser } from "../utils/avatar";
import { dashboardPath, getUser, logout } from "../utils/auth";
import { useAuthUser } from "../hooks/useAuthUser";
import { hasCvAttachment, openCv } from "../utils/openCv";
import "./CandidateDashboard.css";
import "./CompanyDashboardExtras.css";

function formatApplicantStatus(s) {
  const x = String(s || "pending").toLowerCase();
  if (x === "accepted") return "accepted";
  if (x === "rejected") return "rejected";
  return "pending";
}

function statusLabelPretty(s) {
  const x = formatApplicantStatus(s);
  return x.charAt(0).toUpperCase() + x.slice(1);
}

function CompanyDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthUser();
  const uid = user?.id ?? user?._id;
  const companyName = user?.companyName || user?.email || "Company";
  const headerName = displayNameFromUser(user) || companyName;

  const [activeTab, setActiveTab] = useState("dashboard");
  const [myJobs, setMyJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [applicants, setApplicants] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [previewApps, setPreviewApps] = useState([]);
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [jobForm, setJobForm] = useState({
    title: "",
    description: "",
    location: "",
    type: "",
    salary: "",
    requirements: "",
  });
  const [notifUnread, setNotifUnread] = useState(0);
  const [messagesUnread, setMessagesUnread] = useState(0);
  const [topSearch, setTopSearch] = useState("");
  const [applicantStatusTab, setApplicantStatusTab] = useState("pending");
  const [cvImagePreviewSrc, setCvImagePreviewSrc] = useState(null);

  const closeCvPreview = () => {
    if (cvImagePreviewSrc?.startsWith("blob:")) {
      URL.revokeObjectURL(cvImagePreviewSrc);
    }
    setCvImagePreviewSrc(null);
  };

  const cvOpenOptions = {
    showImagePreview: (src) => {
      closeCvPreview();
      setCvImagePreviewSrc(src);
    },
    onMissing: () => typeof window !== "undefined" && window.alert?.("No CV uploaded"),
  };

  const sidebarActive =
    activeTab === "dashboard"
      ? "dashboard"
      : activeTab === "jobs"
        ? "jobs"
        : activeTab === "applicants"
          ? "applicants"
          : "dashboard";

  const loadUnread = async () => {
    try {
      const { data } = await api.get("/api/notifications");
      const list = Array.isArray(data) ? data : [];
      setNotifUnread(list.filter((n) => !n.isRead).length);
    } catch {
      setNotifUnread(0);
    }
  };

  const loadJobs = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/jobs");
      const mine = (data || []).filter(
        (j) =>
          Number(j.company?.id ?? j.company?._id ?? j.company_id) ===
          Number(uid)
      );
      setMyJobs(mine);
      setSelectedJobId((prev) => {
        if (prev != null && mine.some((x) => Number(x.id ?? x._id) === Number(prev)))
          return prev;
        return mine.length ? mine[0].id ?? mine[0]._id : null;
      });
    } catch {
      setMyJobs([]);
      setSelectedJobId(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
    loadUnread();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  useEffect(() => {
    const t = location.state?.tab;
    if (t === "jobs" || t === "applicants" || t === "dashboard") {
      setActiveTab(t);
    }
  }, [location.state]);

  useEffect(() => {
    const jid = location.state?.jobId;
    if (jid == null || jid === "") return;
    const n = Number(jid);
    if (!Number.isFinite(n)) return;
    setActiveTab("applicants");
    setSelectedJobId(n);
  }, [location.state?.jobId]);

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
    async function preview() {
      if (!myJobs.length) {
        setPreviewApps([]);
        return;
      }
      const jid = myJobs[0].id ?? myJobs[0]._id;
      try {
        const { data } = await api.get(`/api/applications/job/${jid}`);
        setPreviewApps(Array.isArray(data) ? data : []);
      } catch {
        setPreviewApps([]);
      }
    }
    preview();
  }, [myJobs]);

  useEffect(() => {
    setApplicantStatusTab("pending");
  }, [selectedJobId]);

  useEffect(() => {
    async function loadApplicants() {
      if (!selectedJobId || activeTab !== "applicants") return;
      try {
        const { data } = await api.get(`/api/applications/job/${selectedJobId}`);
        setApplicants(Array.isArray(data) ? data : []);
      } catch {
        setApplicants([]);
      }
    }
    loadApplicants();
  }, [selectedJobId, activeTab]);

  const openCreateModal = () => {
    setEditingJob(null);
    setJobForm({
      title: "",
      description: "",
      location: "",
      type: "",
      salary: "",
      requirements: "",
    });
    setJobModalOpen(true);
  };

  const openEditModal = (job) => {
    setEditingJob(job);
    let reqs = "";
    if (Array.isArray(job.requirements)) {
      reqs = job.requirements.map((x) => String(x).trim()).filter(Boolean).join("\n");
    } else if (typeof job.requirements === "string") {
      try {
        const parsed = JSON.parse(job.requirements);
        reqs = Array.isArray(parsed)
          ? parsed.map((x) => String(x).trim()).filter(Boolean).join("\n")
          : job.requirements;
      } catch {
        reqs = job.requirements;
      }
    }
    setJobForm({
      title: job.title || "",
      description: job.description || "",
      location: job.location || "",
      type: job.type || "",
      salary: job.salary || "",
      requirements: reqs,
    });
    setJobModalOpen(true);
  };

  const submitJobModal = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        title: jobForm.title.trim(),
        description: jobForm.description.trim(),
        location: jobForm.location.trim(),
        type: jobForm.type.trim(),
        salary: jobForm.salary.trim(),
        requirements: jobForm.requirements
          .split(/[\n,]+/)
          .map((s) => s.trim())
          .filter(Boolean),
      };
      if (editingJob) {
        const jid = editingJob.id ?? editingJob._id;
        await api.put(`/api/jobs/${jid}`, payload);
      } else {
        await api.post("/api/jobs", payload);
      }
      setJobModalOpen(false);
      await loadJobs();
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Save failed");
    }
  };

  const closeJob = async (job) => {
    const jid = job.id ?? job._id;
    if (!jid) return;
    try {
      await api.put(`/api/jobs/${jid}/close`);
      await loadJobs();
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Could not close");
    }
  };

  const deleteJob = async (job) => {
    const jid = job.id ?? job._id;
    if (!jid || !window.confirm("Delete this job?")) return;
    try {
      await api.delete(`/api/jobs/${jid}`);
      await loadJobs();
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Could not delete");
    }
  };

  const updateApplication = async (appId, status) => {
    const sid = Number(selectedJobId);
    if (!Number.isFinite(sid)) return;
    try {
      await api.put(`/api/applications/${Number(appId)}/status`, { status });
      const { data } = await api.get(`/api/applications/job/${sid}`);
      setApplicants(Array.isArray(data) ? data : []);
      await loadJobs();
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Update failed");
    }
  };

  const activeCount = myJobs.filter((j) => j.status === "active").length;
  const totalApplicants = myJobs.reduce(
    (s, j) => s + (j.applicantsCount ?? j.applicants_count ?? 0),
    0
  );

  const jobListings = myJobs.map((job) => ({
    title: job.title,
    meta: `${job.location || ""} · ${job.type || ""} · ${job.salary || ""}`,
    extra: `${job.applicantsCount ?? job.applicants_count ?? 0} applicants · Posted ${formatRelativeTime(job.createdAt || job.created_at) || "recently"}`,
    status: job.status === "closed" ? "Closed" : "Active",
    raw: job,
  }));

  const mapApplicantRows = (list) =>
    list.map((a) => {
      const cand = a.candidate || {};
      let skills = [];
      if (Array.isArray(cand.skills)) skills = cand.skills;
      else if (typeof cand.skills === "string") {
        try {
          skills = JSON.parse(cand.skills);
        } catch {
          skills = [];
        }
      }
      const imgRaw = cand.profileImage;
      const avatarOk =
        typeof imgRaw === "string" &&
        imgRaw.trim() !== "" &&
        (imgRaw.startsWith("http") || imgRaw.startsWith("data:"));
      const st = formatApplicantStatus(a.status);
      return {
        name: cand.fullName || cand.email || "Candidate",
        candidateUserId: cand.id ?? cand._id,
        jobTitle: a.job?.title || "Job",
        appliedFor: `Applied for: ${a.job?.title || "Job"} · ${formatRelativeTime(a.createdAt)}`,
        applicantMessage: typeof a.message === "string" ? a.message.trim() : "",
        skills: skills.length ? skills.slice(0, 4) : [],
        statusRaw: st,
        statusLabel: statusLabelPretty(a.status),
        avatarUrl: avatarOk ? imgRaw.trim() : null,
        apiId: a.id ?? a._id,
        cv: a.cv || null,
        cvFileName: a.cvFileName || null,
        application: a,
      };
    });

  const applicantsMapped = mapApplicantRows(applicants);
  const applicantsFiltered = useMemo(() => {
    return applicantsMapped.filter((p) => {
      if (applicantStatusTab === "all") return true;
      return p.statusRaw === applicantStatusTab;
    });
  }, [applicantsMapped, applicantStatusTab]);
  const previewMapped = mapApplicantRows(previewApps);

  const subtabsJobs = (
    <>
      <button type="button" className="subtab" onClick={() => setActiveTab("dashboard")}>
        Dashboard
      </button>
      <button type="button" className="subtab active">
        My Jobs
      </button>
      <button type="button" className="subtab" onClick={() => setActiveTab("applicants")}>
        Applicants
      </button>
    </>
  );

  const subtabsApplicants = (
    <>
      <button type="button" className="subtab" onClick={() => setActiveTab("dashboard")}>
        Dashboard
      </button>
      <button type="button" className="subtab" onClick={() => setActiveTab("jobs")}>
        My Jobs
      </button>
      <button type="button" className="subtab active">
        Applicants
      </button>
    </>
  );

  const subtabsDashboard = (
    <>
      <button type="button" className="subtab active">
        Dashboard
      </button>
      <button type="button" className="subtab" onClick={() => setActiveTab("jobs")}>
        My Jobs
      </button>
      <button type="button" className="subtab" onClick={() => setActiveTab("applicants")}>
        Applicants
      </button>
    </>
  );

  const postJobToolbar = (
    <button type="button" className="primary-btn co-post-job-head" onClick={openCreateModal}>
      ＋ Post Job
    </button>
  );

  const renderDashboard = () => (
    <>
      <div className="co-subtabs-row">
        <div className="subtabs">{subtabsDashboard}</div>
        {postJobToolbar}
      </div>

      <div className="welcome-card">
        <div>
          <p className="welcome-small">Welcome back,</p>
          <h2>{companyName}! 🏢</h2>
          <p className="welcome-text">Manage listings and applicants from one place.</p>
        </div>
        <button type="button" className="primary-btn" onClick={() => setActiveTab("jobs")}>
          💼 My Jobs
        </button>
      </div>

      <div className="stats-cards">
        <div className="mini-stat-card">
          <div className="mini-icon blue-bg">💼</div>
          <h3>{activeCount}</h3>
          <p>Active Jobs</p>
        </div>
        <div className="mini-stat-card">
          <div className="mini-icon green-bg">👥</div>
          <h3>{totalApplicants}</h3>
          <p>Applicants</p>
        </div>
        <div className="mini-stat-card">
          <div className="mini-icon orange-bg">✉</div>
          <h3>{messagesUnread || "—"}</h3>
          <p>Messages</p>
        </div>
        <div className="mini-stat-card">
          <div className="mini-icon purple-bg">🔔</div>
          <h3>{notifUnread}</h3>
          <p>Notifications</p>
        </div>
      </div>

      <div className="panel-card">
        <div className="panel-head">
          <h3>Active Job Listings</h3>
          <button type="button" className="link-like" onClick={() => setActiveTab("jobs")}>
            Manage all
          </button>
        </div>
        <div className="recent-apps">
          {myJobs.filter((j) => j.status === "active").slice(0, 4).map((job) => (
            <div className="recent-app-item" key={job.id ?? job._id}>
              <div>
                <h4>{job.title}</h4>
                <p>
                  {job.applicantsCount ?? job.applicants_count ?? 0} applicants ·{" "}
                  {formatRelativeTime(job.createdAt || job.created_at)}
                </p>
              </div>
              <span className="status-pill accepted">● Active</span>
            </div>
          ))}
          {!myJobs.length && !loading ? (
            <p style={{ opacity: 0.85 }}>No jobs yet — post your first role.</p>
          ) : null}
        </div>
      </div>

      <div className="panel-card">
        <div className="panel-head">
          <h3>Recent Applicants</h3>
          <button type="button" className="link-like" onClick={() => setActiveTab("applicants")}>
            View all
          </button>
        </div>
        <div className="recent-apps">
          {previewMapped.slice(0, 3).map((person) => (
            <div className="recent-app-item co-applicant-snippet" key={person.apiId}>
              <div className="co-applicant-snippet-main">
                <UserAvatar name={person.name} src={person.avatarUrl} size={40} />
                <div>
                  <button
                    type="button"
                    className="co-inline-name"
                    onClick={() =>
                      person.candidateUserId &&
                      navigate(`/candidate-profile/${person.candidateUserId}`)
                    }
                  >
                    {person.name}
                  </button>
                  <p>{person.appliedFor}</p>
                </div>
              </div>
              <span className={`status-pill ${person.statusRaw}`}>
                ● {person.statusLabel}
              </span>
            </div>
          ))}
          {!previewMapped.length ? (
            <p style={{ opacity: 0.85 }}>Applicants will appear here.</p>
          ) : null}
        </div>
      </div>
    </>
  );

  const renderMyJobs = () => (
    <>
      <div className="co-subtabs-row">
        <div className="subtabs">{subtabsJobs}</div>
        {postJobToolbar}
      </div>

      <div className="filters-bar co-jobs-meta">
        <p className="results-count" style={{ margin: 0 }}>
          {myJobs.length} job listing{myJobs.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="co-jobs-stack">
        {jobListings.map((job) => (
          <div className="find-job-card co-job-admin-card" key={job.raw.id ?? job.title}>
            <div className="find-job-left">
              <div className="job-logo logo-tech">{initialsFromName(companyName).slice(0, 2)}</div>
              <div className="find-job-info">
                <div className="title-line">
                  <h3>{job.title}</h3>
                  <span
                    className={
                      job.status === "Active"
                        ? "company-tag company-tag-live"
                        : "company-tag"
                    }
                  >
                    {job.status}
                  </span>
                </div>
                <p className="company-line">{job.meta}</p>
                <p style={{ opacity: 0.8, fontSize: 13 }}>👥 {job.extra}</p>
              </div>
            </div>
            <div className="co-job-actions">
              <button type="button" className="apply-btn" onClick={() => openEditModal(job.raw)}>
                ✎ Edit
              </button>
              <button type="button" className="apply-btn ghost" onClick={() => closeJob(job.raw)}>
                Close
              </button>
              <button type="button" className="apply-btn danger" onClick={() => deleteJob(job.raw)}>
                Delete
              </button>
            </div>
          </div>
        ))}
        {!myJobs.length && !loading ? (
          <p className="results-count">No jobs posted yet.</p>
        ) : null}
      </div>
    </>
  );

  const renderApplicants = () => (
    <>
      <div className="co-subtabs-row">
        <div className="subtabs">{subtabsApplicants}</div>
        {postJobToolbar}
      </div>

      <div className="filters-bar co-applicant-toolbar">
        <p className="results-count" style={{ margin: 0 }}>
          {applicantStatusTab !== "all" ? (
            <>
              Showing {applicantsFiltered.length} ({applicantStatusTab}) ·{" "}
              {applicantsMapped.length} total for this job
            </>
          ) : (
            <>
              {applicantsFiltered.length} applicant
              {applicantsFiltered.length === 1 ? "" : "s"}
            </>
          )}
        </p>
        <select
          className="co-job-select"
          value={selectedJobId ?? ""}
          onChange={(e) => setSelectedJobId(Number(e.target.value))}
        >
          {myJobs.map((j) => (
            <option key={j.id ?? j._id} value={j.id ?? j._id}>
              {j.title}
            </option>
          ))}
        </select>
      </div>

      <div className="co-applicant-tabs">
        {[
          { id: "pending", label: "Pending" },
          { id: "accepted", label: "Accepted" },
          { id: "rejected", label: "Rejected" },
          { id: "all", label: "All" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            className={`co-applicant-tab ${applicantStatusTab === t.id ? "active" : ""}`}
            onClick={() => setApplicantStatusTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="co-applicants-stack">
        {applicantsFiltered.map((person) => (
          <div className="find-job-card co-applicant-full" key={person.apiId}>
            <div className="find-job-left co-applicant-top">
              <button
                type="button"
                className="co-applicant-avatar-hit"
                onClick={() =>
                  person.candidateUserId &&
                  navigate(`/candidate-profile/${person.candidateUserId}`)
                }
              >
                <UserAvatar name={person.name} src={person.avatarUrl} size={56} />
              </button>
              <div className="find-job-info">
                <button
                  type="button"
                  className="co-inline-name title-line"
                  onClick={() =>
                    person.candidateUserId &&
                    navigate(`/candidate-profile/${person.candidateUserId}`)
                  }
                >
                  <h3 style={{ margin: 0 }}>{person.name}</h3>
                </button>
                <p className="co-applicant-job-line">{person.jobTitle}</p>
                <p style={{ opacity: 0.85, fontSize: 13 }}>{person.appliedFor}</p>
                <div>
                  <strong style={{ fontSize: 13 }}>Message</strong>
                  {person.applicantMessage ? (
                    <div className="co-applicant-message">{person.applicantMessage}</div>
                  ) : (
                    <p className="about-text" style={{ marginTop: 6 }}>
                      No cover message provided.
                    </p>
                  )}
                </div>
                {person.skills.length ? (
                  <div className="job-tags" style={{ marginTop: 8 }}>
                    {person.skills.map((skill) => (
                      <span key={skill} className="tag tag-location">
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="co-applicant-buttons" style={{ marginTop: 10 }}>
                  {hasCvAttachment(person.application) ? (
                    <button
                      type="button"
                      className="co-cv-view-btn"
                      onClick={() =>
                        openCv(person.application ?? {}, cvOpenOptions)
                      }
                    >
                      View CV
                    </button>
                  ) : (
                    <span className="co-no-cv-uploaded">No CV uploaded</span>
                  )}
                  {person.statusRaw === "pending" ? (
                    <>
                      <button
                        type="button"
                        className="apply-btn"
                        onClick={() => updateApplication(person.apiId, "accepted")}
                      >
                        ✓ Accept
                      </button>
                      <button
                        type="button"
                        className="apply-btn ghost"
                        onClick={() => updateApplication(person.apiId, "rejected")}
                      >
                        ✕ Reject
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    className="apply-btn"
                    disabled={!person.candidateUserId}
                    onClick={() =>
                      navigate(`/messages?userId=${person.candidateUserId}`)
                    }
                  >
                    ◫ Message
                  </button>
                </div>
              </div>
            </div>
            <span className={`status-pill ${person.statusRaw}`}>
              ● {person.statusLabel}
            </span>
          </div>
        ))}
        {!applicantsFiltered.length ? (
          <p className="results-count">
            No applications in this view for the selected job.
          </p>
        ) : null}
      </div>
    </>
  );

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
    navigate(`${dashboardPath(user?.role)}?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="candidate-page">
      <header className="topbar">
        <div className="topbar-left">
          <div
            className="brand-mark"
            role="button"
            tabIndex={0}
            onClick={goRoleHome}
            onKeyDown={(ev) => ev.key === "Enter" && goRoleHome()}
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
            onKeyDown={(ev) => ev.key === "Enter" && goRoleHome()}
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
            <UserAvatar user={user} name={companyName} size={40} />
            <div>
              <h4>{headerName}</h4>
              <p>Company</p>
            </div>
          </div>
        </div>
      </header>

      <div className="layout">
        <CandidateSidebar
          variant="company"
          user={user}
          activeKey={sidebarActive}
          notifUnread={notifUnread}
          messagesUnread={messagesUnread}
          onDashboard={() =>
            navigate("/company-dashboard", { state: { tab: "dashboard" } })
          }
          onFeed={() => navigate("/dashboard")}
          onMyJobs={() =>
            navigate("/company-dashboard", { state: { tab: "jobs" } })
          }
          onApplicants={() =>
            navigate("/company-dashboard", { state: { tab: "applicants" } })
          }
          onMessages={() => navigate("/messages")}
          onNotifications={() => navigate("/notifications")}
          onMyProfile={() => uid && navigate(`/company-profile/${uid}`)}
          onSignOut={signOut}
          onFindJobs={() => {}}
          onApplications={() => {}}
          onSavedJobs={() => {}}
        />

        <main className="main-content">
          {activeTab === "dashboard" && renderDashboard()}
          {activeTab === "jobs" && renderMyJobs()}
          {activeTab === "applicants" && renderApplicants()}
        </main>
      </div>

      <Modal
        open={jobModalOpen}
        wide
        title={editingJob ? "Edit job" : "Post a job"}
        onClose={() => setJobModalOpen(false)}
      >
        <form className="co-job-modal-form lc-co-post-job-modal" onSubmit={submitJobModal}>
          <label className="co-modal-label">
            Title
            <input
              className="co-modal-input"
              value={jobForm.title}
              onChange={(e) => setJobForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
          </label>
          <label className="co-modal-label">
            Description
            <textarea
              className="co-modal-input co-modal-textarea"
              value={jobForm.description}
              onChange={(e) =>
                setJobForm((f) => ({ ...f, description: e.target.value }))
              }
              required
            />
          </label>
          <label className="co-modal-label">
            Location
            <input
              className="co-modal-input"
              value={jobForm.location}
              onChange={(e) =>
                setJobForm((f) => ({ ...f, location: e.target.value }))
              }
            />
          </label>
          <label className="co-modal-label">
            Type
            <input
              className="co-modal-input"
              value={jobForm.type}
              onChange={(e) => setJobForm((f) => ({ ...f, type: e.target.value }))}
            />
          </label>
          <label className="co-modal-label">
            Salary
            <input
              className="co-modal-input"
              value={jobForm.salary}
              onChange={(e) =>
                setJobForm((f) => ({ ...f, salary: e.target.value }))
              }
            />
          </label>
          <label className="co-modal-label">
            Requirements (one per line or comma-separated)
            <textarea
              className="co-modal-input co-modal-textarea co-modal-textarea--reqs"
              rows={5}
              value={jobForm.requirements}
              onChange={(e) =>
                setJobForm((f) => ({ ...f, requirements: e.target.value }))
              }
              placeholder={"e.g. 3+ years React\nStrong English"}
            />
          </label>
          <div className="co-modal-actions">
            <button type="button" className="apply-btn ghost" onClick={() => setJobModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="apply-btn">
              {editingJob ? "Save changes" : "Post Job"}
            </button>
          </div>
        </form>
      </Modal>

      {cvImagePreviewSrc ? (
        <div
          className="cv-image-lightbox-backdrop"
          role="presentation"
          onClick={closeCvPreview}
        >
          <button
            type="button"
            className="cv-image-lightbox-close"
            aria-label="Close"
            onClick={closeCvPreview}
          >
            ×
          </button>
          <img
            className="cv-image-lightbox-img"
            src={cvImagePreviewSrc}
            alt="CV attachment"
            onClick={(ev) => ev.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}

export default CompanyDashboard;
