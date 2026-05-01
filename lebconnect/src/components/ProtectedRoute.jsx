import { Navigate } from "react-router-dom";
import { dashboardPath, getRole, getToken } from "../utils/auth";

export default function ProtectedRoute({ children, roles }) {
  const token = getToken();
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (roles?.length) {
    const role = getRole();
    if (!roles.includes(role)) {
      return <Navigate to={dashboardPath(role)} replace />;
    }
  }

  return children;
}
