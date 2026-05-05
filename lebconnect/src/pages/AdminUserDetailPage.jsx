import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../api/axios";
import AppTopbar from "../components/AppTopbar";
import AppSidebar from "../components/AppSidebar";
import Modal from "../components/Modal";
import UserAvatar from "../components/UserAvatar";
import { Loader2, Mail, Trash2 } from "lucide-react";
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

function displayNameFromRow(u) {
  if (!u) return "";
  return u.fullName || u.companyName || u.email || "User";
}

export default function AdminUserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const me = getUser();
  const uid = Number(id);

  const [payload, setPayload] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [topSearch, setTopSearch] = useState("");
  const [notifUnread, setNotifUnread] = useState(0);
  const [messagesUnread, setMessagesUnread] = useState(0);
  const [deletingPostId, setDeletingPostId] = useState(null);
  const [postDeleteTarget, setPostDeleteTarget] = useState(null);

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

  const loadDetail = useCallback(async () => {
    if (!Number.isFinite(uid)) {
      setLoadError("Invalid user id.");
      setPayload(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError("");
    try {
      const { data } = await api.get(`/api/admin/users/${uid}`);
      setPayload(data);
    } catch (e) {
      setPayload(null);
      setLoadError(e.response?.data?.message || e.message || "Could not load user.");
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    void loadUnread();
    void loadMsgUnread();
  }, [loadUnread, loadMsgUnread]);

  useEffect(() => {
    const s = location.state;
    if (!s || loading) return;
    if (!s.scrollPosts && !s.scrollJobs && !s.scrollApps) return;
    requestAnimationFrame(() => {
      if (s.scrollPosts) document.getElementById("adm-sec-posts")?.scrollIntoView({ behavior: "smooth", block: "start" });
      else if (s.scrollJobs) document.getElementById("adm-sec-jobs")?.scrollIntoView({ behavior: "smooth", block: "start" });
      else if (s.scrollApps) document.getElementById("adm-sec-apps")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    navigate(".", { replace: true, state: {} });
  }, [loading, location.state, navigate]);

  const signOut = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const goDash = () => navigate("/admin-dashboard");

  const confirmDeletePost = async () => {
    const pid = Number(postDeleteTarget?.pid);
    if (!Number.isFinite(pid)) return;
    setDeletingPostId(pid);
    try {
      await api.delete(`/api/posts/${pid}`);
      setPostDeleteTarget(null);
      await loadDetail();
    } catch (e) {
      alert(e.response?.data?.message || "Could not delete post");
    } finally {
      setDeletingPostId(null);
    }
  };

  const user = payload?.user;
  const posts = useMemo(() => (Array.isArray(user?.posts) ? user.posts : []), [user]);

  const handleTopSearchKeyDown = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
  };

  const profileType = payload?.profileType || "";

  const targetUid = user?.id ?? user?._id ?? uid;

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
          activeSection="users"
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

        <main className="main-content adm-main adm-user-detail lc-adm-main">
          <div className="adm-stack">
            <div className="adm-page-head adm-user-detail-head">
              <div>
                <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => navigate(adminDashboardPathForTab("users"))}>
                  ← Back to users
                </button>
                <h1>User profile</h1>
                <p className="adm-page-sub">Admin view · ID {id}</p>
              </div>
              {user && Number.isFinite(Number(targetUid)) ? (
                <button
                  type="button"
                  className="adm-btn adm-btn--accent lc-adm-ic-btn"
                  onClick={() =>
                    navigate(
                      `${ADMIN_MESSAGES_PATH}?userId=${encodeURIComponent(String(targetUid))}`
                    )
                  }
                >
                  <Mail size={16} strokeWidth={2} aria-hidden /> Message user
                </button>
              ) : null}
            </div>

            {loading ? <p className="adm-empty">Loading…</p> : null}
            {!loading && loadError ? <p className="adm-inline-warn">{loadError}</p> : null}

            {!loading && user ? (
              <>
                <div className="adm-card adm-profile-card">
                  <div className="adm-profile-top">
                    <UserAvatar user={user} size={64} />
                    <div>
                      <h2>{displayNameFromRow(user)}</h2>
                      <p className="adm-td-sub">{user.email || "—"}</p>
                      <p className="adm-page-sub">
                        <span className={`adm-chip adm-chip--role adm-chip--${String(user.role || "").toLowerCase()}`}>
                          {user.role || "—"}
                        </span>
                        {" · "}
                        Joined {formatRelativeTime(user.createdAt) || "—"}
                      </p>
                    </div>
                  </div>
                  <ul className="adm-kv adm-kv--profile">
                    <li>
                      <span>Location</span>
                      <strong>{user.location || "—"}</strong>
                    </li>
                    {user.role === "candidate" ? (
                      <li>
                        <span>Specialization</span>
                        <strong>{user.specialization || "—"}</strong>
                      </li>
                    ) : null}
                    {user.role === "company" ? (
                      <li>
                        <span>Industry</span>
                        <strong>{user.industry || "—"}</strong>
                      </li>
                    ) : null}
                    <li>
                      <span>Bio</span>
                      <strong className="adm-kv-bio">{user.bio || "—"}</strong>
                    </li>
                    {Array.isArray(user.skills) && user.skills.length > 0 ? (
                      <li>
                        <span>Skills</span>
                        <strong>{user.skills.join(", ")}</strong>
                      </li>
                    ) : null}
                  </ul>
                </div>

                {profileType === "candidate" && Array.isArray(payload.applications) ? (
                  <div className="adm-card" id="adm-sec-apps">
                    <div className="adm-card-head">
                      <h2>Applications</h2>
                    </div>
                    {payload.applications.length === 0 ? (
                      <p className="adm-empty">No applications.</p>
                    ) : (
                      <ul className="adm-mini-list">
                        {payload.applications.map((a) => (
                          <li key={a.id ?? a._id}>
                            <strong>{a.job?.title || "Job"}</strong>
                            <span className="adm-td-muted">
                              {" · "}
                              {a.company?.companyName || "Company"} · {a.status || "—"} ·{" "}
                              {formatRelativeTime(a.createdAt) || "—"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}

                {profileType === "company" && Array.isArray(payload.jobs) ? (
                  <div className="adm-card" id="adm-sec-jobs">
                    <div className="adm-card-head">
                      <h2>Job posts ({payload.jobs.length})</h2>
                    </div>
                    {payload.jobs.length === 0 ? (
                      <p className="adm-empty">No jobs.</p>
                    ) : (
                      <ul className="adm-mini-list">
                        {payload.jobs.map((j) => (
                          <li key={j.id ?? j._id}>
                            <button
                              type="button"
                              className="adm-linkish"
                              onClick={() => navigate(`/admin/jobs/${j.id ?? j._id}`)}
                            >
                              {j.title || "Job"}
                            </button>
                            <span className="adm-td-muted">
                              {" · "}
                              {j.status || "—"} · {j.applicantsCount ?? 0} applicants
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}

                <div className="adm-card" id="adm-sec-posts">
                  <div className="adm-card-head">
                    <h2>Posts ({posts.length})</h2>
                    <span className="adm-page-sub">View posts · Delete post</span>
                  </div>
                  {posts.length === 0 ? (
                    <p className="adm-empty">No posts from this user.</p>
                  ) : (
                    <ul className="adm-admin-post-list">
                      {posts.map((p) => {
                        const pid = p.id ?? p._id;
                        const likes = Array.isArray(p.likes) ? p.likes.length : 0;
                        const comments = Array.isArray(p.comments) ? p.comments.length : 0;
                        return (
                          <li key={pid} className="adm-admin-post-card">
                            <div className="adm-admin-post-main">
                              <p className="adm-admin-post-content">{p.content || "—"}</p>
                              {p.image ? (
                                <img src={p.image} alt="" className="adm-admin-post-img" />
                              ) : null}
                              <p className="adm-td-muted">
                                {formatRelativeTime(p.createdAt) || "—"} · {likes} likes · {comments}{" "}
                                comments
                              </p>
                            </div>
                            <button
                              type="button"
                              className="adm-btn adm-btn--danger adm-btn--sm lc-adm-ic-btn"
                              disabled={deletingPostId === pid}
                              onClick={() =>
                                setPostDeleteTarget({
                                  pid,
                                  excerpt: String(p.content || "").slice(0, 140),
                                })
                              }
                            >
                              <Trash2 size={14} strokeWidth={2} aria-hidden />
                              {deletingPostId === pid ? "…" : "Delete"}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </main>
      </div>

      <Modal
        open={Boolean(postDeleteTarget)}
        title="Delete post?"
        onClose={() => !deletingPostId && setPostDeleteTarget(null)}
      >
        {postDeleteTarget ? (
          <div className="adm-delete-modal">
            <p>
              Permanently remove this post?
              {postDeleteTarget.excerpt ? (
                <>
                  {" "}
                  <em>{postDeleteTarget.excerpt}</em>
                  {postDeleteTarget.excerpt.length >= 140 ? "…" : ""}
                </>
              ) : null}
            </p>
            <div className="adm-modal-footer-actions">
              <button
                type="button"
                className="adm-btn adm-btn--ghost"
                disabled={deletingPostId != null}
                onClick={() => setPostDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="adm-btn adm-btn--danger lc-adm-ic-btn"
                disabled={deletingPostId != null}
                onClick={() => void confirmDeletePost()}
              >
                {deletingPostId != null ? (
                  <Loader2 className="adm-spin" size={18} strokeWidth={2.5} aria-hidden />
                ) : (
                  <>
                    <Trash2 size={16} strokeWidth={2} aria-hidden /> Delete post
                  </>
                )}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </motion.div>
  );
}
