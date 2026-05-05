import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/axios";
import AppTopbar from "../components/AppTopbar";
import AppSidebar from "../components/AppSidebar";
import Modal from "../components/Modal";
import UserAvatar from "../components/UserAvatar";
import { Loader2 } from "lucide-react";
import { formatRelativeTime } from "../utils/format";
import { getUser, logout } from "../utils/auth";
import {
  ADMIN_MESSAGES_PATH,
  ADMIN_NOTIFICATIONS_PATH,
  adminDashboardPathForTab,
} from "../utils/adminNav";
import { motion } from "framer-motion";
import { lcMotionPage } from "../utils/motionProps";
import "./Dashboard.css";
import "./CandidateDashboard.css";
import "./AdminDashboard.css";

function requirementsText(job) {
  const r = job?.requirements;
  if (Array.isArray(r)) return r.filter(Boolean).join("\n");
  if (typeof r === "string") {
    try {
      const j = JSON.parse(r);
      if (Array.isArray(j)) return j.filter(Boolean).join("\n");
    } catch {
      /* plain string */
    }
    return r;
  }
  return "—";
}

export default function AdminJobDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const me = getUser();
  const jid = Number(id);

  const [job, setJob] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [topSearch, setTopSearch] = useState("");
  const [notifUnread, setNotifUnread] = useState(0);
  const [messagesUnread, setMessagesUnread] = useState(0);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const loadUnread = useCallback(async () => {
    try {
      const { data } = await api.get("/api/notifications");
      const list = Array.isArray(data) ? data : [];
      setNotifUnread(list.filter((n) => !n.isRead).length);
    } catch {
      setNotifUnread(0);
    }
  }, []);

  const loadMsgUnread = useCallback(async () => {
    try {
      const { data } = await api.get("/api/messages/conversations");
      const list = Array.isArray(data) ? data : [];
      setMessagesUnread(list.reduce((a, r) => a + Number(r.unread || 0), 0));
    } catch {
      setMessagesUnread(0);
    }
  }, []);

  const loadJob = useCallback(async () => {
    if (!Number.isFinite(jid)) {
      setLoadError("Invalid job id.");
      setJob(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError("");
    try {
      const { data } = await api.get(`/api/admin/jobs/${jid}`);
      setJob(data);
    } catch (e) {
      setJob(null);
      setLoadError(e.response?.data?.message || e.message || "Could not load job.");
    } finally {
      setLoading(false);
    }
  }, [jid]);

  useEffect(() => {
    void loadJob();
  }, [loadJob]);

  useEffect(() => {
    void loadUnread();
    void loadMsgUnread();
  }, [loadUnread, loadMsgUnread]);

  const signOut = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const goDash = () => navigate("/admin-dashboard");

  const company = job?.company;
  const companyName = company?.companyName || "Company";
  const st = String(job?.status || "active").toLowerCase();

  const handleDeleteConfirmed = async () => {
    if (!Number.isFinite(jid)) return;
    setBusy(true);
    try {
      await api.delete(`/api/admin/jobs/${jid}`);
      setConfirmDelete(false);
      navigate(adminDashboardPathForTab("jobs"), { replace: true });
    } catch (e) {
      alert(e.response?.data?.message || "Could not delete job");
    } finally {
      setBusy(false);
    }
  };

  const handleClose = async () => {
    if (!Number.isFinite(jid)) return;
    if (st === "closed") return;
    setBusy(true);
    try {
      await api.put(`/api/admin/jobs/${jid}/close`);
      await loadJob();
    } catch (e) {
      alert(e.response?.data?.message || "Could not close job");
    } finally {
      setBusy(false);
    }
  };

  const handleTopSearchKeyDown = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
  };

  return (
    <motion.div className="candidate-page admin-app-page" {...lcMotionPage()}>
      <AppTopbar
        user={me}
        subtitle="Administrator"
        searchPlaceholder="Search…"
        searchValue={topSearch}
        onSearchChange={(e) => setTopSearch(e.target.value)}
        onSearchKeyDown={handleTopSearchKeyDown}
        notifUnread={notifUnread}
        messagesUnread={messagesUnread}
        showMessaging
        onLogoClick={goDash}
        onHomeClick={goDash}
        onMessagesClick={() => navigate(ADMIN_MESSAGES_PATH)}
        onNotificationsClick={() => navigate(ADMIN_NOTIFICATIONS_PATH)}
      />

      <div className="dashboard-body">
        <AppSidebar
          user={me}
          activeSection="jobs"
          notifUnread={notifUnread}
          messagesUnread={messagesUnread}
          onDashboard={goDash}
          onUsers={() => navigate(adminDashboardPathForTab("users"))}
          onJobs={() => navigate(adminDashboardPathForTab("jobs"))}
          onComplaints={() => navigate(adminDashboardPathForTab("complaints"))}
          onModeration={() => navigate(adminDashboardPathForTab("moderation"))}
          onMessages={() => navigate(ADMIN_MESSAGES_PATH)}
          onNotifications={() => navigate(ADMIN_NOTIFICATIONS_PATH)}
          onSignOut={signOut}
        />

        <main className="main-content adm-main adm-job-detail lc-adm-main">
          <div className="adm-stack">
            <div className="adm-page-head adm-user-detail-head">
              <button
                type="button"
                className="adm-btn adm-btn--ghost adm-btn--sm"
                onClick={() => navigate(adminDashboardPathForTab("jobs"))}
              >
                ← Back to job posts
              </button>
              <h1>Job details</h1>
              <p className="adm-page-sub">ID {id}</p>
            </div>

            {loading ? <p className="adm-empty">Loading…</p> : null}
            {!loading && loadError ? <p className="adm-inline-warn">{loadError}</p> : null}

            {!loading && job ? (
              <div className="adm-card adm-job-detail-card">
                <div className="adm-profile-top">
                  <UserAvatar user={company} name={companyName} size={56} />
                  <div>
                    <h2>{job.title || "Job"}</h2>
                    <p className="adm-td-title">{companyName}</p>
                    <p className="adm-page-sub">
                      <span
                        className={`adm-chip adm-chip--job adm-chip--job-${st === "closed" ? "closed" : "active"}`}
                      >
                        {st === "closed" ? "Closed" : "Active"}
                      </span>
                      {" · "}
                      Posted {formatRelativeTime(job.createdAt) || "—"}
                    </p>
                  </div>
                </div>

                <ul className="adm-kv adm-kv--profile">
                  <li>
                    <span>Location</span>
                    <strong>{job.location || "—"}</strong>
                  </li>
                  <li>
                    <span>Type</span>
                    <strong>{job.type || "—"}</strong>
                  </li>
                  <li>
                    <span>Salary</span>
                    <strong>{job.salary || "—"}</strong>
                  </li>
                  <li>
                    <span>Applicants</span>
                    <strong>{job.applicantsCount ?? 0}</strong>
                  </li>
                  <li className="adm-kv-full">
                    <span>Description</span>
                    <strong className="adm-kv-bio">{job.description || "—"}</strong>
                  </li>
                  <li className="adm-kv-full">
                    <span>Requirements</span>
                    <strong className="adm-kv-bio adm-kv-pre">{requirementsText(job)}</strong>
                  </li>
                </ul>

                <div className="adm-job-detail-actions">
                  <button
                    type="button"
                    className="adm-btn adm-btn--accent"
                    disabled={busy || st === "closed"}
                    onClick={handleClose}
                  >
                    Close job
                  </button>
                  <button
                    type="button"
                    className="adm-btn adm-btn--danger"
                    disabled={busy}
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete job
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </main>
      </div>

      <Modal open={confirmDelete} title="Delete this job?" onClose={() => !busy && setConfirmDelete(false)}>
        <div className="adm-delete-modal">
          <p>This permanently removes the listing and may affect applicants.</p>
          <div className="adm-modal-footer-actions">
            <button type="button" className="adm-btn adm-btn--ghost" disabled={busy} onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
            <button type="button" className="adm-btn adm-btn--danger" disabled={busy} onClick={() => void handleDeleteConfirmed()}>
              {busy ? <Loader2 className="adm-spin" size={18} strokeWidth={2.5} aria-hidden /> : "Delete"}
            </button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
