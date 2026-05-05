import { Navigate } from "react-router-dom";
import { dashboardPath, getUser, getToken } from "../utils/auth";

function normalizeRole(raw) {
  if (raw === null || raw === undefined) return "";
  const s =
    typeof raw === "string" || typeof raw === "number"
      ? String(raw)
      : "";
  return s.trim().toLowerCase();
}

export default function ProtectedRoute({ children, roles }) {
  const token = getToken();
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const rawUser = getUser();
  if (!rawUser || typeof rawUser !== "object") {
    return <Navigate to="/login" replace />;
  }

  if (!roles?.length) {
    return <>{children}</>;
  }

  const rawRole = rawUser.role;
  if (
    rawRole === null ||
    rawRole === undefined ||
    (typeof rawRole !== "string" && typeof rawRole !== "number")
  ) {
    return <Navigate to="/login" replace />;
  }

  const role = normalizeRole(rawRole);
  const allowed = roles.map((r) => normalizeRole(r));
  if (!allowed.includes(role)) {
    return <Navigate to={dashboardPath(rawRole)} replace />;
  }

  return <>{children}</>;
}
