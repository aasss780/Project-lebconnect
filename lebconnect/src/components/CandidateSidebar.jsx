import { useNavigate } from "react-router-dom";
import UserAvatar from "./UserAvatar";
import { displayNameFromUser } from "../utils/avatar";
import "./CandidateSidebar.css";

/**
 * @typedef {"candidate" | "company"} SidebarVariant
 */

function CandidateSidebar({
  variant = "candidate",
  user,
  activeKey,
  notifUnread = 0,
  messagesUnread = 0,
  onDashboard,
  onFeed,
  onFindJobs,
  onApplications,
  onSavedJobs,
  /** Company: My Jobs tab / page */
  onMyJobs,
  /** Company: Applicants tab / page */
  onApplicants,
  onMessages,
  onNotifications,
  onMyProfile,
  /** Optional override; default opens /messages?admin=true (admin id resolved on Messages page). */
  onContactSupport,
  onSignOut,
}) {
  const navigate = useNavigate();
  const displayName = displayNameFromUser(user);
  const isCompany = variant === "company";
  const subtitle = isCompany
    ? user?.industry || "Company"
    : user?.specialization || user?.role || "Candidate";

  const handleContactSupport =
    onContactSupport ?? (() => navigate("/messages?admin=true"));

  return (
    <aside className="csb-sidebar">
      <div className="csb-profile">
        <UserAvatar user={user} size={48} />
        <div>
          <h3>{displayName}</h3>
          <p>{subtitle}</p>
        </div>
      </div>

      <div className="csb-sidebar-body">
        <nav className="csb-links-scroll" aria-label="Primary">
          {isCompany ? (
            <>
              <button
                type="button"
                className={`csb-link ${activeKey === "dashboard" ? "csb-link-active" : ""}`}
                onClick={onDashboard}
              >
                <span className="csb-link-icon">⌘</span>
                Dashboard
              </button>

              <button
                type="button"
                className={`csb-link ${activeKey === "feed" ? "csb-link-active" : ""}`}
                onClick={onFeed}
              >
                <span className="csb-link-icon">◫</span>
                Feed
              </button>

              <button
                type="button"
                className={`csb-link ${activeKey === "jobs" ? "csb-link-active" : ""}`}
                onClick={onMyJobs}
              >
                <span className="csb-link-icon">💼</span>
                My Jobs
              </button>

              <button
                type="button"
                className={`csb-link ${activeKey === "applicants" ? "csb-link-active" : ""}`}
                onClick={onApplicants}
              >
                <span className="csb-link-icon">☑</span>
                Applicants
              </button>

              <button
                type="button"
                className={`csb-link ${activeKey === "messages" ? "csb-link-active" : ""}`}
                onClick={() => onMessages?.()}
                disabled={!onMessages}
              >
                <span className="csb-link-icon">✉</span>
                Messages
                {messagesUnread > 0 ? (
                  <span className="csb-badge">{messagesUnread}</span>
                ) : null}
              </button>

              <button
                type="button"
                className={`csb-link ${activeKey === "notifications" ? "csb-link-active" : ""}`}
                onClick={onNotifications}
              >
                <span className="csb-link-icon">🔔</span>
                Notifications
                <span className="csb-badge">{notifUnread}</span>
              </button>

              <button
                type="button"
                className={`csb-link ${activeKey === "myProfile" ? "csb-link-active" : ""}`}
                onClick={onMyProfile}
              >
                <span className="csb-link-icon">◌</span>
                Company Profile
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={`csb-link ${activeKey === "dashboard" ? "csb-link-active" : ""}`}
                onClick={onDashboard}
              >
                <span className="csb-link-icon">⌘</span>
                Dashboard
              </button>

              <button
                type="button"
                className={`csb-link ${activeKey === "feed" ? "csb-link-active" : ""}`}
                onClick={onFeed}
              >
                <span className="csb-link-icon">◫</span>
                Feed
              </button>

              <button
                type="button"
                className={`csb-link ${activeKey === "findJobs" ? "csb-link-active" : ""}`}
                onClick={onFindJobs}
              >
                <span className="csb-link-icon">⌕</span>
                Find Jobs
              </button>

              <button
                type="button"
                className={`csb-link ${activeKey === "applications" ? "csb-link-active" : ""}`}
                onClick={onApplications}
              >
                <span className="csb-link-icon">☑</span>
                Applications
              </button>

              <button
                type="button"
                className={`csb-link ${activeKey === "savedJobs" ? "csb-link-active" : ""}`}
                onClick={onSavedJobs}
              >
                <span className="csb-link-icon">🔖</span>
                Saved Jobs
              </button>

              <button
                type="button"
                className={`csb-link ${activeKey === "messages" ? "csb-link-active" : ""}`}
                onClick={() => onMessages?.()}
                disabled={!onMessages}
              >
                <span className="csb-link-icon">✉</span>
                Messages
                {messagesUnread > 0 ? (
                  <span className="csb-badge">{messagesUnread}</span>
                ) : null}
              </button>

              <button
                type="button"
                className={`csb-link ${activeKey === "notifications" ? "csb-link-active" : ""}`}
                onClick={onNotifications}
              >
                <span className="csb-link-icon">🔔</span>
                Notifications
                <span className="csb-badge">{notifUnread}</span>
              </button>

              <button
                type="button"
                className={`csb-link ${activeKey === "myProfile" ? "csb-link-active" : ""}`}
                onClick={onMyProfile}
              >
                <span className="csb-link-icon">◌</span>
                My Profile
              </button>
            </>
          )}
        </nav>

        <div className="csb-sidebar-footer">
          <button
            type="button"
            className="csb-link csb-link-support"
            onClick={handleContactSupport}
          >
            <span className="csb-link-icon">💬</span>
            Contact Support
          </button>
          <button type="button" className="csb-link csb-link-signout" onClick={onSignOut}>
            <span className="csb-link-icon">↲</span>
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
}

export default CandidateSidebar;
