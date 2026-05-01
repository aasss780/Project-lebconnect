import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import AppTopbar from "../components/AppTopbar";
import AppSidebar from "../components/AppSidebar";
import UserAvatar from "../components/UserAvatar";
import { formatRelativeTime, initialsFromName } from "../utils/format";
import { getUser } from "../utils/auth";
import "./CandidateDashboard.css";
import "./AdminDashboard.css";

function displayUserName(u) {
  if (!u) return "";
  return u.fullName || u.companyName || u.email || "User";
}

function roleLabel(role) {
  const r = String(role || "candidate").toLowerCase();
  return r.charAt(0).toUpperCase() + r.slice(1);
}

function complaintStatusClass(status) {
  const s = String(status || "").toLowerCase();
  if (s === "resolved") return "adm-chip adm-chip--resolved";
  if (s === "reviewing") return "adm-chip adm-chip--reviewing";
  return "adm-chip adm-chip--open";
}

const ADMIN_TABS = new Set(["dashboard", "users", "jobs", "complaints"]);

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const me = getUser();

  const activeTab = useMemo(() => {
    const raw = searchParams.get("tab");
    if (!raw) return "dashboard";
    return ADMIN_TABS.has(raw) ? raw : "dashboard";
  }, [searchParams]);

  const setActiveTab = useCallback(
    (t) => {
      const tab = ADMIN_TABS.has(t) ? t : "dashboard";
      if (tab === "dashboard") {
        setSearchParams({}, { replace: true });
      } else {
        setSearchParams({ tab }, { replace: true });
      }
    },
    [setSearchParams]
  );
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState(false);
  const [users, setUsers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [usersLoadError, setUsersLoadError] = useState(false);
  const [jobsLoadError, setJobsLoadError] = useState(false);
  const [complaintsLoadError, setComplaintsLoadError] = useState(false);
  const [notifUnread, setNotifUnread] = useState(0);
  const [topSearch, setTopSearch] = useState("");
  const [messagesUnread, setMessagesUnread] = useState(0);

  const loadUnread = useCallback(async () => {
    try {
      const { data } = await api.get("/api/notifications");
      const list = Array.isArray(data) ? data : [];
      setNotifUnread(list.filter((n) => !n.isRead).length);
    } catch {
      setNotifUnread(0);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const { data } = await api.get("/api/admin/stats");
      setStats(data);
      setStatsError(false);
    } catch {
      setStats(null);
      setStatsError(true);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const { data } = await api.get("/api/admin/users");
      setUsers(Array.isArray(data) ? data : []);
      setUsersLoadError(false);
    } catch {
      setUsers([]);
      setUsersLoadError(true);
    }
  }, []);

  const loadJobs = useCallback(async () => {
    try {
      const { data } = await api.get("/api/admin/jobs");
      setJobs(Array.isArray(data) ? data : []);
      setJobsLoadError(false);
    } catch {
      setJobs([]);
      setJobsLoadError(true);
    }
  }, []);

  const loadComplaints = useCallback(async () => {
    try {
      const { data } = await api.get("/api/admin/complaints");
      setComplaints(Array.isArray(data) ? data : []);
      setComplaintsLoadError(false);
    } catch {
      setComplaints([]);
      setComplaintsLoadError(true);
    }
  }, []);

  useEffect(() => {
    loadUnread();
    loadStats();
  }, [loadUnread, loadStats]);

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
    void (async () => {
      switch (activeTab) {
        case "dashboard":
          await Promise.all([loadStats(), loadUsers()]);
          break;
        case "users":
          await loadUsers();
          break;
        case "jobs":
          await loadJobs();
          break;
        case "complaints":
          await loadComplaints();
          break;
        default:
          break;
      }
    })();
  }, [activeTab, loadStats, loadUsers, loadJobs, loadComplaints]);

  const handleDeleteUser = async (uid) => {
    if (uid == null) return;
    if (!window.confirm("Delete this user? This cannot be undone.")) return;
    try {
      await api.delete(`/api/admin/users/${uid}`);
      await loadUsers();
      await loadStats();
    } catch (e) {
      alert(e.response?.data?.message || "Could not delete user");
    }
  };

  const handleDeleteJob = async (jid) => {
    if (jid == null) return;
    if (!window.confirm("Delete this job listing?")) return;
    try {
      await api.delete(`/api/admin/jobs/${jid}`);
      await loadJobs();
      await loadStats();
    } catch (e) {
      alert(e.response?.data?.message || "Could not delete job");
    }
  };

  const handleCloseJob = async (jid) => {
    if (jid == null) return;
    if (!window.confirm("Close this job? It will stop accepting new applicants.")) return;
    try {
      await api.put(`/api/admin/jobs/${jid}/close`);
      await loadJobs();
      await loadStats();
    } catch (e) {
      alert(e.response?.data?.message || "Could not close job");
    }
  };

  const handleComplaintStatus = async (cid, status) => {
    if (cid == null) return;
    try {
      await api.put(`/api/admin/complaints/${cid}/status`, { status });
      await loadComplaints();
    } catch (e) {
      alert(e.response?.data?.message || "Could not update complaint");
    }
  };

  const signOut = () => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
    navigate("/login", { replace: true });
  };

  const goAdminHome = () => navigate("/admin-dashboard");

  const searchPlaceholder = useMemo(() => {
    switch (activeTab) {
      case "users":
        return "Search users by name or email…";
      case "jobs":
        return "Search jobs, company, location…";
      case "complaints":
        return "Search complaints…";
      default:
        return "Filter recent registrations…";
    }
  }, [activeTab]);

  const q = topSearch.trim().toLowerCase();

  const filteredUsers = useMemo(() => {
    if (!q || activeTab !== "users") return users;
    return users.filter((u) => {
      const name = displayUserName(u).toLowerCase();
      const email = String(u.email || "").toLowerCase();
      const role = String(u.role || "").toLowerCase();
      return name.includes(q) || email.includes(q) || role.includes(q);
    });
  }, [users, q, activeTab]);

  const filteredJobs = useMemo(() => {
    if (!q || activeTab !== "jobs") return jobs;
    return jobs.filter((j) => {
      const title = String(j.title || "").toLowerCase();
      const loc = String(j.location || "").toLowerCase();
      const comp = String(j.company?.companyName || j.companyName || "").toLowerCase();
      const st = String(j.status || "").toLowerCase();
      return (
        title.includes(q) || loc.includes(q) || comp.includes(q) || st.includes(q)
      );
    });
  }, [jobs, q, activeTab]);

  const filteredComplaints = useMemo(() => {
    if (!q || activeTab !== "complaints") return complaints;
    return complaints.filter((c) => {
      const title = String(c.title || "").toLowerCase();
      const body = String(c.description || "").toLowerCase();
      const fromN = displayUserName(c.user).toLowerCase();
      const agN = c.against ? displayUserName(c.against).toLowerCase() : "";
      const st = String(c.status || "").toLowerCase();
      return (
        title.includes(q) ||
        body.includes(q) ||
        fromN.includes(q) ||
        agN.includes(q) ||
        st.includes(q)
      );
    });
  }, [complaints, q, activeTab]);

  const recentRegs = useMemo(() => {
    const slice = users.slice(0, 8);
    if (!q || activeTab !== "dashboard") return slice;
    return slice.filter((u) => {
      const name = displayUserName(u).toLowerCase();
      const email = String(u.email || "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [users, q, activeTab]);

  const totalUsersLabel =
    stats && !statsError ? stats.candidates + stats.companies : "—";
  const activeJobsLabel = stats && !statsError ? stats.activeJobs : "—";
  const companiesLabel = stats && !statsError ? stats.companies : "—";
  const complaintsLabel = stats && !statsError ? stats.complaintsOpen : "—";

  const handleTopSearchKeyDown = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
  };

  const renderDashboard = () => (
    <div className="adm-stack">
      <div className="adm-page-head">
        <h1>Overview</h1>
        <p className="adm-page-sub">
          Platform health and latest sign-ups
          {statsError ? (
            <span className="adm-inline-warn"> · Could not load stats</span>
          ) : null}
        </p>
      </div>

      <div className="adm-stat-grid">
        <div className="adm-stat-card">
          <p className="adm-stat-label">Total users</p>
          <p className="adm-stat-value">{stats == null && !statsError ? "…" : totalUsersLabel}</p>
          <p className="adm-stat-hint">Candidates + companies</p>
        </div>
        <div className="adm-stat-card">
          <p className="adm-stat-label">Active jobs</p>
          <p className="adm-stat-value">{stats == null && !statsError ? "…" : activeJobsLabel}</p>
          <p className="adm-stat-hint">Live listings</p>
        </div>
        <div className="adm-stat-card">
          <p className="adm-stat-label">Companies</p>
          <p className="adm-stat-value">{stats == null && !statsError ? "…" : companiesLabel}</p>
          <p className="adm-stat-hint">Registered orgs</p>
        </div>
        <div className="adm-stat-card">
          <p className="adm-stat-label">Open complaints</p>
          <p className="adm-stat-value">{stats == null && !statsError ? "…" : complaintsLabel}</p>
          <p className="adm-stat-hint">Needs attention</p>
        </div>
      </div>

      <div className="adm-card">
        <div className="adm-card-head">
          <h2>Activity</h2>
        </div>
        <ul className="adm-kv">
          <li>
            <span>Applications</span>
            <strong>{stats && !statsError ? stats.applications : "—"}</strong>
          </li>
          <li>
            <span>All job records</span>
            <strong>{stats && !statsError ? stats.jobs : "—"}</strong>
          </li>
          <li>
            <span>Candidates</span>
            <strong>{stats && !statsError ? stats.candidates : "—"}</strong>
          </li>
        </ul>
      </div>

      <div className="adm-card">
        <div className="adm-card-head">
          <h2>Recent registrations</h2>
          {usersLoadError ? (
            <span className="adm-badge-warn">API unavailable</span>
          ) : null}
        </div>
        {recentRegs.length === 0 ? (
          <p className="adm-empty">No users loaded yet.</p>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {recentRegs.map((u) => {
                  const uid = u.id ?? u._id;
                  const r = u.role || "candidate";
                  return (
                    <tr key={uid ?? u.email}>
                      <td>
                        <div className="adm-user-cell">
                          <UserAvatar user={u} size={36} />
                          <div>
                            <div className="adm-td-title">{displayUserName(u)}</div>
                            <div className="adm-td-sub">{u.email || "—"}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`adm-chip adm-chip--role adm-chip--${String(r).toLowerCase()}`}
                        >
                          {roleLabel(r)}
                        </span>
                      </td>
                      <td className="adm-td-muted">
                        {formatRelativeTime(u.createdAt) || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  const renderUsers = () => (
    <div className="adm-stack">
      <div className="adm-page-head">
        <h1>Users</h1>
        <p className="adm-page-sub">
          {filteredUsers.length} shown
          {usersLoadError ? (
            <span className="adm-inline-warn"> · Could not refresh list</span>
          ) : null}
        </p>
      </div>

      <div className="adm-card adm-card--flush">
        {filteredUsers.length === 0 ? (
          <p className="adm-empty">No users match your search.</p>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th className="adm-th-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const uid = u.id ?? u._id;
                  const r = u.role || "candidate";
                  const isAdmin = r === "admin";
                  return (
                    <tr key={uid ?? u.email}>
                      <td>
                        <div className="adm-user-cell">
                          <UserAvatar user={u} size={40} />
                          <div>
                            <div className="adm-td-title">{displayUserName(u)}</div>
                            <div className="adm-td-sub">{u.email || "—"}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`adm-chip adm-chip--role adm-chip--${String(r).toLowerCase()}`}
                        >
                          {roleLabel(r)}
                        </span>
                      </td>
                      <td className="adm-actions">
                        <button
                          type="button"
                          className="adm-btn adm-btn--ghost"
                          disabled={uid == null || usersLoadError}
                          onClick={() => navigate(`/admin/users/${uid}`)}
                        >
                          View profile
                        </button>
                        <button
                          type="button"
                          className="adm-btn adm-btn--danger"
                          disabled={uid == null || isAdmin || usersLoadError}
                          onClick={() => handleDeleteUser(uid)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  const renderJobs = () => (
    <div className="adm-stack">
      <div className="adm-page-head">
        <h1>Job posts</h1>
        <p className="adm-page-sub">
          {filteredJobs.length} shown
          {jobsLoadError ? (
            <span className="adm-inline-warn"> · Could not refresh list</span>
          ) : null}
        </p>
      </div>

      {filteredJobs.length === 0 ? (
        <div className="adm-card">
          <p className="adm-empty">No jobs match your search.</p>
        </div>
      ) : (
        <ul className="adm-job-list">
          {filteredJobs.map((j) => {
            const jid = j.id ?? j._id;
            const company = j.company?.companyName || "Company";
            const logo = initialsFromName(company).slice(0, 2).toUpperCase();
            const st = String(j.status || "active").toLowerCase();
            return (
              <li key={jid ?? j.title} className="adm-card adm-job-row">
                <div className="adm-job-left">
                  <div className="adm-job-logo" aria-hidden>
                    {logo}
                  </div>
                  <div>
                    <h3 className="adm-job-title">{j.title || "Job"}</h3>
                    <p className="adm-job-meta">
                      {company}
                      {j.location ? ` · ${j.location}` : ""}
                    </p>
                    <p className="adm-job-sub">
                      {j.applicantsCount ?? 0} applicants ·{" "}
                      {formatRelativeTime(j.createdAt) || "—"}
                    </p>
                  </div>
                </div>
                <div className="adm-job-right">
                  <span
                    className={`adm-chip adm-chip--job adm-chip--job-${st === "closed" ? "closed" : "active"}`}
                  >
                    {st === "closed" ? "Closed" : "Active"}
                  </span>
                  <button
                    type="button"
                    className="adm-btn adm-btn--ghost adm-btn--sm"
                    disabled={jid == null || jobsLoadError}
                    onClick={() => navigate(`/admin/jobs/${jid}`)}
                  >
                    View job
                  </button>
                  <button
                    type="button"
                    className="adm-btn adm-btn--accent adm-btn--sm"
                    disabled={jid == null || jobsLoadError || st === "closed"}
                    onClick={() => handleCloseJob(jid)}
                  >
                    Close job
                  </button>
                  <button
                    type="button"
                    className="adm-btn adm-btn--danger adm-btn--sm"
                    disabled={jid == null || jobsLoadError}
                    onClick={() => handleDeleteJob(jid)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  const renderComplaints = () => (
    <div className="adm-stack">
      <div className="adm-page-head">
        <h1>Complaints</h1>
        <p className="adm-page-sub">
          {filteredComplaints.length} shown
          {complaintsLoadError ? (
            <span className="adm-inline-warn"> · Could not refresh list</span>
          ) : null}
        </p>
      </div>

      {filteredComplaints.length === 0 ? (
        <div className="adm-card">
          <p className="adm-empty">No complaints match your search.</p>
        </div>
      ) : (
        <ul className="adm-complaint-list">
          {filteredComplaints.map((c) => {
            const cidNum = Number(c._id ?? c.id);
            const idOk = Number.isFinite(cidNum);
            const status = String(c.status || "open").toLowerCase();
            const fromName = displayUserName(c.user);
            const againstName = c.against ? displayUserName(c.against) : "—";
            return (
              <li key={idOk ? cidNum : c.title} className="adm-card adm-complaint-card">
                <div className="adm-complaint-top">
                  <div>
                    <h3>{c.title || "Complaint"}</h3>
                    <p className="adm-complaint-meta">
                      From {fromName} · Regarding {againstName} ·{" "}
                      {formatRelativeTime(c.createdAt) || "—"}
                    </p>
                  </div>
                  <span className={complaintStatusClass(status)}>{status}</span>
                </div>
                <p className="adm-complaint-body">{c.description || "—"}</p>
                <div className="adm-complaint-actions">
                  <button
                    type="button"
                    className="adm-btn adm-btn--ghost adm-btn--sm"
                    disabled={!idOk || complaintsLoadError || status === "open"}
                    onClick={() => handleComplaintStatus(cidNum, "open")}
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    className="adm-btn adm-btn--accent adm-btn--sm"
                    disabled={!idOk || complaintsLoadError || status === "reviewing"}
                    onClick={() => handleComplaintStatus(cidNum, "reviewing")}
                  >
                    Reviewing
                  </button>
                  <button
                    type="button"
                    className="adm-btn adm-btn--success adm-btn--sm"
                    disabled={!idOk || complaintsLoadError || status === "resolved"}
                    onClick={() => handleComplaintStatus(cidNum, "resolved")}
                  >
                    Resolved
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  return (
    <div className="candidate-page admin-app-page">
      <AppTopbar
        user={me}
        subtitle="Administrator"
        searchPlaceholder={searchPlaceholder}
        searchValue={topSearch}
        onSearchChange={(e) => setTopSearch(e.target.value)}
        onSearchKeyDown={handleTopSearchKeyDown}
        notifUnread={notifUnread}
        messagesUnread={messagesUnread}
        showMessaging
        onLogoClick={goAdminHome}
        onHomeClick={goAdminHome}
        onMessagesClick={() => navigate("/admin/messages")}
        onNotificationsClick={() => navigate("/notifications")}
      />

      <div className="layout">
        <AppSidebar
          user={me}
          activeSection={activeTab}
          notifUnread={notifUnread}
          messagesUnread={messagesUnread}
          onDashboard={() => setActiveTab("dashboard")}
          onUsers={() => setActiveTab("users")}
          onJobs={() => setActiveTab("jobs")}
          onComplaints={() => setActiveTab("complaints")}
          onMessages={() => navigate("/admin/messages")}
          onNotifications={() => navigate("/notifications")}
          onSignOut={signOut}
        />

        <main className="main-content adm-main">
          {activeTab === "dashboard" && renderDashboard()}
          {activeTab === "users" && renderUsers()}
          {activeTab === "jobs" && renderJobs()}
          {activeTab === "complaints" && renderComplaints()}
        </main>
      </div>
    </div>
  );
}
