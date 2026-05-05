import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import RouteErrorBoundary from "./components/RouteErrorBoundary";
import { ToastProvider } from "./context/ToastContext";

import Home from "./pages/Home";
import ChooseRole from "./pages/ChooseRole";
import Register from "./pages/Register";
import CompanyRegister from "./pages/CompanyRegister";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CandidateDashboard from "./pages/CandidateDashboard";
import CompanyDashboard from "./pages/CompanyDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import AdminUserDetailPage from "./pages/AdminUserDetailPage";
import AdminJobDetailPage from "./pages/AdminJobDetailPage";
import ProfilePage from "./pages/ProfilePage";
import CandidateProfilePage from "./pages/CandidateProfilePage";
import NotificationsPage from "./pages/NotificationsPage";
import MessagesPage from "./pages/MessagesPage";

import "./global-polish.css";
import "./dark-mode-fixes.css";

function App() {
  return (
    <ToastProvider>
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/home" element={<Home />} />
        <Route path="/choose-role" element={<ChooseRole />} />
        <Route path="/register" element={<Register />} />
        <Route path="/company-register" element={<CompanyRegister />} />
        <Route path="/login" element={<Login />} />

        <Route
          path="/feed"
          element={
            <ProtectedRoute roles={["candidate", "company"]}>
              <RouteErrorBoundary>
                <Dashboard />
              </RouteErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute roles={["candidate", "company"]}>
              <RouteErrorBoundary>
                <Dashboard />
              </RouteErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/candidate-dashboard"
          element={
            <ProtectedRoute roles={["candidate"]}>
              <CandidateDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/company-dashboard"
          element={
            <ProtectedRoute roles={["company"]}>
              <CompanyDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard"
          element={
            <ProtectedRoute roles={["admin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users/:id"
          element={
            <ProtectedRoute roles={["admin"]}>
              <AdminUserDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/jobs/:id"
          element={
            <ProtectedRoute roles={["admin"]}>
              <AdminJobDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/messages"
          element={
            <ProtectedRoute roles={["admin"]}>
              <MessagesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <NotificationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/messages"
          element={
            <ProtectedRoute>
              <MessagesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/company-profile/:id"
          element={
            <ProtectedRoute>
              <RouteErrorBoundary title="My Profile could not load">
                <ProfilePage />
              </RouteErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/candidate-profile/:id"
          element={
            <ProtectedRoute>
              <RouteErrorBoundary title="My Profile could not load">
                <CandidateProfilePage />
              </RouteErrorBoundary>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
    </ToastProvider>
  );
}

export default App;
