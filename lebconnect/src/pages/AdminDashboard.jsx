import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import AppTopbar from "../components/AppTopbar";
import AppSidebar from "../components/AppSidebar";
import Modal from "../components/Modal";
import UserAvatar from "../components/UserAvatar";
import {
  Activity,
  ArrowRight,
  BriefcaseBusiness,
  Eye,
  Flag,
  Loader2,
  Mail,
  MessageSquare,
  Search,
  Shield,
  ShieldCheck,
  Star,
  Trash2,
  Users,
  Wrench,
} from "lucide-react";
import { formatRelativeTime, initialsFromName } from "../utils/format";
import { getUser, logout } from "../utils/auth";
import {
  ADMIN_DASHBOARD_PATH,
  ADMIN_MESSAGES_PATH,
  ADMIN_NOTIFICATIONS_PATH,
  ADMIN_TABS,
  adminDashboardPathForTab,
} from "../utils/adminNav";
import { motion } from "framer-motion";

import { lcMotionPage } from "../utils/motionProps";
import "./Dashboard.css";
import "./CandidateDashboard.css";
import "./AdminDashboard.css";

function displayUserName(u) {
  if (!u) return "";
  return (
    u.fullName ||
    u.full_name ||
    u.companyName ||
    u.company_name ||
    u.email ||
    "User"
  );
}

function roleLabel(role) {
  const r = String(role || "candidate").toLowerCase();
  return r.charAt(0).toUpperCase() + r.slice(1);
}

function complaintStatusClass(status) {
  const s = String(status || "").toLowerCase();
  if (s === "resolved") return "adm-chip adm-chip--resolved";
  if (s === "reviewing") return "adm-chip adm-chip--reviewing";
  return "adm-chip adm-chip--open";
}

/** @param {unknown} complaint */
function complaintAgeBadge(complaint) {
  const raw = complaint?.createdAt;
  const t = raw ? new Date(raw).getTime() : NaN;
  if (!Number.isFinite(t)) return null;
  const days = (Date.now() - t) / (86400 * 1000);
  if (days < 7) return null;
  return (
    <span className="adm-chip adm-chip--aging" title="Open longer than 7 days">
      Aging
    </span>
  );
}

function formatActivityDateTime(value) {
  const t = value ? new Date(value).getTime() : NaN;
  if (!Number.isFinite(t)) return "—";
  return new Date(t).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function jobRequirementsText(job) {
  const r = job?.requirements;
  if (Array.isArray(r)) return r.filter(Boolean).join("\n");
  if (typeof r === "string") {
    try {
      const j = JSON.parse(r);
      if (Array.isArray(j)) return j.filter(Boolean).join("\n");
    } catch {
      /* plain */
    }
    return r;
  }
  return "—";
}

export default function AdminDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const me = getUser();

  const activeTab = useMemo(() => {
    const raw = searchParams.get("tab");
    if (!raw) return "dashboard";
    return ADMIN_TABS.has(raw) ? raw : "dashboard";
  }, [searchParams]);

  const setActiveTab = useCallback(
    (t) => {
      const tab = ADMIN_TABS.has(t) ? t : "dashboard";
      if (tab === "dashboard") {
        setSearchParams({}, { replace: true });
      } else {
        setSearchParams({ tab }, { replace: true });
      }
    },
    [setSearchParams]
  );

  useEffect(() => {
    const stateTab = location.state?.tab;
    if (!ADMIN_TABS.has(stateTab)) return;
    const queryTab = searchParams.get("tab") || "dashboard";
    if (queryTab === stateTab) return;
    setActiveTab(stateTab);
  }, [location.state, searchParams, setActiveTab]);

  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState(false);
  const [users, setUsers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [usersLoadError, setUsersLoadError] = useState(false);
  const [jobsLoadError, setJobsLoadError] = useState(false);
  const [complaintsLoadError, setComplaintsLoadError] = useState(false);
  const [notifUnread, setNotifUnread] = useState(0);
  const [topSearch, setTopSearch] = useState("");
  const [messagesUnread, setMessagesUnread] = useState(0);
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [jobsStatusFilter, setJobsStatusFilter] = useState("all");
  const [complaintTab, setComplaintTab] = useState("open");
  const [deleteUserTarget, setDeleteUserTarget] = useState(null);
  const [deleteJobTarget, setDeleteJobTarget] = useState(null);
  const [jobDetailModal, setJobDetailModal] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [pageBanner, setPageBanner] = useState(null);
  const [reports, setReports] = useState([]);
  const [reportsLoadError, setReportsLoadError] = useState(false);
  const [companyReviewsMod, setCompanyReviewsMod] = useState([]);
  const [companyReviewsLoadError, setCompanyReviewsLoadError] = useState(false);
  const [siteReviewsMod, setSiteReviewsMod] = useState([]);
  const [siteReviewsLoadError, setSiteReviewsLoadError] = useState(false);
  const [modSubTab, setModSubTab] = useState("reports");
  const [modReportFilter, setModReportFilter] = useState("open");
  const [moderationBadgeSeed, setModerationBadgeSeed] = useState(0);
  const [deleteSiteReviewTarget, setDeleteSiteReviewTarget] = useState(null);
  const [activityModalOpen, setActivityModalOpen] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const { data } = await api.get("/api/admin/stats");
      setStats(data);
      setStatsError(false);
    } catch {
      setStats(null);
      setStatsError(true);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const { data } = await api.get("/api/admin/users");
      setUsers(Array.isArray(data) ? data : []);
      setUsersLoadError(false);
    } catch {
      setUsers([]);
      setUsersLoadError(true);
    }
  }, []);

  const loadJobs = useCallback(async () => {
    try {
      const { data } = await api.get("/api/admin/jobs");
      setJobs(Array.isArray(data) ? data : []);
      setJobsLoadError(false);
    } catch {
      setJobs([]);
      setJobsLoadError(true);
    }
  }, []);

  const loadComplaints = useCallback(async () => {
    try {
      const { data } = await api.get("/api/admin/complaints");
      setComplaints(Array.isArray(data) ? data : []);
      setComplaintsLoadError(false);
    } catch {
      setComplaints([]);
      setComplaintsLoadError(true);
    }
  }, []);

  const loadReports = useCallback(async () => {
    try {
      const { data } = await api.get("/api/admin/reports");
      setReports(Array.isArray(data) ? data : []);
      setReportsLoadError(false);
    } catch {
      setReports([]);
      setReportsLoadError(true);
    }
  }, []);

  const loadCompanyReviewsMod = useCallback(async () => {
    try {
      const { data } = await api.get("/api/admin/company-reviews");
      setCompanyReviewsMod(Array.isArray(data) ? data : []);
      setCompanyReviewsLoadError(false);
    } catch {
      setCompanyReviewsMod([]);
      setCompanyReviewsLoadError(true);
    }
  }, []);

  const loadSiteReviewsMod = useCallback(async () => {
    try {
      const { data } = await api.get("/api/admin/site-reviews");
      setSiteReviewsMod(Array.isArray(data) ? data : []);
      setSiteReviewsLoadError(false);
    } catch {
      setSiteReviewsMod([]);
      setSiteReviewsLoadError(true);
    }
  }, []);

  const refreshAdminInbox = useCallback(async () => {
    try {
      const { data } = await api.get("/api/notifications");
      const list = Array.isArray(data) ? data : [];
      setNotifUnread(list.filter((n) => !n.isRead).length);
    } catch {
      setNotifUnread(0);
    }
    try {
      const { data } = await api.get("/api/admin/stats");
      setStats(data);
      setStatsError(false);
    } catch {
      setStats(null);
      setStatsError(true);
    }
    try {
      const { data } = await api.get("/api/messages/conversations");
      const list = Array.isArray(data) ? data : [];
      setMessagesUnread(
        list.reduce((acc, row) => acc + Number(row.unread || 0), 0)
      );
    } catch {
      setMessagesUnread(0);
    }
  }, []);

  useEffect(() => {
    void refreshAdminInbox();
  }, [refreshAdminInbox]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void refreshAdminInbox();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refreshAdminInbox]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [repRes, revRes] = await Promise.all([
          api.get("/api/admin/reports"),
          api.get("/api/admin/company-reviews"),
        ]);
        if (cancelled) return;
        let n = 0;
        const repList = Array.isArray(repRes.data) ? repRes.data : [];
        const revList = Array.isArray(revRes.data) ? revRes.data : [];
        for (const r of repList) {
          const s = String(r.status || "").toLowerCase();
          if (s === "open" || s === "pending") n++;
        }
        for (const r of revList) {
          const s = String(r.status || "").toLowerCase();
          if (s === "pending" || s === "open") n++;
        }
        setModerationBadgeSeed(n);
      } catch {
        if (!cancelled) setModerationBadgeSeed(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void (async () => {
      switch (activeTab) {
        case "dashboard":
          await Promise.all([loadStats(), loadUsers(), loadComplaints()]);
          break;
        case "users":
          await loadUsers();
          break;
        case "jobs":
          await loadJobs();
          break;
        case "complaints":
          await loadComplaints();
          break;
        case "moderation":
          await Promise.all([loadReports(), loadCompanyReviewsMod(), loadSiteReviewsMod()]);
          break;
        default:
          break;
      }
    })();
  }, [
    activeTab,
    loadStats,
    loadUsers,
    loadJobs,
    loadComplaints,
    loadReports,
    loadCompanyReviewsMod,
    loadSiteReviewsMod,
  ]);

  const showBanner = useCallback((kind, text) => {
    setPageBanner({ kind, text });
    setTimeout(() => setPageBanner(null), 4200);
  }, []);

  const confirmDeleteUser = async () => {
    const uid = deleteUserTarget?.uid;
    if (uid == null) return;
    setActionBusy(true);
    try {
      await api.delete(`/api/admin/users/${uid}`);
      setDeleteUserTarget(null);
      showBanner("ok", "User removed.");
      await loadUsers();
      await loadStats();
    } catch (e) {
      showBanner(
        "err",
        e.response?.data?.message || e.message || "Could not delete user"
      );
    } finally {
      setActionBusy(false);
    }
  };

  const confirmDeleteJob = async () => {
    const jid = deleteJobTarget?.jid;
    if (jid == null) return;
    setActionBusy(true);
    try {
      await api.delete(`/api/admin/jobs/${jid}`);
      setDeleteJobTarget(null);
      setJobDetailModal((j) =>
        j && Number(j.id ?? j._id) === Number(jid) ? null : j
      );
      showBanner("ok", "Job deleted.");
      await loadJobs();
      await loadStats();
    } catch (e) {
      showBanner(
        "err",
        e.response?.data?.message || e.message || "Could not delete job"
      );
    } finally {
      setActionBusy(false);
    }
  };

  const handleCloseJobInline = async (jid) => {
    if (jid == null) return;
    setActionBusy(true);
    try {
      await api.put(`/api/admin/jobs/${jid}/close`);
      showBanner("ok", "Job closed.");
      await loadJobs();
      await loadStats();
      setJobDetailModal((j) =>
        j && Number(j.id ?? j._id) === Number(jid)
          ? { ...j, status: "closed" }
          : j
      );
    } catch (e) {
      showBanner(
        "err",
        e.response?.data?.message || e.message || "Could not close job"
      );
    } finally {
      setActionBusy(false);
    }
  };

  const handleComplaintStatus = async (cid, status) => {
    if (cid == null) return;
    try {
      await api.put(`/api/admin/complaints/${cid}/status`, { status });
      await loadComplaints();
      await loadStats();
    } catch (e) {
      showBanner(
        "err",
        e.response?.data?.message || e.message || "Could not update complaint"
      );
    }
  };

  const handleReportStatusAdmin = async (rid, status) => {
    if (rid == null) return;
    try {
      await api.put(`/api/admin/reports/${rid}/status`, { status });
      showBanner("ok", "Report updated.");
      await loadReports();
    } catch (e) {
      showBanner(
        "err",
        e.response?.data?.message || e.message || "Could not update report"
      );
    }
  };

  const handleCompanyReviewModeration = async (rid, status) => {
    if (rid == null) return;
    try {
      await api.put(`/api/admin/company-reviews/${rid}/status`, { status });
      showBanner("ok", "Review status saved.");
      await loadCompanyReviewsMod();
    } catch (e) {
      showBanner(
        "err",
        e.response?.data?.message || e.message || "Could not update review"
      );
    }
  };

  const confirmDeleteSiteReview = async () => {
    const rid = Number(deleteSiteReviewTarget?.id);
    if (!Number.isFinite(rid)) return;
    setActionBusy(true);
    try {
      await api.delete(`/api/admin/site-reviews/${rid}`);
      setSiteReviewsMod((prev) => prev.filter((r) => Number(r.id) !== rid));
      setDeleteSiteReviewTarget(null);
      showBanner("ok", "Site review deleted.");
    } catch (e) {
      showBanner(
        "err",
        e.response?.data?.message || e.message || "Could not delete site review"
      );
    } finally {
      setActionBusy(false);
    }
  };

  const handleVerifyCompanyUser = async (uid) => {
    if (!Number.isFinite(Number(uid))) return;
    try {
      await api.put(`/api/admin/users/${uid}/verify`);
      showBanner("ok", "User verified.");
      await loadUsers();
    } catch (e) {
      showBanner(
        "err",
        e.response?.data?.message || e.message || "Verify failed"
      );
    }
  };

  const handleUnverifyCompanyUser = async (uid) => {
    if (!Number.isFinite(Number(uid))) return;
    try {
      await api.put(`/api/admin/users/${uid}/unverify`);
      showBanner("ok", "Verification removed.");
      await loadUsers();
    } catch (e) {
      showBanner(
        "err",
        e.response?.data?.message || e.message || "Could not remove verification"
      );
    }
  };

  const signOut = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const goAdminHome = () => navigate(ADMIN_DASHBOARD_PATH);

  const searchPlaceholder = useMemo(() => {
    switch (activeTab) {
      case "users":
        return "Search users by name or email…";
      case "jobs":
        return "Search jobs, company, location…";
      case "complaints":
        return "Search complaints…";
      case "moderation":
        return "Search reports & reviews…";
      default:
        return "Search registrations and activity…";
    }
  }, [activeTab]);

  const q = topSearch.trim().toLowerCase();

  const filteredUsers = useMemo(() => {
    let list = users;
    if (userRoleFilter !== "all") {
      list = list.filter(
        (u) => String(u.role || "").toLowerCase() === userRoleFilter
      );
    }
    if (!q || activeTab !== "users") return list;
    return list.filter((u) => {
      const name = displayUserName(u).toLowerCase();
      const email = String(u.email || "").toLowerCase();
      const role = String(u.role || "").toLowerCase();
      return name.includes(q) || email.includes(q) || role.includes(q);
    });
  }, [users, q, activeTab, userRoleFilter]);

  const filteredJobsBase = useMemo(() => {
    let list = jobs;
    if (jobsStatusFilter === "active") {
      list = list.filter((j) => String(j.status || "active").toLowerCase() === "active");
    } else if (jobsStatusFilter === "closed") {
      list = list.filter((j) => String(j.status || "").toLowerCase() === "closed");
    }
    if (!q || activeTab !== "jobs") return list;
    return list.filter((j) => {
      const title = String(j.title || "").toLowerCase();
      const loc = String(j.location || "").toLowerCase();
      const comp = String(
        j.company?.companyName || j.company?.company_name || j.companyName || ""
      ).toLowerCase();
      const st = String(j.status || "").toLowerCase();
      return (
        title.includes(q) || loc.includes(q) || comp.includes(q) || st.includes(q)
      );
    });
  }, [jobs, q, activeTab, jobsStatusFilter]);

  const filteredComplaints = useMemo(() => {
    let list = complaints;
    if (complaintTab !== "all") {
      list = list.filter(
        (c) => String(c.status || "").toLowerCase() === complaintTab
      );
    }
    if (!q || activeTab !== "complaints") return list;
    return list.filter((c) => {
      const title = String(c.title || "").toLowerCase();
      const body = String(c.description || "").toLowerCase();
      const fromN = displayUserName(c.user).toLowerCase();
      const agN = c.against ? displayUserName(c.against).toLowerCase() : "";
      const st = String(c.status || "").toLowerCase();
      return (
        title.includes(q) ||
        body.includes(q) ||
        fromN.includes(q) ||
        agN.includes(q) ||
        st.includes(q)
      );
    });
  }, [complaints, q, activeTab, complaintTab]);

  const filteredReports = useMemo(() => {
    let list = reports;
    if (modReportFilter !== "all") {
      list = list.filter(
        (r) => String(r.status || "").toLowerCase() === modReportFilter
      );
    }
    if (!q || activeTab !== "moderation" || modSubTab !== "reports")
      return list;
    return list.filter((r) => {
      const reason = String(r.reason || "").toLowerCase();
      const tt = String(r.targetType || "").toLowerCase();
      const tid = String(r.targetId ?? "");
      const rep = `${r.reporter?.fullName || ""} ${r.reporter?.companyName || ""} ${r.reporter?.email || ""}`.toLowerCase();
      return (
        reason.includes(q) || tt.includes(q) || tid.includes(q) || rep.includes(q)
      );
    });
  }, [reports, q, activeTab, modSubTab, modReportFilter]);

  const filteredCompanyReviewsModeration = useMemo(() => {
    let list = companyReviewsMod;
    if (!q || activeTab !== "moderation" || modSubTab !== "reviews") return list;
    return list.filter((r) => {
      const blob =
        `${r.title || ""} ${r.comment || ""} ${r.companyName || ""} ${r.authorName || ""} ${r.status || ""}`.toLowerCase();
      return blob.includes(q);
    });
  }, [companyReviewsMod, q, activeTab, modSubTab]);

  const filteredSiteReviewsModeration = useMemo(() => {
    let list = siteReviewsMod;
    if (!q || activeTab !== "moderation" || modSubTab !== "site-reviews") return list;
    return list.filter((r) => {
      const blob = `${r.name || ""} ${r.comment || ""} ${r.rating || ""}`.toLowerCase();
      return blob.includes(q);
    });
  }, [siteReviewsMod, q, activeTab, modSubTab]);

  const complaintCounts = useMemo(() => {
    let open = 0;
    let reviewing = 0;
    let resolved = 0;
    for (const c of complaints) {
      const s = String(c.status || "").toLowerCase();
      if (s === "open") open++;
      else if (s === "reviewing") reviewing++;
      else if (s === "resolved") resolved++;
    }
    return { open, reviewing, resolved, all: complaints.length };
  }, [complaints]);

  const recentRegs = useMemo(() => {
    const slice = users.slice(0, 10);
    if (!q || activeTab !== "dashboard") return slice;
    return slice.filter((u) => {
      const name = displayUserName(u).toLowerCase();
      const email = String(u.email || "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [users, q, activeTab]);

  const activityTimeline = useMemo(() => {
    const rows = [];
    for (const u of users.slice(0, 14)) {
      const createdAt = u.createdAt || u.created_at || null;
      const ts = new Date(createdAt || 0).getTime();
      rows.push({
        id: `u-${u.id ?? u._id}`,
        ts,
        kind: "signup",
        title: `${displayUserName(u)} joined`,
        sub: `${roleLabel(u.role)} · ${formatRelativeTime(createdAt) || "—"}`,
      });
    }
    for (const c of complaints.slice(0, 12)) {
      const createdAt = c.createdAt || null;
      const ts = new Date(createdAt || 0).getTime();
      rows.push({
        id: `c-${c._id ?? c.id}`,
        ts,
        kind: "complaint",
        title: c.title || "Complaint filed",
        sub: `From ${displayUserName(c.user)} · ${formatRelativeTime(createdAt) || "—"}`,
      });
    }
    return rows
      .filter((r) => Number.isFinite(r.ts) && r.ts > 0)
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 30);
  }, [users, complaints]);

  const activityPreview = useMemo(() => activityTimeline.slice(0, 3), [activityTimeline]);

  const openComplaintsQueue = useMemo(
    () => complaints.filter((c) => String(c.status || "").toLowerCase() === "open"),
    [complaints]
  );

  const moderationPendingCount = useMemo(() => {
    let n = 0;
    for (const r of reports) {
      const s = String(r.status || "").toLowerCase();
      if (s === "open" || s === "pending") n++;
    }
    for (const r of companyReviewsMod) {
      const s = String(r.status || "").toLowerCase();
      if (s === "pending" || s === "open") n++;
    }
    return n;
  }, [reports, companyReviewsMod]);

  const moderationSidebarBadge = useMemo(() => {
    if (reports.length > 0 || companyReviewsMod.length > 0) return moderationPendingCount;
    return moderationBadgeSeed;
  }, [
    companyReviewsMod.length,
    moderationBadgeSeed,
    moderationPendingCount,
    reports.length,
  ]);

  const complaintsOpenSidebarBadge = useMemo(() => {
    if (!complaintsLoadError && complaints.length > 0) return openComplaintsQueue.length;
    if (stats && !statsError && Number.isFinite(Number(stats.complaintsOpen))) {
      return Number(stats.complaintsOpen);
    }
    return 0;
  }, [
    complaints.length,
    complaintsLoadError,
    openComplaintsQueue.length,
    stats,
    statsError,
  ]);

  /** Count for Platform Health open-complaints row: live queue when feed loads; else stats fallback. */
  const healthOpenComplaintsCount = useMemo(() => {
    if (!complaintsLoadError) return openComplaintsQueue.length;
    if (stats && !statsError && Number.isFinite(Number(stats.complaintsOpen))) {
      return Number(stats.complaintsOpen);
    }
    return null;
  }, [complaintsLoadError, openComplaintsQueue.length, stats, statsError]);

  const healthOpenComplaintsBadge = useMemo(() => {
    if (healthOpenComplaintsCount === null) {
      return { text: "—", className: "adm-health-badge adm-health-badge--muted" };
    }
    const n = healthOpenComplaintsCount;
    if (n <= 0) return { text: String(n), className: "adm-health-badge adm-health-badge--ok" };
    if (n <= 5) return { text: String(n), className: "adm-health-badge adm-health-badge--warn" };
    return { text: String(n), className: "adm-health-badge adm-health-badge--bad" };
  }, [healthOpenComplaintsCount]);

  const totalUsersMetric =
    stats && !statsError
      ? stats.totalUsers ??
        stats.candidates + stats.companies + (stats.admins || 0)
      : null;

  const handleTopSearchKeyDown = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
  };

  const companyNameFromJob = (j) =>
    j?.company?.companyName || j?.company?.company_name || j?.companyName || "Company";

  const renderDashboard = () => (
    <div className="adm-stack">
      {pageBanner?.text ? (
        <div
          className={`adm-page-banner feed-notice ${
            pageBanner.kind === "ok" ? "feed-notice--ok" : "feed-notice--err"
          }`}
          role="status"
        >
          {pageBanner.text}
        </div>
      ) : null}

      <div className="adm-page-head adm-page-head--hero">
        <div>
          <h1>Control center</h1>
          <p className="adm-page-sub">
            Platform overview and moderation entry points
            {statsError ? (
              <span className="adm-inline-warn"> · Stats API unavailable</span>
            ) : null}
          </p>
        </div>
        <div className="adm-quick-row">
          <button type="button" className="adm-pill-btn" onClick={() => setActiveTab("users")}>
            <Users size={17} strokeWidth={2} aria-hidden /> Users
          </button>
          <button type="button" className="adm-pill-btn" onClick={() => setActiveTab("jobs")}>
            <BriefcaseBusiness size={17} strokeWidth={2} aria-hidden /> Jobs
          </button>
          <button type="button" className="adm-pill-btn" onClick={() => setActiveTab("complaints")}>
            <Flag size={17} strokeWidth={2} aria-hidden /> Complaints
          </button>
          <button type="button" className="adm-pill-btn" onClick={() => setActiveTab("moderation")}>
            <Shield size={17} strokeWidth={2} aria-hidden /> Moderation
          </button>
          <button
            type="button"
            className="adm-pill-btn adm-pill-btn--primary"
            onClick={() => navigate(ADMIN_MESSAGES_PATH)}
          >
            <MessageSquare size={17} strokeWidth={2} aria-hidden /> Messages
          </button>
        </div>
      </div>

      <div className="adm-stat-grid adm-stat-grid--wide">
        <div className="adm-stat-card adm-stat-card--accent">
          <p className="adm-stat-label">Total users</p>
          <p className="adm-stat-value">
            {stats == null && !statsError ? "…" : totalUsersMetric ?? "—"}
          </p>
          <p className="adm-stat-hint">All roles in database</p>
        </div>
        <div className="adm-stat-card">
          <p className="adm-stat-label">Candidates</p>
          <p className="adm-stat-value">{stats && !statsError ? stats.candidates : "—"}</p>
        </div>
        <div className="adm-stat-card">
          <p className="adm-stat-label">Companies</p>
          <p className="adm-stat-value">{stats && !statsError ? stats.companies : "—"}</p>
        </div>
        <div className="adm-stat-card">
          <p className="adm-stat-label">Admins</p>
          <p className="adm-stat-value">{stats && !statsError ? stats.admins ?? "—" : "—"}</p>
          <p className="adm-stat-hint">Protected accounts</p>
        </div>
        <div className="adm-stat-card">
          <p className="adm-stat-label">Jobs</p>
          <p className="adm-stat-value">{stats && !statsError ? stats.jobs : "—"}</p>
          <p className="adm-stat-hint">
            Active: {stats && !statsError ? stats.activeJobs : "—"}
          </p>
        </div>
        <div className="adm-stat-card">
          <p className="adm-stat-label">Applications</p>
          <p className="adm-stat-value">{stats && !statsError ? stats.applications : "—"}</p>
        </div>
        <div className="adm-stat-card">
          <p className="adm-stat-label">Complaints (open)</p>
          <p className="adm-stat-value">{stats && !statsError ? stats.complaintsOpen : "—"}</p>
          <p className="adm-stat-hint">
            Total: {stats && !statsError ? stats.complaintsTotal ?? "—" : "—"}
          </p>
        </div>
        <div className="adm-stat-card">
          <p className="adm-stat-label">Feed posts</p>
          <p className="adm-stat-value">{stats && !statsError ? stats.posts ?? "—" : "—"}</p>
          <p className="adm-stat-hint">Rows in posts table</p>
        </div>
      </div>

      <div className="adm-dash-grid">
        <div className="adm-card adm-card--pane">
          <div className="adm-card-head">
            <h2>
              <Activity size={18} strokeWidth={2} className="adm-card-head-ic" aria-hidden />
              Recent activity
            </h2>
            {activityTimeline.length > 3 ? (
              <button
                type="button"
                className="adm-btn adm-btn--ghost adm-btn--sm"
                onClick={() => setActivityModalOpen(true)}
              >
                View all
              </button>
            ) : null}
          </div>
          {usersLoadError || complaintsLoadError ? (
            <p className="adm-empty">Some activity data could not load.</p>
          ) : activityTimeline.length === 0 ? (
            <p className="adm-empty">No recent events yet.</p>
          ) : (
            <ul className="adm-timeline">
              {activityPreview.map((row) => (
                <li key={row.id} className="adm-timeline-item">
                  <span
                    className={`adm-timeline-dot adm-timeline-dot--${row.kind}`}
                    aria-hidden
                  />
                  <div>
                    <p className="adm-timeline-title">{row.title}</p>
                    <p className="adm-timeline-sub">{row.sub}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="adm-card adm-card--pane adm-card--health">
          <div className="adm-card-head">
            <h2>
              <Wrench size={18} strokeWidth={2} className="adm-card-head-ic" aria-hidden />
              Platform Health
            </h2>
          </div>
          <ul className="adm-health-list">
            <li>
              <span className="adm-health-label">Stats API</span>
              <strong
                className={
                  statsError ? "adm-health-badge adm-health-badge--bad" : "adm-health-badge adm-health-badge--ok"
                }
              >
                {statsError ? "Unavailable" : "OK"}
              </strong>
            </li>
            <li>
              <span className="adm-health-label">User Directory</span>
              <strong
                className={
                  usersLoadError
                    ? "adm-health-badge adm-health-badge--bad"
                    : "adm-health-badge adm-health-badge--ok"
                }
              >
                {usersLoadError ? "Error" : "OK"}
              </strong>
            </li>
            <li>
              <span className="adm-health-label">Complaints Feed</span>
              <strong
                className={
                  complaintsLoadError
                    ? "adm-health-badge adm-health-badge--bad"
                    : "adm-health-badge adm-health-badge--ok"
                }
              >
                {complaintsLoadError ? "Error" : "OK"}
              </strong>
            </li>
            <li>
              <span className="adm-health-label">Open Complaints</span>
              <strong className={healthOpenComplaintsBadge.className}>
                {healthOpenComplaintsBadge.text}
              </strong>
            </li>
          </ul>
          <p className="adm-demo-note adm-health-footnote">
            System status is based on the latest dashboard check.
          </p>
        </div>
      </div>

      <div className="adm-card">
        <div className="adm-card-head">
          <h2>
            <Shield size={18} strokeWidth={2} className="adm-card-head-ic" aria-hidden />
            Moderation queue
          </h2>
          <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => setActiveTab("complaints")}>
            Open complaints <ArrowRight size={14} strokeWidth={2.5} aria-hidden />
          </button>
        </div>
        {openComplaintsQueue.length === 0 ? (
          <p className="adm-empty">No open complaints. Great.</p>
        ) : (
          <ul className="adm-queue-list">
            {openComplaintsQueue.slice(0, 6).map((c) => {
              const cid = Number(c._id ?? c.id);
              return (
                <li key={cid} className="adm-queue-row">
                  <div>
                    <p className="adm-queue-title">{c.title || "Complaint"}</p>
                    <p className="adm-queue-meta">
                      {displayUserName(c.user)} · {formatRelativeTime(c.createdAt) || "—"}
                    </p>
                  </div>
                  <div className="adm-queue-actions">
                    {complaintAgeBadge(c)}
                    <button
                      type="button"
                      className="adm-btn adm-btn--accent adm-btn--sm"
                      onClick={() => handleComplaintStatus(cid, "reviewing")}
                    >
                      Review
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="adm-card">
        <div className="adm-card-head">
          <h2>Recent registrations</h2>
          {usersLoadError ? <span className="adm-badge-warn">API unavailable</span> : null}
        </div>
        {recentRegs.length === 0 ? (
          <p className="adm-empty">No users loaded yet.</p>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {recentRegs.map((u) => {
                  const uid = u.id ?? u._id;
                  const r = u.role || "candidate";
                  return (
                    <tr key={uid ?? u.email}>
                      <td>
                        <div className="adm-user-cell">
                          <UserAvatar user={u} size={36} />
                          <div>
                            <div className="adm-td-title">{displayUserName(u)}</div>
                            <div className="adm-td-sub">{u.email || "—"}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`adm-chip adm-chip--role adm-chip--${String(r).toLowerCase()}`}
                        >
                          {roleLabel(r)}
                        </span>
                      </td>
                      <td className="adm-td-muted">
                        {formatRelativeTime(u.createdAt) || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  const renderUsers = () => (
    <div className="adm-stack">
      {pageBanner?.text ? (
        <div
          className={`adm-page-banner feed-notice ${
            pageBanner.kind === "ok" ? "feed-notice--ok" : "feed-notice--err"
          }`}
          role="status"
        >
          {pageBanner.text}
        </div>
      ) : null}
      <div className="adm-page-head">
        <h1>Users</h1>
        <p className="adm-page-sub">
          {filteredUsers.length} shown
          {usersLoadError ? (
            <span className="adm-inline-warn"> · Could not refresh list</span>
          ) : null}
        </p>
      </div>

      <div className="adm-toolbar">
        <label className="adm-search">
          <Search size={18} strokeWidth={2} aria-hidden className="adm-search-ic" />
          <input
            type="search"
            className="adm-search-input"
            placeholder="Search name or email…"
            value={topSearch}
            onChange={(e) => setTopSearch(e.target.value)}
            aria-label="Search users"
          />
        </label>
        <div className="adm-filter-pills" role="group" aria-label="Filter by role">
          {[
            { id: "all", label: "All" },
            { id: "candidate", label: "Candidate" },
            { id: "company", label: "Company" },
            { id: "admin", label: "Admin" },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              className={`adm-filter-pill ${userRoleFilter === f.id ? "active" : ""}`}
              onClick={() => setUserRoleFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="adm-card adm-card--flush">
        {filteredUsers.length === 0 ? (
          <p className="adm-empty">No users match your filters.</p>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th className="adm-th-actions-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const uid = u.id ?? u._id;
                  const r = String(u.role || "candidate").toLowerCase();
                  const isAdmin = r === "admin";
                  const numId = Number(uid);
                  return (
                    <tr key={uid ?? u.email}>
                      <td>
                        <div className="adm-user-cell">
                          <UserAvatar user={u} size={40} />
                          <div>
                            <div className="adm-td-title">{displayUserName(u)}</div>
                            <div className="adm-td-sub">{u.email || "—"}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`adm-chip adm-chip--role adm-chip--${r}`}>
                          {roleLabel(r)}
                        </span>
                      </td>
                      <td>
                        <div className="adm-action-grid">
                          <button
                            type="button"
                            className="adm-btn adm-btn--ghost adm-btn--sm lc-adm-ic-btn"
                            disabled={uid == null || usersLoadError}
                            onClick={() => navigate(`/admin/users/${uid}`)}
                          >
                            <Eye size={15} strokeWidth={2} aria-hidden /> Profile
                          </button>
                          <button
                            type="button"
                            className="adm-btn adm-btn--ghost adm-btn--sm lc-adm-ic-btn"
                            disabled={uid == null || usersLoadError}
                            onClick={() =>
                              navigate(`/admin/users/${uid}`, { state: { scrollPosts: true } })
                            }
                          >
                            Posts
                          </button>
                          {r === "company" ? (
                            <button
                              type="button"
                              className="adm-btn adm-btn--ghost adm-btn--sm lc-adm-ic-btn"
                              disabled={uid == null || usersLoadError}
                              onClick={() =>
                                navigate(`/admin/users/${uid}`, { state: { scrollJobs: true } })
                              }
                            >
                              <BriefcaseBusiness size={15} strokeWidth={2} aria-hidden /> Jobs
                            </button>
                          ) : null}
                          {r === "candidate" ? (
                            <button
                              type="button"
                              className="adm-btn adm-btn--ghost adm-btn--sm lc-adm-ic-btn"
                              disabled={uid == null || usersLoadError}
                              onClick={() =>
                                navigate(`/admin/users/${uid}`, { state: { scrollApps: true } })
                              }
                            >
                              Applications
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="adm-btn adm-btn--ghost adm-btn--sm lc-adm-ic-btn"
                            disabled={!Number.isFinite(numId) || usersLoadError}
                            onClick={() =>
                              navigate(
                                `${ADMIN_MESSAGES_PATH}?userId=${encodeURIComponent(String(uid))}`
                              )
                            }
                          >
                            <Mail size={15} strokeWidth={2} aria-hidden /> Message
                          </button>
                          <button
                            type="button"
                            className="adm-btn adm-btn--danger adm-btn--sm lc-adm-ic-btn"
                            disabled={uid == null || isAdmin || usersLoadError}
                            onClick={() =>
                              setDeleteUserTarget({
                                uid: numId,
                                name: displayUserName(u),
                              })
                            }
                          >
                            <Trash2 size={15} strokeWidth={2} aria-hidden /> Delete
                          </button>
                          {!isAdmin && Number.isFinite(numId) ? (
                            <div className="adm-verify-inline" role="group" aria-label="Verification">
                              {u.isVerified ? (
                                <span className="adm-chip adm-chip--resolved">Verified</span>
                              ) : (
                                <span className="adm-chip">Unverified</span>
                              )}
                              <button
                                type="button"
                                className="adm-btn adm-btn--ghost adm-btn--sm lc-adm-ic-btn"
                                disabled={usersLoadError || Boolean(u.isVerified)}
                                onClick={() => handleVerifyCompanyUser(numId)}
                                title="Grant verified badge"
                              >
                                <ShieldCheck size={15} strokeWidth={2} aria-hidden /> Verify
                              </button>
                              <button
                                type="button"
                                className="adm-btn adm-btn--ghost adm-btn--sm lc-adm-ic-btn"
                                disabled={usersLoadError || !u.isVerified}
                                onClick={() => handleUnverifyCompanyUser(numId)}
                              >
                                Unverify
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  const renderJobs = () => (
    <div className="adm-stack">
      {pageBanner?.text ? (
        <div
          className={`adm-page-banner feed-notice ${
            pageBanner.kind === "ok" ? "feed-notice--ok" : "feed-notice--err"
          }`}
          role="status"
        >
          {pageBanner.text}
        </div>
      ) : null}
      <div className="adm-page-head">
        <h1>Job posts</h1>
        <p className="adm-page-sub">
          {filteredJobsBase.length} shown
          {jobsLoadError ? (
            <span className="adm-inline-warn"> · Could not refresh list</span>
          ) : null}
        </p>
      </div>

      <div className="adm-toolbar">
        <label className="adm-search">
          <Search size={18} strokeWidth={2} aria-hidden className="adm-search-ic" />
          <input
            type="search"
            className="adm-search-input"
            placeholder="Search…"
            value={topSearch}
            onChange={(e) => setTopSearch(e.target.value)}
            aria-label="Search jobs"
          />
        </label>
        <select
          className="adm-select"
          value={jobsStatusFilter}
          onChange={(e) => setJobsStatusFilter(e.target.value)}
          aria-label="Job status"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {filteredJobsBase.length === 0 ? (
        <div className="adm-card">
          <p className="adm-empty">No jobs match your search.</p>
        </div>
      ) : (
        <ul className="adm-job-list">
          {filteredJobsBase.map((j) => {
            const jid = j.id ?? j._id;
            const company = companyNameFromJob(j);
            const logo = initialsFromName(company).slice(0, 2).toUpperCase();
            const st = String(j.status || "active").toLowerCase();
            return (
              <li key={jid ?? j.title} className="adm-card adm-job-row lc-adm-job-row">
                <div className="adm-job-left">
                  <div className="adm-job-logo" aria-hidden>
                    {logo}
                  </div>
                  <div>
                    <h3 className="adm-job-title">{j.title || "Job"}</h3>
                    <p className="adm-job-meta">
                      {company}
                      {j.location ? ` · ${j.location}` : ""}
                    </p>
                    <p className="adm-job-sub">
                      {j.applicantsCount ?? 0} applicants · {formatRelativeTime(j.createdAt) || "—"}
                    </p>
                  </div>
                </div>
                <div className="adm-job-right">
                  <span
                    className={`adm-chip adm-chip--job adm-chip--job-${st === "closed" ? "closed" : "active"}`}
                  >
                    {st === "closed" ? "Closed" : "Active"}
                  </span>
                  <button
                    type="button"
                    className="adm-btn adm-btn--ghost adm-btn--sm lc-adm-ic-btn"
                    disabled={jid == null || jobsLoadError}
                    onClick={() => setJobDetailModal(j)}
                  >
                    <Eye size={15} strokeWidth={2} aria-hidden /> Details
                  </button>
                  <button
                    type="button"
                    className="adm-btn adm-btn--accent adm-btn--sm"
                    disabled={jid == null || jobsLoadError || st === "closed" || actionBusy}
                    onClick={() => handleCloseJobInline(jid)}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    className="adm-btn adm-btn--danger adm-btn--sm lc-adm-ic-btn"
                    disabled={jid == null || jobsLoadError}
                    onClick={() =>
                      setDeleteJobTarget({ jid: Number(jid), title: j.title || "Job" })
                    }
                  >
                    <Trash2 size={15} strokeWidth={2} aria-hidden /> Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  const renderComplaints = () => (
    <div className="adm-stack">
      {pageBanner?.text ? (
        <div
          className={`adm-page-banner feed-notice ${
            pageBanner.kind === "ok" ? "feed-notice--ok" : "feed-notice--err"
          }`}
          role="status"
        >
          {pageBanner.text}
        </div>
      ) : null}
      <div className="adm-page-head">
        <h1>Complaints</h1>
        <p className="adm-page-sub">
          {filteredComplaints.length} in this view
          {complaintsLoadError ? (
            <span className="adm-inline-warn"> · Could not refresh list</span>
          ) : null}
        </p>
      </div>

      <div className="adm-toolbar">
        <label className="adm-search">
          <Search size={18} strokeWidth={2} aria-hidden className="adm-search-ic" />
          <input
            type="search"
            className="adm-search-input"
            placeholder="Search complaints…"
            value={topSearch}
            onChange={(e) => setTopSearch(e.target.value)}
            aria-label="Search complaints"
          />
        </label>
      </div>

      <div className="adm-complaint-tabs" role="tablist">
        {[
          { id: "open", label: "Open", n: complaintCounts.open },
          { id: "reviewing", label: "Reviewing", n: complaintCounts.reviewing },
          { id: "resolved", label: "Resolved", n: complaintCounts.resolved },
          { id: "all", label: "All", n: complaintCounts.all },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={complaintTab === t.id}
            className={`adm-complaint-tab ${complaintTab === t.id ? "active" : ""}`}
            onClick={() => setComplaintTab(t.id)}
          >
            {t.label}
            <span className="adm-complaint-tab-n">{t.n}</span>
          </button>
        ))}
      </div>

      {filteredComplaints.length === 0 ? (
        <div className="adm-card">
          <p className="adm-empty">No complaints in this tab.</p>
        </div>
      ) : (
        <ul className="adm-complaint-list">
          {filteredComplaints.map((c) => {
            const cidNum = Number(c._id ?? c.id);
            const idOk = Number.isFinite(cidNum);
            const status = String(c.status || "open").toLowerCase();
            const fromName = displayUserName(c.user);
            const againstName = c.against ? displayUserName(c.against) : "—";
            return (
              <li key={idOk ? cidNum : c.title} className="adm-card adm-complaint-card lc-adm-complaint">
                <div className="adm-complaint-top">
                  <div>
                    <h3>{c.title || "Complaint"}</h3>
                    <p className="adm-complaint-meta">
                      From {fromName} · Regarding {againstName} ·{" "}
                      {formatRelativeTime(c.createdAt) || "—"}
                    </p>
                  </div>
                  <div className="adm-complaint-badges">
                    {complaintAgeBadge(c)}
                    <span className={complaintStatusClass(status)}>{status}</span>
                  </div>
                </div>
                <p className="adm-complaint-body">{c.description || "—"}</p>
                <div className="adm-complaint-actions">
                  <button
                    type="button"
                    className="adm-btn adm-btn--ghost adm-btn--sm"
                    disabled={!idOk || complaintsLoadError || status === "open"}
                    onClick={() => handleComplaintStatus(cidNum, "open")}
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    className="adm-btn adm-btn--accent adm-btn--sm"
                    disabled={!idOk || complaintsLoadError || status === "reviewing"}
                    onClick={() => handleComplaintStatus(cidNum, "reviewing")}
                  >
                    Reviewing
                  </button>
                  <button
                    type="button"
                    className="adm-btn adm-btn--success adm-btn--sm"
                    disabled={!idOk || complaintsLoadError || status === "resolved"}
                    onClick={() => handleComplaintStatus(cidNum, "resolved")}
                  >
                    Resolved
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  const renderModeration = () => (
    <div className="adm-stack">
      {pageBanner?.text ? (
        <div
          className={`adm-page-banner feed-notice ${
            pageBanner.kind === "ok" ? "feed-notice--ok" : "feed-notice--err"
          }`}
          role="status"
        >
          {pageBanner.text}
        </div>
      ) : null}
      <div className="adm-page-head">
        <h1>Moderation</h1>
        <p className="adm-page-sub">
          Content reports and company review approval
          {reportsLoadError || companyReviewsLoadError || siteReviewsLoadError ? (
            <span className="adm-inline-warn"> · Some data failed to load</span>
          ) : null}
        </p>
      </div>

      <div className="adm-filter-pills" role="tablist" aria-label="Moderation sections">
        <button
          type="button"
          className={`adm-filter-pill ${modSubTab === "reports" ? "active" : ""}`}
          onClick={() => setModSubTab("reports")}
        >
          Reports
        </button>
        <button
          type="button"
          className={`adm-filter-pill ${modSubTab === "reviews" ? "active" : ""}`}
          onClick={() => setModSubTab("reviews")}
        >
          Company reviews
        </button>
        <button
          type="button"
          className={`adm-filter-pill ${modSubTab === "site-reviews" ? "active" : ""}`}
          onClick={() => setModSubTab("site-reviews")}
        >
          Site reviews
        </button>
      </div>

      {modSubTab === "reports" ? (
        <>
          <div className="adm-toolbar">
            <label className="adm-search">
              <Search size={18} strokeWidth={2} aria-hidden className="adm-search-ic" />
              <input
                type="search"
                className="adm-search-input"
                placeholder="Search report text, target, reporter…"
                value={topSearch}
                onChange={(e) => setTopSearch(e.target.value)}
                aria-label="Search reports"
              />
            </label>
            <select
              className="adm-select"
              value={modReportFilter}
              onChange={(e) => setModReportFilter(e.target.value)}
              aria-label="Report status"
            >
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="reviewing">Reviewing</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
          {filteredReports.length === 0 ? (
            <div className="adm-card">
              <p className="adm-empty">
                {reportsLoadError
                  ? "Could not load reports."
                  : "No reports match this filter."}
              </p>
            </div>
          ) : (
            <ul className="adm-complaint-list">
              {filteredReports.map((r) => {
                const rid = Number(r.id);
                const st = String(r.status || "open").toLowerCase();
                const repName =
                  r.reporter?.fullName ||
                  r.reporter?.companyName ||
                  r.reporter?.email ||
                  "Reporter";
                return (
                  <li key={rid} className="adm-card adm-complaint-card">
                    <div className="adm-complaint-top">
                      <div>
                        <h3>
                          {String(r.targetType || "content").toUpperCase()} #{r.targetId}
                        </h3>
                        <p className="adm-complaint-meta">
                          By {repName} · {formatRelativeTime(r.createdAt) || "—"}
                        </p>
                      </div>
                      <span className={complaintStatusClass(st)}>{st}</span>
                    </div>
                    <p className="adm-complaint-body">{r.reason || "—"}</p>
                    <div className="adm-complaint-actions">
                      <button
                        type="button"
                        className="adm-btn adm-btn--ghost adm-btn--sm"
                        disabled={st === "open"}
                        onClick={() => handleReportStatusAdmin(rid, "open")}
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        className="adm-btn adm-btn--accent adm-btn--sm"
                        disabled={st === "reviewing"}
                        onClick={() => handleReportStatusAdmin(rid, "reviewing")}
                      >
                        Reviewing
                      </button>
                      <button
                        type="button"
                        className="adm-btn adm-btn--success adm-btn--sm"
                        disabled={st === "resolved"}
                        onClick={() => handleReportStatusAdmin(rid, "resolved")}
                      >
                        Resolved
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : modSubTab === "reviews" ? (
        <>
          <div className="adm-toolbar">
            <label className="adm-search">
              <Search size={18} strokeWidth={2} aria-hidden className="adm-search-ic" />
              <input
                type="search"
                className="adm-search-input"
                placeholder="Search review text, company, author…"
                value={topSearch}
                onChange={(e) => setTopSearch(e.target.value)}
                aria-label="Search company reviews"
              />
            </label>
          </div>
          {filteredCompanyReviewsModeration.length === 0 ? (
            <div className="adm-card">
              <p className="adm-empty">
                {companyReviewsLoadError
                  ? "Could not load company reviews."
                  : "No company reviews yet."}
              </p>
            </div>
          ) : (
            <ul className="adm-complaint-list">
              {filteredCompanyReviewsModeration.map((r) => {
                const rid = Number(r.id);
                const st = String(r.status || "pending").toLowerCase();
                return (
                  <li key={rid} className="adm-card adm-complaint-card">
                    <div className="adm-complaint-top">
                      <div>
                        <h3>{r.title || "Review"}</h3>
                        <p className="adm-complaint-meta">
                          {r.companyName || "Company"} · {r.authorName || "Candidate"} ·{" "}
                          {formatRelativeTime(r.createdAt) || "—"} · Rating {r.rating ?? "—"}/5
                        </p>
                      </div>
                      <span
                        className={`adm-chip ${
                          st === "approved"
                            ? "adm-chip--resolved"
                            : st === "rejected"
                              ? "adm-chip--open"
                              : "adm-chip--reviewing"
                        }`}
                      >
                        {st}
                      </span>
                    </div>
                    <p className="adm-complaint-body">{r.comment || "—"}</p>
                    {r.interviewExperience ? (
                      <p className="adm-td-muted">Interview: {r.interviewExperience}</p>
                    ) : null}
                    <div className="adm-complaint-actions">
                      <button
                        type="button"
                        className="adm-btn adm-btn--success adm-btn--sm"
                        disabled={st === "approved"}
                        onClick={() => handleCompanyReviewModeration(rid, "approved")}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="adm-btn adm-btn--danger adm-btn--sm"
                        disabled={st === "rejected"}
                        onClick={() => handleCompanyReviewModeration(rid, "rejected")}
                      >
                        Reject
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : (
        <>
          <div className="adm-toolbar">
            <label className="adm-search">
              <Search size={18} strokeWidth={2} aria-hidden className="adm-search-ic" />
              <input
                type="search"
                className="adm-search-input"
                placeholder="Search site review text, reviewer..."
                value={topSearch}
                onChange={(e) => setTopSearch(e.target.value)}
                aria-label="Search site reviews"
              />
            </label>
          </div>
          {filteredSiteReviewsModeration.length === 0 ? (
            <div className="adm-card">
              <p className="adm-empty">
                {siteReviewsLoadError ? "Could not load site reviews." : "No site reviews yet."}
              </p>
            </div>
          ) : (
            <ul className="adm-complaint-list">
              {filteredSiteReviewsModeration.map((r) => {
                const rid = Number(r.id);
                return (
                  <li key={rid} className="adm-card adm-complaint-card">
                    <div className="adm-complaint-top">
                      <div>
                        <h3>{r.name || "Reviewer"}</h3>
                        <p className="adm-complaint-meta">
                          {formatRelativeTime(r.createdAt) || "—"} · Rating {r.rating ?? "—"}/5
                        </p>
                      </div>
                      <span className="adm-chip adm-chip--reviewing">
                        <Star size={13} strokeWidth={2} aria-hidden /> Site review
                      </span>
                    </div>
                    <p className="adm-complaint-body">{r.comment || "—"}</p>
                    <div className="adm-complaint-actions">
                      <button
                        type="button"
                        className="adm-btn adm-btn--danger adm-btn--sm lc-adm-ic-btn"
                        disabled={!Number.isFinite(rid)}
                        onClick={() =>
                          setDeleteSiteReviewTarget({ id: rid, name: r.name || "Reviewer" })
                        }
                      >
                        <Trash2 size={15} strokeWidth={2} aria-hidden /> Delete
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );

  const jd = jobDetailModal;
  const jdSt = jd ? String(jd.status || "active").toLowerCase() : "";

  return (
    <motion.div className="candidate-page admin-app-page" {...lcMotionPage()}>
      <AppTopbar
        user={me}
        subtitle="Administrator"
        searchPlaceholder={searchPlaceholder}
        searchValue={topSearch}
        onSearchChange={(e) => setTopSearch(e.target.value)}
        onSearchKeyDown={handleTopSearchKeyDown}
        notifUnread={notifUnread}
        messagesUnread={messagesUnread}
        showMessaging
        onLogoClick={goAdminHome}
        onHomeClick={goAdminHome}
        onMessagesClick={() => navigate(ADMIN_MESSAGES_PATH)}
        onNotificationsClick={() => navigate(ADMIN_NOTIFICATIONS_PATH)}
      />

      <div className="dashboard-body">
        <AppSidebar
          user={me}
          activeSection={activeTab}
          notifUnread={notifUnread}
          messagesUnread={messagesUnread}
          complaintsOpen={complaintsOpenSidebarBadge}
          moderationPending={moderationSidebarBadge}
          onDashboard={() => navigate(adminDashboardPathForTab("dashboard"))}
          onUsers={() => navigate(adminDashboardPathForTab("users"))}
          onJobs={() => navigate(adminDashboardPathForTab("jobs"))}
          onComplaints={() => navigate(adminDashboardPathForTab("complaints"))}
          onModeration={() => navigate(adminDashboardPathForTab("moderation"))}
          onMessages={() => navigate(ADMIN_MESSAGES_PATH)}
          onNotifications={() => navigate(ADMIN_NOTIFICATIONS_PATH)}
          onSignOut={signOut}
        />

        <main className="main-content adm-main lc-adm-main">
          {activeTab === "dashboard" && renderDashboard()}
          {activeTab === "users" && renderUsers()}
          {activeTab === "jobs" && renderJobs()}
          {activeTab === "complaints" && renderComplaints()}
          {activeTab === "moderation" && renderModeration()}
        </main>
      </div>

      <Modal
        open={Boolean(jd)}
        wide
        title={jd?.title || "Job details"}
        onClose={() => setJobDetailModal(null)}
      >
        {jd ? (
          <div className="adm-job-modal-body">
            <p className="adm-job-modal-company">
              <UserAvatar user={jd.company} name={companyNameFromJob(jd)} size={44} />
              <span>{companyNameFromJob(jd)}</span>
            </p>
            <div className="adm-job-modal-meta">
              <span
                className={`adm-chip adm-chip--job adm-chip--job-${jdSt === "closed" ? "closed" : "active"}`}
              >
                {jdSt === "closed" ? "Closed" : "Active"}
              </span>
              <span className="adm-td-muted">
                {jd.applicantsCount ?? 0} applicants · Posted{" "}
                {formatRelativeTime(jd.createdAt) || "—"}
              </span>
            </div>
            <dl className="adm-job-modal-dl">
              <div>
                <dt>Location</dt>
                <dd>{jd.location || "—"}</dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>{jd.type || "—"}</dd>
              </div>
              <div>
                <dt>Salary</dt>
                <dd>{jd.salary || "—"}</dd>
              </div>
            </dl>
            <h4 className="adm-modal-section-title">Description</h4>
            <p className="adm-modal-text">{jd.description || "—"}</p>
            <h4 className="adm-modal-section-title">Requirements</h4>
            <pre className="adm-modal-pre">{jobRequirementsText(jd)}</pre>
            <div className="adm-modal-footer-actions">
              <button type="button" className="adm-btn adm-btn--ghost" onClick={() => setJobDetailModal(null)}>
                Close
              </button>
              <button
                type="button"
                className="adm-btn adm-btn--accent"
                disabled={jdSt === "closed" || actionBusy}
                onClick={() => handleCloseJobInline(jd.id ?? jd._id)}
              >
                Close job
              </button>
              <button
                type="button"
                className="adm-btn adm-btn--danger"
                disabled={actionBusy}
                onClick={() =>
                  setDeleteJobTarget({
                    jid: Number(jd.id ?? jd._id),
                    title: jd.title || "Job",
                  })
                }
              >
                Delete job
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={activityModalOpen}
        title="All recent activity"
        onClose={() => setActivityModalOpen(false)}
      >
        {activityTimeline.length === 0 ? (
          <p className="adm-empty">No recent events yet.</p>
        ) : (
          <ul className="adm-timeline adm-timeline--modal">
            {activityTimeline.map((row) => (
              <li key={`modal-${row.id}`} className="adm-timeline-item">
                <span
                  className={`adm-timeline-dot adm-timeline-dot--${row.kind}`}
                  aria-hidden
                />
                <div>
                  <p className="adm-timeline-title">{row.title}</p>
                  <p className="adm-timeline-sub">
                    {row.sub} · {formatActivityDateTime(row.ts)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <Modal
        open={Boolean(deleteUserTarget)}
        title="Delete user?"
        onClose={() => !actionBusy && setDeleteUserTarget(null)}
      >
        {deleteUserTarget ? (
          <div className="adm-delete-modal">
            <p>
              Permanently remove <strong>{deleteUserTarget.name}</strong>? This cannot be undone.
            </p>
            <div className="adm-modal-footer-actions">
              <button
                type="button"
                className="adm-btn adm-btn--ghost"
                disabled={actionBusy}
                onClick={() => setDeleteUserTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="adm-btn adm-btn--danger"
                disabled={actionBusy}
                onClick={confirmDeleteUser}
              >
                {actionBusy ? (
                  <Loader2 className="adm-spin" size={18} strokeWidth={2.5} aria-hidden />
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(deleteSiteReviewTarget)}
        title="Delete this site review?"
        onClose={() => !actionBusy && setDeleteSiteReviewTarget(null)}
      >
        {deleteSiteReviewTarget ? (
          <div className="adm-delete-modal">
            <p>
              Delete review by <strong>{deleteSiteReviewTarget.name}</strong>?
            </p>
            <div className="adm-modal-footer-actions">
              <button
                type="button"
                className="adm-btn adm-btn--ghost"
                disabled={actionBusy}
                onClick={() => setDeleteSiteReviewTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="adm-btn adm-btn--danger"
                disabled={actionBusy}
                onClick={confirmDeleteSiteReview}
              >
                {actionBusy ? (
                  <Loader2 className="adm-spin" size={18} strokeWidth={2.5} aria-hidden />
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(deleteJobTarget)}
        title="Delete job?"
        onClose={() => !actionBusy && setDeleteJobTarget(null)}
      >
        {deleteJobTarget ? (
          <div className="adm-delete-modal">
            <p>
              Remove listing <strong>{deleteJobTarget.title}</strong>? Applications may be affected.
            </p>
            <div className="adm-modal-footer-actions">
              <button
                type="button"
                className="adm-btn adm-btn--ghost"
                disabled={actionBusy}
                onClick={() => setDeleteJobTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="adm-btn adm-btn--danger"
                disabled={actionBusy}
                onClick={confirmDeleteJob}
              >
                {actionBusy ? (
                  <Loader2 className="adm-spin" size={18} strokeWidth={2.5} aria-hidden />
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </motion.div>
  );
}
