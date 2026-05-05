import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import AppTopbar from "../components/AppTopbar";
import AppSidebar from "../components/AppSidebar";
import CandidateSidebar from "../components/CandidateSidebar";
import Loading from "../components/Loading";
import DashboardRail from "../components/DashboardRail";
import { formatRelativeTime } from "../utils/format";
import { motion } from "framer-motion";
import {
  Bell,
  Briefcase,
  Calendar,
  ClipboardCheck,
  FileText,
  Heart,
  MessageCircle,
  MessageSquare,
  ShieldCheck,
  UserPlus,
  X,
} from "lucide-react";

import {
  dashboardPath,
  FEED_PATH,
  getRole,
  getUser,
  logout,
} from "../utils/auth";
import {
  ADMIN_DASHBOARD_PATH,
  ADMIN_MESSAGES_PATH,
  ADMIN_NOTIFICATIONS_PATH,
  adminDashboardPathForTab,
} from "../utils/adminNav";
import { lcMotionPage } from "../utils/motionProps";
import "./NotificationsPage.css";
import "./Dashboard.css";
import "./CandidateDashboard.css";
import "./AdminDashboard.css";

function normalizeType(apiType) {
  const t = String(apiType || "").toLowerCase();
  const allowed = [
    "application",
    "message",
    "post",
    "follow",
    "interview",
    "job_alert",
    "system",
  ];
  return allowed.includes(t) ? t : "system";
}

function notificationVisual(apiType, text = "") {
  const raw = String(apiType || "").toLowerCase();
  if (raw === "interview") return { Icon: Calendar, typeClass: "interview" };
  if (raw === "job_alert") return { Icon: Briefcase, typeClass: "job-alert" };
  if (raw === "verification")
    return { Icon: ShieldCheck, typeClass: "verification" };

  const lower = String(text || "").toLowerCase();
  switch (normalizeType(apiType)) {
    case "message":
      return { Icon: MessageSquare, typeClass: "message" };
    case "post":
      if (/\b(comment|replied)\b/i.test(lower)) {
        return { Icon: MessageCircle, typeClass: "comment" };
      }
      if (/\b(like|liked)\b/i.test(lower)) {
        return { Icon: Heart, typeClass: "like" };
      }
      return { Icon: FileText, typeClass: "post" };
    case "follow":
      return { Icon: UserPlus, typeClass: "follow" };
    case "application":
      return { Icon: ClipboardCheck, typeClass: "application" };
    default:
      return { Icon: Bell, typeClass: "system" };
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
  const rawMsg = typeof n.message === "string" ? n.message : "";
  const { Icon, typeClass } = notificationVisual(rawType, rawMsg);
  return {
    _id: id,
    id,
    type: normalized,
    typeClass,
    Icon,
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
  "interview",
  "job_alert",
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
    logout();
    navigate("/login", { replace: true });
  };

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
          {role === "admin" ? (
            <p className="notifications-sub muted lc-admin-notif-hint">
              Admin account — moderation and system notices appear here like any user.
            </p>
          ) : null}
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
            interview: "Interview",
            job_alert: "Job alerts",
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
          filteredNotifications.map((item) => {
            const NotifIcon = item.Icon;
            return (
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
                <NotifIcon size={22} strokeWidth={2} aria-hidden />
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
                  className="close-btn lc-notif-close"
                  aria-label="Delete notification"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    deleteOne(item.id, e);
                  }}
                >
                  <X strokeWidth={2.25} size={18} aria-hidden />
                </button>
              </div>
            </div>
          );
          })}
      </div>
    </>
  );

  if (role === "admin") {
    const goDash = () => navigate(ADMIN_DASHBOARD_PATH);
    return (
      <motion.div className="candidate-page admin-app-page" {...lcMotionPage()}>
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
          onMessagesClick={() => navigate(ADMIN_MESSAGES_PATH)}
          onNotificationsClick={() => navigate(ADMIN_NOTIFICATIONS_PATH)}
        />
        <div className="dashboard-body">
          <AppSidebar
            user={user}
            notificationsActive
            activeSection="dashboard"
            notifUnread={unreadCount}
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
          <main className="main-content lc-notifications-main adm-main admin-notifications-main lc-adm-main">
            {notificationsInner}
          </main>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div className="candidate-page lc-page-notifications" {...lcMotionPage()}>
      <AppTopbar
        user={user}
        searchPlaceholder={
          role === "company"
            ? "Search jobs, notifications…"
            : "Search jobs, notifications…"
        }
        searchValue={topSearch}
        onSearchChange={(e) => setTopSearch(e.target.value)}
        onSearchKeyDown={handleTopSearchKeyDown}
        notifUnread={unreadCount}
        messagesUnread={messagesUnread}
        onLogoClick={goRoleHome}
        onHomeClick={goRoleHome}
        onMessagesClick={() => navigate("/messages")}
        onNotificationsClick={() => navigate("/notifications")}
        subtitle={roleLabel}
      />

      <div className="layout">
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
            onFeed={() => navigate(FEED_PATH)}
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
            onFeed={() => navigate(FEED_PATH)}
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

        <main className="main-content lc-notifications-main">{notificationsInner}</main>
        <DashboardRail />
      </div>
    </motion.div>
  );
}

export default NotificationsPage;
