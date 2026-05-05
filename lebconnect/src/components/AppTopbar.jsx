import { useEffect, useState } from "react";

import {
  Bell,
  Home,
  Mail,
  Search,
} from "lucide-react";

import UserAvatar from "./UserAvatar";
import ThemeToggle from "./ThemeToggle";
import { displayNameFromUser } from "../utils/avatar";
import { safeUiString } from "../utils/uiString";

const iconProps = {
  strokeWidth: 2,
};

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
  const inferred =
    user?.role === "company"
      ? "Company"
      : user?.role === "admin"
        ? "Administrator"
        : safeUiString(user?.specialization, "Candidate") || "Candidate";
  const sub = safeUiString(subtitle, "") || inferred;

  const [elevated, setElevated] = useState(false);

  useEffect(() => {
    const onScroll = () => setElevated(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`topbar ${elevated ? "topbar--elevated" : ""}`}>
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
          <Search className="top-search-svg" {...iconProps} size={18} aria-hidden />
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
          className="top-nav top-nav-item"
          role="button"
          tabIndex={0}
          onClick={onHomeClick}
          onKeyDown={(e) => e.key === "Enter" && onHomeClick()}
        >
          <span className="top-nav-svg">
            <Home {...iconProps} size={22} aria-hidden />
          </span>
          <p>Home</p>
        </div>

        {showMessaging ? (
          <div
            className="top-nav top-nav-item lc-msg-nav-active"
            role="button"
            tabIndex={0}
            onClick={onMessagesClick}
            onKeyDown={(e) => e.key === "Enter" && onMessagesClick?.()}
          >
            <span className="top-nav-svg">
              <Mail {...iconProps} size={22} aria-hidden />
            </span>
            <p>Messaging</p>
            {messagesUnread > 0 ? (
              <div className="notif-badge msg-top-badge">{messagesUnread}</div>
            ) : null}
          </div>
        ) : null}

        <div
          className="top-nav top-nav-item notif-nav"
          role="button"
          tabIndex={0}
          onClick={onNotificationsClick}
          onKeyDown={(e) => e.key === "Enter" && onNotificationsClick()}
        >
          <span className="top-nav-svg">
            <Bell {...iconProps} size={22} aria-hidden />
          </span>
          <p>Notifications</p>
          {notifUnread > 0 ? (
            <div className="notif-badge">{notifUnread}</div>
          ) : null}
        </div>

        <ThemeToggle />

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
