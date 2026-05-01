import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import AppTopbar from "../components/AppTopbar";
import AppSidebar from "../components/AppSidebar";
import UserAvatar from "../components/UserAvatar";
import CandidateSidebar from "../components/CandidateSidebar";
import Loading from "../components/Loading";
import { formatRelativeTime } from "../utils/format";
import { dashboardPath, getRole, getUser, logout } from "../utils/auth";
import "./NotificationsPage.css";
import "./CandidateDashboard.css";
import "./AdminDashboard.css";

function normalizeType(apiType) {
  const t = String(apiType || "").toLowerCase();
  const allowed = ["application", "message", "post", "follow", "system"];
  return allowed.includes(t) ? t : "system";
}

function notificationVisual(apiType) {
  switch (normalizeType(apiType)) {
    case "message":
      return { icon: "✉", typeClass: "message" };
    case "post":
      return { icon: "📝", typeClass: "post" };
    case "follow":
      return { icon: "+", typeClass: "follow" };
    case "application":
      return { icon: "✓", typeClass: "application" };
    default:
      return { icon: "🔔", typeClass: "system" };
  }
}

function dashboardUrlForRole(role) {
  if (role === "company") return "/company-dashboard";
  if (role === "admin") return "/admin-dashboard";
  return "/candidate-dashboard";
}

function mapApiRow(n) {
  const id = n.id ?? n._id;
  const rawType = n.type ?? "system";
  const normalized = normalizeType(rawType);
  const { icon, typeClass } = notificationVisual(rawType);
  return {
    _id: id,
    id,
    type: normalized,
    typeClass,
    icon,
    title: n.title || "Notification",
    text: n.message || "",
    time: formatRelativeTime(n.createdAt) || "",
    isRead: Boolean(n.isRead),
  };
}

const TAB_IDS = [
  "all",
  "unread",
  "message",
  "post",
  "follow",
  "application",
  "system",
];

function NotificationsPage() {
  const navigate = useNavigate();
  const user = getUser();
  const role = getRole();

  const [activeTab, setActiveTab] = useState("all");
  const [items, setItems] = useState([]);
  const [usedFallback, setUsedFallback] = useState(false);
  const [loading, setLoading] = useState(true);
  const [topSearch, setTopSearch] = useState("");
  const [messagesUnread, setMessagesUnread] = useState(0);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/notifications");
      const list = Array.isArray(data) ? data.map(mapApiRow) : [];
      setItems(list);
      setUsedFallback(false);
    } catch {
      setItems([]);
      setUsedFallback(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

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

  const unreadCount = items.filter((n) => !n.isRead).length;

  const filteredNotifications = useMemo(() => {
    let list = items;
    if (activeTab === "unread") {
      list = items.filter((n) => !n.isRead);
    } else if (activeTab !== "all") {
      list = items.filter((n) => n.type === activeTab);
    }
    const q = topSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((n) => {
        const blob = `${n.title || ""} ${n.text || ""}`.toLowerCase();
        return blob.includes(q);
      });
    }
    return list;
  }, [items, activeTab, topSearch]);

  const markAllRead = async () => {
    if (usedFallback) return;
    try {
      await api.put("/api/notifications/read-all");
      await loadNotifications();
    } catch {
      alert("Could not mark all as read.");
    }
  };

  const markOneRead = async (nid) => {
    if (usedFallback || nid == null) return;
    try {
      await api.put(`/api/notifications/${nid}/read`);
      await loadNotifications();
    } catch {
      alert("Could not update notification.");
    }
  };

  const deleteOne = async (nid, e) => {
    e?.stopPropagation?.();
    if (usedFallback || nid == null) return;
    try {
      await api.delete(`/api/notifications/${nid}`);
      await loadNotifications();
    } catch {
      alert("Could not delete notification.");
    }
  };

  const signOut = () => {
    try {
      if (role === "admin") localStorage.clear();
      else logout();
    } catch {
      logout();
    }
    navigate("/login", { replace: true });
  };

  const displayName =
    user?.fullName || user?.companyName || user?.email || "Member";
  const roleLabel =
    user?.role === "company"
      ? "Company"
      : user?.role === "admin"
        ? "Admin"
        : "Candidate";
  const uid = user?.id ?? user?._id;

  const goRoleHome = () => {
    if (role) navigate(dashboardPath(role));
    else navigate("/");
  };

  const handleTopSearchKeyDown = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (role === "admin") return;
    const q = topSearch.trim();
    if (!q) {
      goRoleHome();
      return;
    }
    if (role === "candidate") {
      navigate("/candidate-dashboard", { state: { tab: "findJobs", q } });
      return;
    }
    if (role) {
      navigate(`${dashboardPath(role)}?q=${encodeURIComponent(q)}`);
      return;
    }
    navigate(`/?q=${encodeURIComponent(q)}`);
  };

  const notificationsInner = (
    <>
      <div className="notifications-header">
        <div>
          <h1>Notifications</h1>
          {!usedFallback ? (
            <p className="notifications-sub">{unreadCount} unread</p>
          ) : (
            <p className="notifications-sub muted">
              Connect to the API to load alerts.
            </p>
          )}
        </div>

        <button
          type="button"
          className="mark-read-btn"
          onClick={markAllRead}
          disabled={usedFallback || unreadCount === 0}
        >
          Mark all as read
        </button>
      </div>

      <div className="notif-tabs" role="tablist">
        {TAB_IDS.map((tid) => {
          const labels = {
            all: "All",
            unread: "Unread",
            message: "Message",
            post: "Post",
            follow: "Follow",
            application: "Application",
            system: "System",
          };
          const label = labels[tid] || tid;
          return (
            <button
              key={tid}
              type="button"
              role="tab"
              className={activeTab === tid ? "notif-tab active" : "notif-tab"}
              onClick={() => setActiveTab(tid)}
              aria-selected={activeTab === tid}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="notifications-list">
        {loading ? (
          <Loading label="Loading notifications…" />
        ) : null}
        {!loading && filteredNotifications.length === 0 ? (
          <div className="notifications-empty-card">
            <h3>
              {items.length === 0 && !topSearch.trim()
                ? "No notifications yet"
                : "No notifications match"}
            </h3>
          </div>
        ) : null}
        {!loading &&
          filteredNotifications.map((item) => (
            <div
              role="button"
              tabIndex={0}
              key={item._id || item.id}
              className={`notification-card ${
                item.isRead ? "read" : "unread"
              }`}
              onClick={() =>
                item.id != null && !usedFallback && markOneRead(item.id)
              }
              onKeyDown={(e) => {
                if (e.key !== "Enter" && e.key !== " ") return;
                e.preventDefault();
                if (item.id != null && !usedFallback) markOneRead(item.id);
              }}
            >
              <div className={`notification-icon ${item.typeClass}`}>
                {item.icon}
              </div>

              <div className="notification-content">
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                <span>{item.time}</span>
              </div>

              <div className="notification-right">
                {!item.isRead ? <div className="blue-dot"></div> : null}
                <button
                  type="button"
                  className="close-btn"
                  aria-label="Delete notification"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    deleteOne(item.id, e);
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
      </div>
    </>
  );

  if (role === "admin") {
    const goDash = () => navigate("/admin-dashboard");
    return (
      <div className="candidate-page admin-app-page">
        <AppTopbar
          user={user}
          subtitle="Administrator"
          searchPlaceholder="Search notifications…"
          searchValue={topSearch}
          onSearchChange={(e) => setTopSearch(e.target.value)}
          onSearchKeyDown={handleTopSearchKeyDown}
          notifUnread={unreadCount}
          messagesUnread={messagesUnread}
          showMessaging
          onLogoClick={goDash}
          onHomeClick={goDash}
          onMessagesClick={() => navigate("/admin/messages")}
          onNotificationsClick={() => navigate("/notifications")}
        />
        <div className="layout">
          <AppSidebar
            user={user}
            notificationsActive
            activeSection="dashboard"
            notifUnread={unreadCount}
            messagesUnread={messagesUnread}
            onDashboard={goDash}
            onUsers={() => navigate("/admin-dashboard?tab=users")}
            onJobs={() => navigate("/admin-dashboard?tab=jobs")}
            onComplaints={() => navigate("/admin-dashboard?tab=complaints")}
            onMessages={() => navigate("/admin/messages")}
            onNotifications={() => navigate("/notifications")}
            onSignOut={signOut}
          />
          <main className="main-content notifications-main adm-main admin-notifications-main">
            {notificationsInner}
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="notifications-page">
      <header className="notifications-topbar">
        <div className="notifications-topbar-left">
          <div
            className="notif-brand-mark"
            role="button"
            tabIndex={0}
            onClick={goRoleHome}
            onKeyDown={(e) => e.key === "Enter" && goRoleHome()}
          />

          <div className="notif-search">
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

        <div className="notifications-topbar-right">
          <div
            className="notif-top-nav-item"
            role="button"
            tabIndex={0}
            onClick={goRoleHome}
          >
            <span>⌂</span>
            <p>Home</p>
          </div>

          <div
            className="notif-top-nav-item notif-msg-nav"
            role="button"
            tabIndex={0}
            onClick={() => navigate("/messages")}
          >
            <span>✉</span>
            <p>Messaging</p>
            {messagesUnread > 0 ? (
              <div className="notif-msg-badge">{messagesUnread}</div>
            ) : null}
          </div>

          <div className="notif-top-nav-item notif-top-active">
            <span>🔔</span>
            <p>Notifications</p>
            {unreadCount > 0 ? (
              <div className="notif-red-badge">{unreadCount}</div>
            ) : null}
          </div>

          <div className="notif-top-divider"></div>

          <div className="notif-user-mini">
            <UserAvatar user={user} size={40} />
            <div>
              <h4>{displayName}</h4>
              <p>{roleLabel}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="notifications-layout">
        {role === "company" ? (
          <CandidateSidebar
            variant="company"
            user={user}
            activeKey="notifications"
            notifUnread={unreadCount}
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
            onMyProfile={() => {
              if (uid) navigate(`/company-profile/${uid}`);
            }}
            onFindJobs={() => {}}
            onApplications={() => {}}
            onSavedJobs={() => {}}
            onSignOut={signOut}
          />
        ) : (
          <CandidateSidebar
            user={user}
            activeKey="notifications"
            notifUnread={unreadCount}
            messagesUnread={messagesUnread}
            onDashboard={() => navigate(dashboardUrlForRole(role))}
            onFeed={() => navigate("/dashboard")}
            onFindJobs={() =>
              navigate("/candidate-dashboard", { state: { tab: "findJobs" } })
            }
            onApplications={() =>
              navigate("/candidate-dashboard", {
                state: { tab: "applications" },
              })
            }
            onSavedJobs={() =>
              navigate("/candidate-dashboard", { state: { tab: "savedJobs" } })
            }
            onMessages={() => navigate("/messages")}
            onNotifications={() => navigate("/notifications")}
            onMyProfile={() => {
              if (!uid) return;
              navigate(`/candidate-profile/${uid}`);
            }}
            onSignOut={signOut}
          />
        )}

        <main className="notifications-main">{notificationsInner}</main>
      </div>
    </div>
  );
}

export default NotificationsPage;
