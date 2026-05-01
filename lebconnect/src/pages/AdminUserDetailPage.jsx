import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/axios";
import AppTopbar from "../components/AppTopbar";
import AppSidebar from "../components/AppSidebar";
import UserAvatar from "../components/UserAvatar";
import { formatRelativeTime } from "../utils/format";
import { getUser } from "../utils/auth";
import "./AdminDashboard.css";

function displayNameFromRow(u) {
  if (!u) return "";
  return u.fullName || u.companyName || u.email || "User";
}

export default function AdminUserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const me = getUser();
  const uid = Number(id);

  const [payload, setPayload] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [topSearch, setTopSearch] = useState("");
  const [notifUnread, setNotifUnread] = useState(0);
  const [messagesUnread, setMessagesUnread] = useState(0);
  const [deletingPostId, setDeletingPostId] = useState(null);

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

  const signOut = () => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
    navigate("/login", { replace: true });
  };

  const goDash = () => navigate("/admin-dashboard");

  const handleDeletePost = async (postId) => {
    const pid = Number(postId);
    if (!Number.isFinite(pid)) return;
    if (!window.confirm("Delete this post permanently?")) return;
    setDeletingPostId(pid);
    try {
      await api.delete(`/api/posts/${pid}`);
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

  return (
    <div className="candidate-page admin-app-page">
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
        onMessagesClick={() => navigate("/admin/messages")}
        onNotificationsClick={() => navigate("/notifications")}
      />

      <div className="layout">
        <AppSidebar
          user={me}
          activeSection="users"
          notifUnread={notifUnread}
          onDashboard={goDash}
          onUsers={() => navigate("/admin-dashboard?tab=users")}
          onJobs={() => navigate("/admin-dashboard?tab=jobs")}
          onComplaints={() => navigate("/admin-dashboard?tab=complaints")}
          onMessages={() => navigate("/admin/messages")}
          onNotifications={() => navigate("/notifications")}
          onSignOut={signOut}
        />

        <main className="main-content adm-main adm-user-detail">
          <div className="adm-stack">
            <div className="adm-page-head adm-user-detail-head">
              <div>
                <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => navigate("/admin-dashboard?tab=users")}>
                  ← Back to users
                </button>
                <h1>User profile</h1>
                <p className="adm-page-sub">Admin view · ID {id}</p>
              </div>
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
                  <div className="adm-card">
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
                  <div className="adm-card">
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

                <div className="adm-card">
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
                              className="adm-btn adm-btn--danger adm-btn--sm"
                              disabled={deletingPostId === pid}
                              onClick={() => handleDeletePost(pid)}
                            >
                              {deletingPostId === pid ? "…" : "Delete post"}
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
    </div>
  );
}
