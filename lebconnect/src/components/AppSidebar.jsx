import { createElement } from "react";

import UserAvatar from "./UserAvatar";
import { displayNameFromUser } from "../utils/avatar";
import {
  Bell,
  BriefcaseBusiness,
  Flag,
  LayoutDashboard,
  LogOut,
  Mail,
  ShieldAlert,
  Users,
} from "lucide-react";
import "./CandidateSidebar.css";

const IC = { size: 20, strokeWidth: 2 };

function AdminNavIcon({ icon }) {
  return (
    <span className="csb-link-icon">{createElement(icon, IC)}</span>
  );
}

/**
 * Admin dashboard navigation — matches Candidate/Company sidebar chrome.
 *
 * @param {{
 *   user: object | null;
 *   activeSection: 'dashboard' | 'users' | 'jobs' | 'complaints' | 'moderation' | 'messages';
 *   notificationsActive?: boolean;
 *   notifUnread?: number;
 *   messagesUnread?: number;
 *   complaintsOpen?: number;
 *   moderationPending?: number;
 *   onDashboard: () => void;
 *   onUsers: () => void;
 *   onJobs: () => void;
 *   onComplaints: () => void;
 *   onModeration?: () => void;
 *   onMessages?: () => void;
 *   onNotifications: () => void;
 *   onSignOut: () => void;
 * }} props
 */
export default function AppSidebar({
  user,
  activeSection,
  notificationsActive = false,
  notifUnread = 0,
  messagesUnread = 0,
  complaintsOpen = 0,
  moderationPending = 0,
  onDashboard,
  onUsers,
  onJobs,
  onComplaints,
  onModeration,
  onMessages,
  onNotifications,
  onSignOut,
}) {
  const displayName = displayNameFromUser(user);
  const lock = notificationsActive;

  return (
    <aside className="csb-sidebar app-sidebar app-sidebar--admin">
      <div className="csb-profile">
        <UserAvatar user={user} size={48} />
        <div>
          <h3>{displayName}</h3>
          <p>Administrator</p>
        </div>
      </div>

      <nav className="csb-links admin-csb-links" aria-label="Admin menu">
        <button
          type="button"
          className={`csb-link ${!lock && activeSection === "dashboard" ? "csb-link-active" : ""}`}
          onClick={onDashboard}
        >
          <AdminNavIcon icon={LayoutDashboard} />
          Dashboard
        </button>

        <button
          type="button"
          className={`csb-link ${!lock && activeSection === "users" ? "csb-link-active" : ""}`}
          onClick={onUsers}
        >
          <AdminNavIcon icon={Users} />
          Users
        </button>

        <button
          type="button"
          className={`csb-link ${!lock && activeSection === "jobs" ? "csb-link-active" : ""}`}
          onClick={onJobs}
        >
          <AdminNavIcon icon={BriefcaseBusiness} />
          Job Posts
        </button>

        <button
          type="button"
          className={`csb-link ${!lock && activeSection === "complaints" ? "csb-link-active" : ""}`}
          onClick={onComplaints}
        >
          <AdminNavIcon icon={Flag} />
          Complaints
          {complaintsOpen > 0 ? (
            <span className="csb-badge csb-badge--pill">{complaintsOpen}</span>
          ) : null}
        </button>

        {onModeration ? (
          <button
            type="button"
            className={`csb-link ${!lock && activeSection === "moderation" ? "csb-link-active" : ""}`}
            onClick={onModeration}
          >
            <AdminNavIcon icon={ShieldAlert} />
            Moderation
            {moderationPending > 0 ? (
              <span className="csb-badge csb-badge--pill csb-badge--accent">{moderationPending}</span>
            ) : null}
          </button>
        ) : null}

        {onMessages ? (
          <button
            type="button"
            className={`csb-link ${!lock && activeSection === "messages" ? "csb-link-active" : ""}`}
            onClick={onMessages}
          >
            <AdminNavIcon icon={Mail} />
            Messages
            {messagesUnread > 0 ? (
              <span className="csb-badge csb-badge--pill">{messagesUnread}</span>
            ) : null}
          </button>
        ) : null}

        <button
          type="button"
          className={`csb-link ${notificationsActive ? "csb-link-active" : ""}`}
          onClick={onNotifications}
        >
          <AdminNavIcon icon={Bell} />
          Notifications
          {notifUnread > 0 ? (
            <span className="csb-badge csb-badge--pill">{notifUnread}</span>
          ) : null}
        </button>

        <div className="admin-csb-spacer" aria-hidden />

        <button type="button" className="csb-link" onClick={onSignOut}>
          <AdminNavIcon icon={LogOut} />
          Sign Out
        </button>
      </nav>
    </aside>
  );
}
