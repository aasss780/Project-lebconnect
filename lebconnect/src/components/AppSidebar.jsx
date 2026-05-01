import UserAvatar from "./UserAvatar";
import { displayNameFromUser } from "../utils/avatar";
import "./CandidateSidebar.css";

/**
 * Admin dashboard navigation — matches Candidate/Company sidebar chrome.
 *
 * @param {{
 *   user: object | null;
 *   activeSection: 'dashboard' | 'users' | 'jobs' | 'complaints' | 'messages';
 *   notificationsActive?: boolean;
 *   notifUnread?: number;
 *   messagesUnread?: number;
 *   onDashboard: () => void;
 *   onUsers: () => void;
 *   onJobs: () => void;
 *   onComplaints: () => void;
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
  onDashboard,
  onUsers,
  onJobs,
  onComplaints,
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
          <span className="csb-link-icon">⌘</span>
          Dashboard
        </button>

        <button
          type="button"
          className={`csb-link ${!lock && activeSection === "users" ? "csb-link-active" : ""}`}
          onClick={onUsers}
        >
          <span className="csb-link-icon">◌</span>
          Users
        </button>

        <button
          type="button"
          className={`csb-link ${!lock && activeSection === "jobs" ? "csb-link-active" : ""}`}
          onClick={onJobs}
        >
          <span className="csb-link-icon">💼</span>
          Job Posts
        </button>

        <button
          type="button"
          className={`csb-link ${!lock && activeSection === "complaints" ? "csb-link-active" : ""}`}
          onClick={onComplaints}
        >
          <span className="csb-link-icon">⚑</span>
          Complaints
        </button>

        {onMessages ? (
          <button
            type="button"
            className={`csb-link ${!lock && activeSection === "messages" ? "csb-link-active" : ""}`}
            onClick={onMessages}
          >
            <span className="csb-link-icon">✉</span>
            Messages
            {messagesUnread > 0 ? <span className="csb-badge">{messagesUnread}</span> : null}
          </button>
        ) : null}

        <button
          type="button"
          className={`csb-link ${notificationsActive ? "csb-link-active" : ""}`}
          onClick={onNotifications}
        >
          <span className="csb-link-icon">🔔</span>
          Notifications
          {notifUnread > 0 ? (
            <span className="csb-badge">{notifUnread}</span>
          ) : null}
        </button>

        <div className="admin-csb-spacer" aria-hidden />

        <button type="button" className="csb-link" onClick={onSignOut}>
          <span className="csb-link-icon">↲</span>
          Sign Out
        </button>
      </nav>
    </aside>
  );
}
