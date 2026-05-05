import { createElement } from "react";
import { useNavigate } from "react-router-dom";

import UserAvatar from "./UserAvatar";

import {
  Bell,
  Heart,
  BriefcaseBusiness,
  ClipboardCheck,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Mail,
  Newspaper,
  Search,
  UserRound,
  Building2,
} from "lucide-react";

import { displayNameFromUser } from "../utils/avatar";
import { safeUiString } from "../utils/uiString";
import "./CandidateSidebar.css";

const IC = {
  strokeWidth: 2,
  size: 20,
};

function CsbNavIcon({ icon }) {
  return (
    <span className="csb-link-icon">{createElement(icon, IC)}</span>
  );
}

/**
 * @typedef {"candidate" | "company"} SidebarVariant
 */

function CandidateSidebar({
  variant = "candidate",
  user,
  activeKey,
  notifUnread = 0,
  messagesUnread = 0,
  /** Candidate: unread application / interview notifications only */
  applicationsUnread = 0,
  /** Company: applications with decision still pending (badge on Applicants) */
  pendingApplicantsCount = 0,
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
    ? safeUiString(user?.industry, "Company") || "Company"
    : safeUiString(user?.specialization, "") ||
      safeUiString(user?.role, "Candidate") ||
      "Candidate";

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
                <CsbNavIcon icon={LayoutDashboard} />
                Dashboard
              </button>

              <button
                type="button"
                className={`csb-link ${activeKey === "feed" ? "csb-link-active" : ""}`}
                onClick={onFeed}
              >
                <CsbNavIcon icon={Newspaper} />
                Feed
              </button>

              <button
                type="button"
                className={`csb-link ${activeKey === "jobs" ? "csb-link-active" : ""}`}
                onClick={onMyJobs}
              >
                <CsbNavIcon icon={BriefcaseBusiness} />
                My Jobs
              </button>

              <button
                type="button"
                className={`csb-link ${activeKey === "applicants" ? "csb-link-active" : ""}`}
                onClick={onApplicants}
              >
                <CsbNavIcon icon={ClipboardCheck} />
                Applicants
                {pendingApplicantsCount > 0 ? (
                  <span className="csb-badge csb-badge--pill">{pendingApplicantsCount}</span>
                ) : null}
              </button>

              <button
                type="button"
                className={`csb-link ${activeKey === "messages" ? "csb-link-active" : ""}`}
                onClick={() => onMessages?.()}
                disabled={!onMessages}
              >
                <CsbNavIcon icon={Mail} />
                Messages
                {messagesUnread > 0 ? (
                  <span className="csb-badge csb-badge--pill">{messagesUnread}</span>
                ) : null}
              </button>

              <button
                type="button"
                className={`csb-link ${activeKey === "notifications" ? "csb-link-active" : ""}`}
                onClick={onNotifications}
              >
                <CsbNavIcon icon={Bell} />
                Notifications
                {notifUnread > 0 ? (
                  <span className="csb-badge csb-badge--pill">{notifUnread}</span>
                ) : null}
              </button>

              <button
                type="button"
                className={`csb-link ${activeKey === "myProfile" ? "csb-link-active" : ""}`}
                onClick={onMyProfile}
              >
                <CsbNavIcon icon={Building2} />
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
                <CsbNavIcon icon={LayoutDashboard} />
                Dashboard
              </button>

              <button
                type="button"
                className={`csb-link ${activeKey === "feed" ? "csb-link-active" : ""}`}
                onClick={onFeed}
              >
                <CsbNavIcon icon={Newspaper} />
                Feed
              </button>

              <button
                type="button"
                className={`csb-link ${activeKey === "findJobs" ? "csb-link-active" : ""}`}
                onClick={onFindJobs}
              >
                <CsbNavIcon icon={Search} />
                Find Jobs
              </button>

              <button
                type="button"
                className={`csb-link ${activeKey === "applications" ? "csb-link-active" : ""}`}
                onClick={onApplications}
              >
                <CsbNavIcon icon={ClipboardCheck} />
                Applications
                {applicationsUnread > 0 ? (
                  <span className="csb-badge csb-badge--pill csb-badge--accent">
                    {applicationsUnread}
                  </span>
                ) : null}
              </button>

              <button
                type="button"
                className={`csb-link ${activeKey === "savedJobs" ? "csb-link-active" : ""}`}
                onClick={onSavedJobs}
              >
                <span
                  className={`csb-link-icon csb-heart-wrap ${activeKey === "savedJobs" ? "csb-heart-wrap--filled" : ""}`}
                  aria-hidden
                >
                  <Heart
                    size={20}
                    strokeWidth={2}
                    fill={activeKey === "savedJobs" ? "currentColor" : "none"}
                  />
                </span>
                Saved Jobs
              </button>

              <button
                type="button"
                className={`csb-link ${activeKey === "messages" ? "csb-link-active" : ""}`}
                onClick={() => onMessages?.()}
                disabled={!onMessages}
              >
                <CsbNavIcon icon={Mail} />
                Messages
                {messagesUnread > 0 ? (
                  <span className="csb-badge csb-badge--pill">{messagesUnread}</span>
                ) : null}
              </button>

              <button
                type="button"
                className={`csb-link ${activeKey === "notifications" ? "csb-link-active" : ""}`}
                onClick={onNotifications}
              >
                <CsbNavIcon icon={Bell} />
                Notifications
                {notifUnread > 0 ? (
                  <span className="csb-badge csb-badge--pill">{notifUnread}</span>
                ) : null}
              </button>

              <button
                type="button"
                className={`csb-link ${activeKey === "myProfile" ? "csb-link-active" : ""}`}
                onClick={onMyProfile}
              >
                <CsbNavIcon icon={UserRound} />
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
            <CsbNavIcon icon={LifeBuoy} />
            Contact Support
          </button>
          <button type="button" className="csb-link csb-link-signout" onClick={onSignOut}>
            <CsbNavIcon icon={LogOut} />
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
}

export default CandidateSidebar;
