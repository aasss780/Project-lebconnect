import UserAvatar from "./UserAvatar";
import { displayNameFromUser } from "../utils/avatar";

/**
 * Shared dashboard header (candidate / company / admin).
 *
 * @param {{
 *   user: object | null;
 *   searchPlaceholder: string;
 *   searchValue: string;
 *   onSearchChange: (e: import('react').ChangeEvent<HTMLInputElement>) => void;
 *   onSearchKeyDown?: (e: import('react').KeyboardEvent<HTMLInputElement>) => void;
 *   notifUnread?: number;
 *   messagesUnread?: number;
 *   showMessaging?: boolean;
 *   onLogoClick: () => void;
 *   onHomeClick: () => void;
 *   onMessagesClick?: () => void;
 *   onNotificationsClick: () => void;
 *   subtitle?: string;
 * }} props
 */
export default function AppTopbar({
  user,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  onSearchKeyDown,
  notifUnread = 0,
  messagesUnread = 0,
  showMessaging = true,
  onLogoClick,
  onHomeClick,
  onMessagesClick,
  onNotificationsClick,
  subtitle,
}) {
  const displayName = displayNameFromUser(user);
  const sub =
    subtitle ??
    (user?.role === "company"
      ? "Company"
      : user?.role === "admin"
        ? "Administrator"
        : user?.specialization || "Candidate");

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div
          className="brand-mark"
          role="button"
          tabIndex={0}
          onClick={onLogoClick}
          onKeyDown={(e) => e.key === "Enter" && onLogoClick()}
        >
          <div className="brand-center"></div>
        </div>

        <div className="top-search">
          <span>⌕</span>
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={onSearchChange}
            onKeyDown={onSearchKeyDown}
            aria-label="Search"
          />
        </div>
      </div>

      <div className="topbar-right">
        <div
          className="top-nav"
          role="button"
          tabIndex={0}
          onClick={onHomeClick}
          onKeyDown={(e) => e.key === "Enter" && onHomeClick()}
        >
          <span>⌂</span>
          <p>Home</p>
        </div>

        {showMessaging ? (
          <div
            className="top-nav lc-msg-nav-active"
            role="button"
            tabIndex={0}
            onClick={onMessagesClick}
            onKeyDown={(e) => e.key === "Enter" && onMessagesClick?.()}
          >
            <span>✉</span>
            <p>Messaging</p>
            {messagesUnread > 0 ? (
              <div className="notif-badge msg-top-badge">{messagesUnread}</div>
            ) : null}
          </div>
        ) : null}

        <div
          className="top-nav notif-nav"
          role="button"
          tabIndex={0}
          onClick={onNotificationsClick}
          onKeyDown={(e) => e.key === "Enter" && onNotificationsClick()}
        >
          <span>🔔</span>
          <p>Notifications</p>
          {notifUnread > 0 ? (
            <div className="notif-badge">{notifUnread}</div>
          ) : null}
        </div>

        <div className="top-divider"></div>

        <div className="top-user">
          <UserAvatar user={user} size={40} />
          <div>
            <h4>{displayName}</h4>
            <p className="app-topbar-sub">{sub}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
