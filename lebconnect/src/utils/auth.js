const TOKEN_KEY = "token";
const USER_KEY = "user";

const AUTH_EVENT = "lebconnect-auth-changed";

export function broadcastAuthChanged() {
  try {
    window.dispatchEvent(new Event(AUTH_EVENT));
  } catch {
    /* non-browser */
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  broadcastAuthChanged();
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  broadcastAuthChanged();
}

export function isLoggedIn() {
  return Boolean(getToken());
}

export function getRole() {
  const u = getUser();
  return u?.role || null;
}

/** Default app landing after login by role. */
export function dashboardPath(role) {
  if (role === "candidate") return "/candidate-dashboard";
  if (role === "company") return "/company-dashboard";
  if (role === "admin") return "/admin-dashboard";
  return "/dashboard";
}
