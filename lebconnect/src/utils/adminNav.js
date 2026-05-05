export const ADMIN_DASHBOARD_PATH = "/admin-dashboard";
export const ADMIN_MESSAGES_PATH = "/messages";
export const ADMIN_NOTIFICATIONS_PATH = "/notifications";

export const ADMIN_TABS = new Set([
  "dashboard",
  "users",
  "jobs",
  "complaints",
  "moderation",
]);

export function adminDashboardPathForTab(tab) {
  const safeTab = ADMIN_TABS.has(tab) ? tab : "dashboard";
  return safeTab === "dashboard"
    ? ADMIN_DASHBOARD_PATH
    : `${ADMIN_DASHBOARD_PATH}?tab=${encodeURIComponent(safeTab)}`;
}

