import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/axios";
import Modal from "../components/Modal";
import CandidateSidebar from "../components/CandidateSidebar";
import DashboardRail from "../components/DashboardRail";
import AppTopbar from "../components/AppTopbar";
import { formatRelativeTime, initialsFromName } from "../utils/format";
import { displayNameFromUser } from "../utils/avatar";
import { dashboardPath, FEED_PATH, getUser, logout } from "../utils/auth";
import { useAuthUser } from "../hooks/useAuthUser";
import { motion } from "framer-motion";
import {
  Bell,
  Bookmark,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  FileText,
  Heart,
  LifeBuoy,
  MapPin,
  MessageSquare,
  Newspaper,
  Paperclip,
  Search,
  Sparkles,
  StickyNote,
  Upload,
  UserPlus,
  UserRound,
  Users,
  XCircle,
} from "lucide-react";

import { lcMotionPage } from "../utils/motionProps";
import JobMatchBadge from "../components/JobMatchBadge";
import JobMatchExplain from "../components/JobMatchExplain";
import ApplicationPipeline from "../components/ApplicationPipeline";
import { candidateProfileStrength } from "../utils/profileStrength";
import { useToast } from "../context/ToastContext";
import { calculateJobMatch, computeJobMatchPct } from "../utils/jobMatchScore";
import { fileToDataUrl } from "../utils/fileToDataUrl";
import { hydrateFollowing, loadFollowSet, toggleFollowViaApi } from "../utils/followApi";
import { subscribeFollowChanges } from "../utils/feedStorage";
import UserAvatar from "../components/UserAvatar";
import { isDisplayableMediaUrl } from "../utils/profileMedia";
import "./CandidateDashboard.css";
import "./CompanyDashboardExtras.css";

const MAX_CV_FILE_BYTES = 10 * 1024 * 1024;

const INTERVIEW_NOTES_STORAGE_KEY = "interviewNotes";

const LC_SS_RECENT_JOBS = "lc_recent_viewed_jobs";

function readRecentJobsFromSession() {
  try {
    const raw = sessionStorage.getItem(LC_SS_RECENT_JOBS);
    const p = JSON.parse(raw || "[]");
    if (!Array.isArray(p)) return [];
    return p.filter((row) => row && row.id != null && String(row.title || "").trim()).slice(0, 12);
  } catch {
    return [];
  }
}

function persistRecentJobsSession(rows) {
  try {
    sessionStorage.setItem(LC_SS_RECENT_JOBS, JSON.stringify(rows.slice(0, 8)));
  } catch {
    /* ignore quota / private mode */
  }
}

function readInterviewNotesMap() {
  try {
    const raw = localStorage.getItem(INTERVIEW_NOTES_STORAGE_KEY);
    if (!raw?.trim()) return {};
    const p = JSON.parse(raw);
    return p && typeof p === "object" && !Array.isArray(p) ? p : {};
  } catch {
    return {};
  }
}

function writeInterviewNotesMap(map) {
  try {
    localStorage.setItem(INTERVIEW_NOTES_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota / private mode */
  }
}

function formatInterviewSlots(scheduledAt) {
  if (!scheduledAt) return { dateStr: "—", timeStr: "—" };
  const d = new Date(scheduledAt);
  if (Number.isNaN(d.getTime())) return { dateStr: "—", timeStr: "—" };
  return {
    dateStr: d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    timeStr: d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
  };
}

/** MySQL datetimes often parse as local; allow small clock slack so Cancel still shows. */
function isInterviewUpcoming(scheduledAt, slackMs = 180_000) {
  if (!scheduledAt) return true;
  const d = new Date(scheduledAt);
  if (Number.isNaN(d.getTime())) return true;
  return d.getTime() > Date.now() - slackMs;
}

function interviewCanCancel(iv) {
  const st = String(iv?.status || "").toLowerCase();
  if (st !== "scheduled") return false;
  return isInterviewUpcoming(iv?.scheduledAt);
}

function interviewNumericId(iv) {
  const raw = iv?.id ?? iv?._id;
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

function compactInterviewSnippet(text, max = 100) {
  const t = String(text || "")
    .trim()
    .replace(/\s+/g, " ");
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

const FALLBACK_JOBS = [
  {
    company: "TechBeirut",
    title: "Senior React Developer",
    location: "Beirut",
    type: "Full-time",
    salary: "$2,500 – $3,500/mo",
    applicants: 14,
    time: "2 days ago",
    status: "Applied",
    logo: "TECH",
    logoClass: "logo-tech",
    apiId: null,
    companyId: null,
  },
  {
    company: "Phoenix Media Group",
    title: "Digital Marketing Specialist",
    location: "Beirut",
    type: "Full-time",
    salary: "$1,800 – $2,400/mo",
    applicants: 22,
    time: "1 day ago",
    status: "Apply",
    logo: "PM",
    logoClass: "logo-phoenix",
    apiId: null,
    companyId: null,
  },
  {
    company: "Blom Invest Bank",
    title: "Financial Analyst",
    location: "Beirut",
    type: "Full-time",
    salary: "$2,000 – $3,000/mo",
    applicants: 31,
    time: "3 days ago",
    status: "Applied",
    logo: "BANK",
    logoClass: "logo-bank",
    apiId: null,
    companyId: null,
  },
];

const FALLBACK_APPLICATIONS = [
  {
    title: "Senior React Developer",
    company: "TechBeirut",
    jobLocation: "Beirut, Lebanon",
    date: "Applied on 2026-03-25",
    status: "Pending",
    color: "pending",
    backendStatus: "pending",
    apiId: null,
    jobId: null,
    companyId: null,
    companyLogo: null,
    coverMessage: "",
    cvLabel: "",
    stage: "applied",
    raw: { status: "pending", stage: "applied" },
  },
  {
    title: "Financial Analyst",
    company: "Blom Invest Bank",
    jobLocation: "Beirut, Lebanon",
    date: "Applied on 2026-03-20",
    status: "Accepted",
    color: "accepted",
    backendStatus: "accepted",
    apiId: null,
    jobId: null,
    companyId: null,
    companyLogo: null,
    coverMessage: "Excited about this opportunity.",
    cvLabel: "resume.pdf",
    stage: "accepted",
    raw: { status: "accepted", stage: "accepted" },
  },
];

const FALLBACK_SAVED = [
  {
    title: "Senior React Developer",
    company: "TechBeirut · Beirut, Lebanon",
    type: "Full-time",
    salary: "$2,500 – $3,500/mo",
    logo: "TECH",
    logoClass: "logo-tech",
    apiId: null,
  },
];

const LOGO_ROT = ["logo-tech", "logo-phoenix", "logo-bank"];

const FIND_JOB_LOCATIONS = [
  "",
  "Beirut",
  "Tripoli",
  "Saida",
  "Sour",
  "Jounieh",
  "Mount Lebanon",
  "North Lebanon",
  "Baalbek",
  "Remote",
];

const FIND_JOB_TYPES = ["", "Full-time", "Part-time", "Contract", "Remote", "Internship"];

const FIND_SALARY_BANDS = [
  { value: "", label: "Any salary" },
  { value: "lt2000", label: "Under ~$2k/mo" },
  { value: "2000-4000", label: "$2k – $4k/mo" },
  { value: "gt4000", label: "$4k+/mo" },
];

const FIND_FIELD_HINTS = [
  { value: "", label: "All fields" },
  { value: "technology", label: "Technology" },
  { value: "marketing", label: "Marketing" },
  { value: "finance", label: "Finance" },
  { value: "design", label: "Design" },
  { value: "sales", label: "Sales" },
  { value: "healthcare", label: "Healthcare" },
  { value: "education", label: "Education" },
  { value: "engineering", label: "Engineering" },
];

function fieldLabelForValue(v) {
  const o = FIND_FIELD_HINTS.find((x) => x.value === v);
  return o ? o.label : String(v || "").trim();
}

function salaryLabelForValue(v) {
  const o = FIND_SALARY_BANDS.find((x) => x.value === v);
  return o ? o.label : String(v || "").trim();
}

function savedSearchSummary(s) {
  const parts = [];
  if (s.location) parts.push(String(s.location));
  if (s.type) parts.push(String(s.type));
  if (s.field) parts.push(fieldLabelForValue(s.field));
  if (s.salary) parts.push(salaryLabelForValue(s.salary));
  const kw = String(s.keyword || "").trim();
  if (kw) parts.push(kw.length > 26 ? `"${kw.slice(0, 26)}…"` : `"${kw}"`);
  if (s.sort === "bestMatch") parts.push("Best match");
  return parts.filter(Boolean).join(" · ") || "Saved filters";
}

function savedSearchesLocalKey(userId) {
  return userId != null ? `savedSearches:${userId}` : "";
}

function loadSavedSearchesFromLocal(userId) {
  const key = savedSearchesLocalKey(userId);
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

function persistSavedSearchesLocal(userId, list) {
  const key = savedSearchesLocalKey(userId);
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* quota */
  }
}

function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

function salaryBandMatches(salaryStr, band) {
  if (!band) return true;
  const raw = String(salaryStr || "").replace(/,/g, "");
  const nums = raw.match(/\d+(?:\.\d+)?/g);
  if (!nums || !nums.length) return true;
  const vals = nums.map((n) => parseFloat(n)).filter((x) => Number.isFinite(x));
  if (!vals.length) return true;
  const mid = (Math.min(...vals) + Math.max(...vals)) / 2;
  if (band === "lt2000") return mid < 2000;
  if (band === "2000-4000") return mid >= 2000 && mid <= 4000;
  if (band === "gt4000") return mid > 4000;
  return true;
}

function mapJob(j, idx, appliedIds, savedIds) {
  const comp = j.company || {};
  const name = comp.companyName || "Company";
  const jid = j.id ?? j._id;
  const applied = jid != null && appliedIds.has(Number(jid));
  const saved = jid != null && savedIds.has(Number(jid));

  return {
    company: name,
    title: j.title,
    location: j.location || "",
    type: j.type || "",
    salary: j.salary || "",
    applicants: j.applicantsCount ?? j.applicants ?? 0,
    time: formatRelativeTime(j.createdAt || j.created_at) || "Recently",
    status: applied ? "Applied" : "Apply",
    logo: initialsFromName(name).slice(0, 4),
    logoClass: LOGO_ROT[idx % LOGO_ROT.length],
    apiId: jid,
    saved,
    companyId: comp.id ?? comp._id,
    rawJob: j,
  };
}

function mapApplication(a) {
  const job = a.job || {};
  const comp = a.company || {};
  const jid = job.id ?? job._id ?? a.job_id;
  const companyId = comp.id ?? comp._id ?? null;
  const companyName = (comp.companyName || "").trim() || "Company";
  const jobLocation = (job.location || "").trim();
  const companyLogo = comp.logo ?? null;
  const created = a.createdAt || a.created_at;
  const backendStatus = String(a.status || "pending").toLowerCase();
  const stageRaw = String(a.stage || "applied").toLowerCase();

  let status = "Pending";
  let color = "pending";

  if (backendStatus === "accepted") {
    status = "Accepted";
    color = "accepted";
  } else if (backendStatus === "rejected") {
    status = "Rejected";
    color = "rejected";
  } else if (backendStatus === "pending") {
    if (stageRaw === "interview") {
      status = "Interview";
      color = "interview";
    } else if (stageRaw === "shortlisted") {
      status = "Shortlisted";
      color = "shortlisted";
    } else {
      status = "Pending";
      color = "pending";
    }
  }

  return {
    title: job.title || "Job",
    company: companyName,
    jobLocation,
    companyId,
    companyLogo,
    date: created
      ? `Applied on ${new Date(created).toLocaleDateString()}`
      : "",
    status,
    color,
    backendStatus,
    apiId: a.id ?? a._id,
    jobId: jid,
    coverMessage:
      typeof a.message === "string" && a.message.trim()
        ? a.message.trim()
        : "",
    cvLabel:
      typeof a.cvFileName === "string" && a.cvFileName.trim()
        ? a.cvFileName.trim()
        : "",
    stage: a.stage || "applied",
    raw: a,
  };
}

function applicationsEmptyCopy(filter, totalLen) {
  if (totalLen === 0) {
    return {
      title: "No applications yet.",
      hint: "Browse Find Jobs and submit your first application — it will show up here.",
    };
  }
  switch (filter) {
    case "pending":
      return {
        title: "No pending applications.",
        hint: "You have no applications still in review.",
      };
    case "accepted":
      return {
        title: "No accepted applications yet.",
        hint: "When an employer accepts you, it will appear under this tab.",
      };
    case "rejected":
      return {
        title: "No rejected applications.",
        hint: "Nothing is listed under this filter right now.",
      };
    default:
      return { title: "No applications.", hint: "" };
  }
}

function mapSavedJob(j, idx) {
  const comp = j.company || {};
  const name = comp.companyName || "Company";
  return {
    title: j.title,
    company: `${name} · ${j.location || ""}`,
    type: j.type || "",
    salary: j.salary || "",
    logo: initialsFromName(name).slice(0, 4),
    logoClass: LOGO_ROT[idx % LOGO_ROT.length],
    apiId: j.id ?? j._id,
  };
}

function CandidateDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const userFromHook = useAuthUser();
  const currentUser =
    userFromHook && typeof userFromHook === "object" ? userFromHook : getUser() || {};
  const currentUserId = currentUser.id ?? currentUser._id ?? null;
  const role = String(currentUser.role || "candidate").toLowerCase();
  const user = currentUser;
  const uid = currentUserId;
  const toast = useToast();
  const displayName = displayNameFromUser(user);
  const specialization = user?.specialization || "";

  const [activeTab, setActiveTab] = useState("dashboard");
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [savedJobs, setSavedJobs] = useState([]);
  const [search, setSearch] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterSalary, setFilterSalary] = useState("");
  const [filterField, setFilterField] = useState("");
  const [loadErr, setLoadErr] = useState(false);
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [jobModalDetail, setJobModalDetail] = useState(null);
  const [notifUnread, setNotifUnread] = useState(0);
  const [messagesUnread, setMessagesUnread] = useState(0);
  const [topSearch, setTopSearch] = useState("");
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [applyJobTarget, setApplyJobTarget] = useState(null);
  const [applyCvBase64, setApplyCvBase64] = useState("");
  const [applyCvFileName, setApplyCvFileName] = useState("");
  const [applyMessage, setApplyMessage] = useState("");
  const [applySubmitting, setApplySubmitting] = useState(false);
  const [applicationFilter, setApplicationFilter] = useState("all");
  const [savedSearchList, setSavedSearchList] = useState([]);
  const [saveSearchModalOpen, setSaveSearchModalOpen] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState("");
  const [saveSearchAlert, setSaveSearchAlert] = useState(false);
  const [saveSearchError, setSaveSearchError] = useState("");
  const [interviewsMine, setInterviewsMine] = useState([]);
  const [interviewCancelTarget, setInterviewCancelTarget] = useState(null);
  const [interviewCancelLoading, setInterviewCancelLoading] = useState(false);
  const [interviewNotes, setInterviewNotes] = useState(() => readInterviewNotesMap());
  const [interviewNoteDraft, setInterviewNoteDraft] = useState("");
  const [interviewNoteEditId, setInterviewNoteEditId] = useState(null);
  const [matchProfileExtra, setMatchProfileExtra] = useState(null);
  const [jobSortMode, setJobSortMode] = useState("recent");
  const [messagesUnreadKnown, setMessagesUnreadKnown] = useState(false);
  const [applicationsActivityUnread, setApplicationsActivityUnread] = useState(0);
  const [networkBlock, setNetworkBlock] = useState(null);
  const [sameFieldNetworkFailed, setSameFieldNetworkFailed] = useState(false);
  const [followedSet, setFollowedSet] = useState(() => loadFollowSet());
  const [followBusyUserId, setFollowBusyUserId] = useState(null);
  const [cvKwResult] = useState(null);
  const [recentViewedJobs, setRecentViewedJobs] = useState(() =>
    readRecentJobsFromSession()
  );

  const debouncedSearch = useDebouncedValue(search.trim(), 320);

  const matchUser = useMemo(() => {
    if (!user) return null;
    const e = matchProfileExtra || {};
    return {
      ...user,
      candidateCvText:
        e.candidateCvText ??
        e.candidate_cv_text ??
        user.candidateCvText ??
        user.candidate_cv_text,
      candidate_cv_text:
        e.candidateCvText ??
        e.candidate_cv_text ??
        user.candidate_cv_text,
      skills: e.skills ?? user.skills,
      location: e.location ?? user.location,
      bio: e.bio ?? user.bio,
      experience: e.experience ?? user.experience,
      specialization: e.specialization ?? user.specialization,
      normalizedSpecialization:
        e.normalizedSpecialization ??
        e.normalized_specialization ??
        user.normalizedSpecialization ??
        user.normalized_specialization,
      preferredJobType:
        e.preferredJobType ??
        e.preferred_job_type ??
        user.preferredJobType ??
        user.preferred_job_type,
      jobTypePreference:
        e.preferredJobType ??
        user.jobTypePreference ??
        user.job_type_preference,
      cvAnalysisDetectedSkills:
        Array.isArray(cvKwResult?.detectedSkills) && cvKwResult.detectedSkills.length
          ? cvKwResult.detectedSkills
          : undefined,
    };
  }, [user, matchProfileExtra, cvKwResult]);

  const filteredJobs = useMemo(() => {
    const safeJobs = Array.isArray(jobs) ? jobs : [];
    return safeJobs
      .filter((j) => {
        if (!salaryBandMatches(j.salary, filterSalary)) return false;
        if (filterField) {
          const blob = `${j.title} ${j.company} ${j.location} ${j.type || ""}`.toLowerCase();
          if (!blob.includes(filterField)) return false;
        }
        return true;
      })
      .map((j) => {
        const matchDetail =
          matchUser && String(matchUser.role || "").toLowerCase() === "candidate"
            ? calculateJobMatch(matchUser, j.rawJob)
            : null;
        return {
          ...j,
          matchPct: computeJobMatchPct(matchUser, j.rawJob),
          matchDetail,
        };
      });
  }, [jobs, filterSalary, filterField, matchUser]);

  const displayJobs = useMemo(() => {
    const list = [...filteredJobs];
    if (jobSortMode === "bestMatch") {
      list.sort((a, b) => (Number(b.matchPct) || 0) - (Number(a.matchPct) || 0));
    }
    return list;
  }, [filteredJobs, jobSortMode]);

  const allMatchesWeak = useMemo(() => {
    if (!matchUser || !filteredJobs.length) return false;
    return filteredJobs.every((j) => j.matchDetail?.insufficientData);
  }, [matchUser, filteredJobs]);

  const hasActiveJobFilters = Boolean(
    search.trim() ||
      filterLocation ||
      filterType ||
      filterSalary ||
      filterField ||
      jobSortMode === "bestMatch"
  );

  const hasSaveableFilters = useMemo(
    () =>
      Boolean(
        search.trim() ||
          debouncedSearch.trim() ||
          filterLocation ||
          filterType ||
          filterSalary ||
          filterField ||
          jobSortMode === "bestMatch"
      ),
    [search, debouncedSearch, filterLocation, filterType, filterSalary, filterField, jobSortMode]
  );

  const followedSetSafe = useMemo(() => {
    if (followedSet instanceof Set) return followedSet;
    return new Set();
  }, [followedSet]);

  const filteredApplications = useMemo(() => {
    const safeApplications = Array.isArray(applications) ? applications : [];
    if (applicationFilter === "all") return safeApplications;
    if (applicationFilter === "pending") {
      return safeApplications.filter((a) => a.backendStatus === "pending");
    }
    if (applicationFilter === "accepted") {
      return safeApplications.filter((a) => a.backendStatus === "accepted");
    }
    if (applicationFilter === "rejected") {
      return safeApplications.filter((a) => a.backendStatus === "rejected");
    }
    return safeApplications;
  }, [applications, applicationFilter]);

  const applicationTabCounts = useMemo(() => {
    const safe = Array.isArray(applications) ? applications : [];
    return {
      all: safe.length,
      pending: safe.filter((x) => x.backendStatus === "pending").length,
      accepted: safe.filter((x) => x.backendStatus === "accepted").length,
      rejected: safe.filter((x) => x.backendStatus === "rejected").length,
    };
  }, [applications]);

  const sameFieldPeople = useMemo(() => {
    const raw = networkBlock?.people;
    if (!Array.isArray(raw)) return [];
    const myId = uid != null ? String(uid) : "";
    return raw.filter(
      (p) =>
        p &&
        p.id != null &&
        String(p.id) !== myId &&
        Number(p.id) !== Number(myId)
    );
  }, [networkBlock, uid]);

  const networkCompaniesRail = useMemo(() => {
    const raw = networkBlock?.companies;
    return Array.isArray(raw) ? raw : [];
  }, [networkBlock]);

  const scrollSavedSearchesIntoView = useCallback(() => {
    requestAnimationFrame(() => {
      document
        .getElementById("lc-saved-searches-anchor")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, []);

  const profileStrength = useMemo(() => candidateProfileStrength(user), [user]);
  const profileStrengthPct = profileStrength.pct;

  const loadDashboardData = useCallback(async () => {
    try {
      const params = {};
      if (debouncedSearch) params.keyword = debouncedSearch;
      if (filterLocation.trim()) params.location = filterLocation.trim();
      if (filterType.trim()) params.type = filterType.trim();

      const [jr, ar, sr] = await Promise.all([
        api.get("/api/jobs", { params }),
        api.get("/api/applications/my"),
        api.get("/api/jobs/saved/my"),
      ]);

      const appliedIds = new Set(
        (ar.data || []).map((x) => Number(x.job?.id ?? x.job?._id ?? x.job_id)).filter(Boolean)
      );

      const savedIds = new Set(
        (sr.data || []).map((x) => Number(x.id ?? x._id)).filter(Boolean)
      );

      setJobs(
        Array.isArray(jr.data) && jr.data.length
          ? jr.data.map((j, i) => mapJob(j, i, appliedIds, savedIds))
          : []
      );

      setApplications(
        Array.isArray(ar.data) && ar.data.length
          ? ar.data.map(mapApplication)
          : []
      );

      setSavedJobs(
        Array.isArray(sr.data) && sr.data.length
          ? sr.data.map((x, i) => mapSavedJob(x, i))
          : []
      );
      setLoadErr(false);
    } catch (err) {
      setJobs(FALLBACK_JOBS);
      setApplications(FALLBACK_APPLICATIONS);
      setSavedJobs(FALLBACK_SAVED);
      setLoadErr(true);
      if (import.meta.env.DEV) {
        console.error(
          "CandidateDashboard loadDashboardData",
          err?.response?.data || err?.message || err
        );
      }
    }
  }, [debouncedSearch, filterLocation, filterType]);

  const refreshSavedSearches = useCallback(async () => {
    if (!uid) return;
    try {
      const { data } = await api.get("/api/saved-searches");
      const list = Array.isArray(data) ? data : [];
      setSavedSearchList(list);
      persistSavedSearchesLocal(uid, list);
    } catch {
      setSavedSearchList(loadSavedSearchesFromLocal(uid));
    }
  }, [uid]);

  const clearFindJobFilters = useCallback(() => {
    setSearch("");
    setFilterLocation("");
    setFilterType("");
    setFilterSalary("");
    setFilterField("");
    setJobSortMode("recent");
  }, []);

  const loadNotificationBadges = useCallback(async () => {
    try {
      const { data } = await api.get("/api/notifications");
      const list = Array.isArray(data) ? data : [];
      const unread = list.filter((n) => !n.isRead);
      setNotifUnread(unread.length);
      const appActivity = unread.filter((n) => {
        const t = String(n.type || "").toLowerCase();
        return t === "application" || t === "interview" || t === "status";
      }).length;
      setApplicationsActivityUnread(appActivity);
    } catch {
      setNotifUnread(0);
      setApplicationsActivityUnread(0);
    }
  }, []);

  const loadMessagesUnread = useCallback(async () => {
    if (!uid) {
      setMessagesUnread(0);
      setMessagesUnreadKnown(false);
      return;
    }
    try {
      const { data } = await api.get("/api/messages/conversations");
      const list = Array.isArray(data) ? data : [];
      setMessagesUnread(
        list.reduce((acc, row) => acc + Number(row.unread || 0), 0)
      );
      setMessagesUnreadKnown(true);
    } catch {
      setMessagesUnread(0);
      setMessagesUnreadKnown(false);
    }
  }, [uid]);

  const refreshInboxCounts = useCallback(async () => {
    await Promise.all([loadNotificationBadges(), loadMessagesUnread()]);
  }, [loadNotificationBadges, loadMessagesUnread]);

  const refreshMyInterviews = useCallback(async () => {
    if (!uid) return;
    try {
      const iv = await api.get("/api/interviews/my").catch(() => ({ data: [] }));
      setInterviewsMine(Array.isArray(iv.data) ? iv.data : []);
    } catch {
      setInterviewsMine([]);
    }
  }, [uid]);

  const confirmInterviewCancel = useCallback(async () => {
    const intId = interviewNumericId(interviewCancelTarget || {});
    if (!Number.isFinite(intId)) {
      toast.error("Missing interview. Refresh the dashboard and try again.");
      return;
    }
    setInterviewCancelLoading(true);
    try {
      const callCancel = async () => {
        try {
          await api.patch(`/api/interviews/${intId}/status`, { status: "cancelled" });
        } catch (err) {
          const st = err.response?.status;
          if (st === 405) {
            await api.put(`/api/interviews/${intId}/status`, { status: "cancelled" });
          } else if (st === 404) {
            await api.put(`/api/interviews/${intId}/cancel`);
          } else {
            throw err;
          }
        }
      };
      await callCancel();
      toast.success("Interview cancelled successfully.");
      setInterviewCancelTarget(null);
      setInterviewsMine((prev) =>
        Array.isArray(prev) ? prev.filter((x) => interviewNumericId(x) !== intId) : []
      );
      await refreshMyInterviews();
      await loadNotificationBadges();
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          err.message ||
          "Could not cancel interview."
      );
    } finally {
      setInterviewCancelLoading(false);
    }
  }, [
    interviewCancelTarget,
    toast,
    refreshMyInterviews,
    loadNotificationBadges,
  ]);

  useEffect(() => {
    void refreshInboxCounts();
  }, [refreshInboxCounts]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void refreshInboxCounts();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refreshInboxCounts]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      try {
        const [iv, nwRes] = await Promise.all([
          api.get("/api/interviews/my").catch(() => ({ data: [] })),
          api.get("/api/network/same-field").then(
            (r) => ({ ok: true, data: r.data }),
            () => ({ ok: false, data: null })
          ),
        ]);

        let nextSaved = [];
        try {
          const { data } = await api.get("/api/saved-searches");
          nextSaved = Array.isArray(data) ? data : [];
          persistSavedSearchesLocal(uid, nextSaved);
        } catch {
          nextSaved = loadSavedSearchesFromLocal(uid);
        }

        if (cancelled) return;
        setSavedSearchList(nextSaved);
        setInterviewsMine(Array.isArray(iv.data) ? iv.data : []);
        setSameFieldNetworkFailed(!nwRes.ok);
        setNetworkBlock(
          nwRes.ok && nwRes.data && typeof nwRes.data === "object" ? nwRes.data : null
        );
      } catch {
        if (!cancelled) {
          setSavedSearchList(loadSavedSearchesFromLocal(uid));
          setInterviewsMine([]);
          setNetworkBlock(null);
          setSameFieldNetworkFailed(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    void hydrateFollowing(setFollowedSet);
  }, [uid]);

  useEffect(() => {
    const off = subscribeFollowChanges(setFollowedSet);
    return off;
  }, []);

  useEffect(() => {
    if (!uid) {
      setMatchProfileExtra(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/api/users/profile/${uid}`);
        if (cancelled || !data || typeof data !== "object") return;
        const cvStr = String(data.candidateCv ?? data.candidate_cv ?? "").trim();
        const cvFn = String(
          data.candidateCvFileName ?? data.candidate_cv_file_name ?? ""
        ).trim();
        const cvBytes = cvStr ? new TextEncoder().encode(cvStr).length : 0;
        setMatchProfileExtra({
          candidateCvText: data.candidateCvText ?? data.candidate_cv_text,
          skills: data.skills,
          location: data.location,
          bio: data.bio,
          experience: data.experience,
          specialization: data.specialization,
          normalizedSpecialization:
            data.normalizedSpecialization ?? data.normalized_specialization,
          preferredJobType:
            data.preferredJobType ?? data.preferred_job_type ?? data.jobTypePreference,
          profileHasCvFile: Boolean(cvStr),
          candidateCvFileName: cvFn,
          candidateCvFingerprint: `${cvBytes}|${cvFn}`,
        });
      } catch {
        if (!cancelled) setMatchProfileExtra(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  useEffect(() => {
    const t = location.state?.tab;
    const qFromState = location.state?.q;
    const qFromUrl = new URLSearchParams(location.search).get("q");
    const sortJobs = location.state?.sortJobs;
    if (location.state?.focusSavedSearches) {
      setActiveTab("findJobs");
    }
    if (t === "findJobs" || t === "applications" || t === "savedJobs") {
      setActiveTab(t);
    }
    if (sortJobs === "bestMatch") {
      setActiveTab("findJobs");
      setJobSortMode("bestMatch");
    }
    if (qFromState || qFromUrl) {
      setActiveTab("findJobs");
      setSearch(qFromState || qFromUrl || "");
    }
  }, [location.state, location.search]);

  useEffect(() => {
    if (!location.state?.focusSavedSearches) return;
    const id = requestAnimationFrame(() => {
      document
        .getElementById("lc-saved-searches-anchor")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    const rest = { ...location.state };
    delete rest.focusSavedSearches;
    navigate(location.pathname + location.search, { replace: true, state: rest });
    return () => cancelAnimationFrame(id);
  }, [location.state?.focusSavedSearches, navigate, location.pathname, location.search]);

  useEffect(() => {
    if (activeTab !== "findJobs" || !uid) return;
    void refreshSavedSearches();
  }, [activeTab, uid, refreshSavedSearches]);

  useEffect(() => {
    const jid = location.state?.openApplyJobId;
    if (jid == null || jid === "") return;

    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/api/jobs/${jid}`);
        if (cancelled) return;
        const comp = data.company || {};
        const nm = comp.companyName || "Company";
        setApplyJobTarget({
          apiId: data.id ?? data._id ?? Number(jid),
          title: data.title || "Job",
          company: nm,
          status: "Apply",
          logo: initialsFromName(nm).slice(0, 4),
          logoClass: "logo-tech",
        });
        setApplyCvBase64("");
        setApplyCvFileName("");
        setApplyMessage("");
        setApplyModalOpen(true);
      } catch {
        if (!cancelled) alert("Could not load that job to apply.");
      }
    })();

    const rest = { ...location.state };
    delete rest.openApplyJobId;
    navigate(location.pathname + location.search, { replace: true, state: rest });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when deep-link id changes
  }, [location.state?.openApplyJobId, navigate, location.pathname, location.search]);

  const modalJobApplied = useMemo(() => {
    if (!jobModalDetail) return false;
    const jid = Number(jobModalDetail.id ?? jobModalDetail._id);
    if (!Number.isFinite(jid)) return false;
    const safeApplications = Array.isArray(applications) ? applications : [];
    return safeApplications.some((a) => Number(a.jobId) === jid);
  }, [applications, jobModalDetail]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.log("CandidateDashboard render", {
      currentUserId,
      role,
      activeTab,
      hasUserObject: Boolean(userFromHook),
    });
  }, [currentUserId, role, activeTab, userFromHook]);

  const openJobModalById = async (jobId) => {
    if (!jobId) return;
    try {
      const { data } = await api.get(`/api/jobs/${jobId}`);
      setJobModalDetail(data);
      setJobModalOpen(true);
      const jid = Number(data?.id ?? data?._id);
      if (!Number.isFinite(jid)) return;
      const comp = String(data.company?.companyName ?? data.company?.company_name ?? "Company").trim();
      const title = String(data.title ?? "Role").trim() || "Role";
      setRecentViewedJobs((prev) => {
        const safe = Array.isArray(prev) ? prev : [];
        const next = [
          { id: jid, title, company: comp },
          ...safe.filter((j) => Number(j?.id) !== jid),
        ].slice(0, 8);
        persistRecentJobsSession(next);
        return next;
      });
    } catch {
      setJobModalDetail(null);
      setJobModalOpen(false);
    }
  };

  const openApplicationCv = async (applicationId) => {
    if (!applicationId) return;
    try {
      const { data } = await api.get(`/api/applications/my/${applicationId}`);
      const cv = data?.cv;
      if (!cv || !String(cv).trim()) {
        toast.error("No CV file for this application.");
        return;
      }
      const s = String(cv).trim();
      window.open(s, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Could not open your CV.");
    }
  };

  const toggleFollowPerson = async (e, personId) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const id = Number(personId);
    if (!Number.isFinite(id) || id === Number(uid)) return;
    if (followBusyUserId != null) return;
    const sid = String(id);
    const has = followedSetSafe.has(sid);
    setFollowBusyUserId(id);
    try {
      const next = await toggleFollowViaApi(id, has);
      if (next) setFollowedSet(next);
    } catch {
      toast.error("Could not update follow.");
    } finally {
      setFollowBusyUserId(null);
    }
  };

  const pickApplyCv = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (typeof file.size === "number" && file.size > MAX_CV_FILE_BYTES) {
      alert(
        "File is too large. Please upload a file under 10MB."
      );
      e.target.value = "";
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setApplyCvBase64(dataUrl);
      setApplyCvFileName(file.name || "cv-upload");
    } catch {
      alert("Could not read that file.");
    } finally {
      e.target.value = "";
    }
  };

  const openApplyModalFromJobCard = (job) => {
    if (!job?.apiId) {
      alert("Job is not linked to the server listing.");
      return;
    }
    if (job.status === "Applied") return;
    setApplyJobTarget(job);
    setApplyCvBase64("");
    setApplyCvFileName("");
    setApplyMessage("");
    setApplyModalOpen(true);
  };

  const submitApplyModal = async (e) => {
    e.preventDefault();
    if (!applyJobTarget?.apiId) return;
    const approxBytes =
      typeof applyCvBase64 === "string"
        ? Math.ceil((applyCvBase64.length * 3) / 4)
        : 0;
    if (approxBytes > MAX_CV_FILE_BYTES + 2048) {
      alert(
        "File is too large. Please upload a file under 10MB."
      );
      return;
    }
    if (!applyCvBase64.trim()) {
      alert("CV is required — upload your résumé file.");
      return;
    }
    setApplySubmitting(true);
    try {
      await api.post("/api/applications", {
        jobId: applyJobTarget.apiId,
        cv: applyCvBase64,
        cvFileName: applyCvFileName || "cv-upload",
        message: applyMessage.trim(),
      });
      setApplyModalOpen(false);
      setApplyJobTarget(null);
      setApplyCvBase64("");
      setApplyCvFileName("");
      setApplyMessage("");
      await loadDashboardData();
    } catch (err) {
      const status = err.response?.status;
      const msg =
        err.response?.data?.message ||
        err.message ||
        (status === 413 ? "Payload too large — compress your CV and try again." : null) ||
        "Could not submit application.";
      if (
        typeof msg === "string" &&
        msg.toLowerCase().includes("already applied")
      ) {
        setApplyModalOpen(false);
        await loadDashboardData();
      }
      alert(msg);
    } finally {
      setApplySubmitting(false);
    }
  };

  const toggleSave = async (job) => {
    if (!job.apiId) return;
    try {
      if (job.saved) {
        await api.delete(`/api/jobs/${job.apiId}/save`);
      } else {
        await api.post(`/api/jobs/${job.apiId}/save`);
      }
      loadDashboardData();
    } catch (e) {
      alert(e.response?.data?.message || e.message || "Save failed");
    }
  };

  const signOut = () => {
    logout();
    navigate("/login");
  };

  const goRoleHome = () => {
    if (user?.role) navigate(dashboardPath(user.role));
    else navigate("/");
  };

  const handleTopSearchKeyDown = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const q = topSearch.trim();
    if (!q) {
      goRoleHome();
      return;
    }
    navigate("/candidate-dashboard", { state: { tab: "findJobs", q } });
  };

  const openSaveSearchModal = useCallback(() => {
    if (!hasSaveableFilters) {
      toast.error("Add at least one filter before saving.");
      return;
    }
    setSaveSearchName("");
    setSaveSearchAlert(false);
    setSaveSearchError("");
    setSaveSearchModalOpen(true);
  }, [hasSaveableFilters]);

  const confirmSaveSavedSearch = async () => {
    const name = saveSearchName.trim();
    if (!name) return;
    setSaveSearchError("");
    try {
      await api.post("/api/saved-searches", {
        name,
        keyword: debouncedSearch.trim() || search.trim(),
        location: filterLocation || "",
        type: filterType || "",
        field: filterField || "",
        salary: filterSalary || "",
        sort: jobSortMode === "bestMatch" ? "bestMatch" : "recent",
        alertEnabled: saveSearchAlert,
      });
      toast.success("Search saved.");
      setSaveSearchModalOpen(false);
      await refreshSavedSearches();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Could not save search";
      if (err.response?.status === 409) {
        setSaveSearchError(msg);
        return;
      }
      toast.error(msg);
    }
  };

  const deleteSavedSearch = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await api.delete(`/api/saved-searches/${id}`);
      toast.success("Saved search removed.");
      await refreshSavedSearches();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Could not delete");
    }
  };

  const applySavedSearchChip = (s) => {
    setActiveTab("findJobs");
    setSearch(String(s.keyword ?? ""));
    setFilterLocation(String(s.location ?? ""));
    setFilterType(String(s.type ?? ""));
    setFilterField(String(s.field ?? ""));
    const sal = String(s.salary ?? "");
    if (FIND_SALARY_BANDS.some((b) => b.value === sal)) setFilterSalary(sal);
    else setFilterSalary("");
    const sort = String(s.sort ?? "");
    setJobSortMode(sort === "bestMatch" ? "bestMatch" : "recent");
    toast.success(`Applied “${s.name}”.`);
  };

  const onOpenBestMatchJobs = useCallback(() => {
    setActiveTab("findJobs");
    setJobSortMode("bestMatch");
  }, []);

  const onJumpToSavedSearchesBoard = useCallback(() => {
    setActiveTab("findJobs");
    requestAnimationFrame(() => scrollSavedSearchesIntoView());
  }, [scrollSavedSearchesIntoView]);

  const onTuneCvRail = useCallback(() => {
    const id = user?.id ?? user?._id;
    if (id) navigate(`/candidate-profile/${id}`, { state: { focusCv: true } });
  }, [navigate, user]);

  const onTrendingKeywordRail = useCallback((raw) => {
    const kw = typeof raw === "string" ? raw.replace(/^#/, "").trim() : "";
    if (!kw) return;
    setActiveTab("findJobs");
    setSearch(kw);
  }, []);

  const candidateRailContext = useMemo(
    () => ({
      navigate,
      uid,
      specialization: String(user?.specialization || "").trim(),
      interviewsMine,
      savedSearchList,
      networkCompanies: networkCompaniesRail,
      recentViewedJobs,
      hasActiveJobFilters,
      allMatchesWeak,
      notifUnread,
      onSaveSearchOpen: openSaveSearchModal,
      onScrollSavedSearches: scrollSavedSearchesIntoView,
      onJumpToSavedSearchesBoard,
      onOpenBestMatchJobs,
      onTuneCvRail,
      onTrendingKeyword: onTrendingKeywordRail,
      onOpenRecentJob: openJobModalById,
      setCandidateTab: setActiveTab,
    }),
    [
      navigate,
      uid,
      user,
      interviewsMine,
      savedSearchList,
      networkCompaniesRail,
      recentViewedJobs,
      hasActiveJobFilters,
      allMatchesWeak,
      notifUnread,
      openSaveSearchModal,
      scrollSavedSearchesIntoView,
      onJumpToSavedSearchesBoard,
      onOpenBestMatchJobs,
      onTuneCvRail,
      onTrendingKeywordRail,
      openJobModalById,
      setActiveTab,
    ]
  );

  const renderDashboardHome = () => (
    <>
      <div className="subtabs">
        <button className="subtab active">Dashboard</button>
        <button className="subtab" onClick={() => setActiveTab("findJobs")}>
          Find Jobs
        </button>
        <button
          className="subtab"
          onClick={() => setActiveTab("applications")}
        >
          My Applications
        </button>
        <button className="subtab" onClick={() => setActiveTab("savedJobs")}>
          Saved Jobs
        </button>
      </div>

      {loadErr && (
        <div
          className="lc-dash-load-err"
          style={{
            marginBottom: "1rem",
            padding: "16px 18px",
            borderRadius: "16px",
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#991b1b",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div>
            <strong style={{ display: "block", marginBottom: "4px" }}>
              Dashboard data could not load
            </strong>
            <span style={{ fontSize: "14px", fontWeight: 500 }}>
              Showing sample jobs and applications. Check your connection or try again.
            </span>
          </div>
          <button
            type="button"
            className="primary-btn lc-btn-hit"
            style={{ flexShrink: 0 }}
            onClick={() => void loadDashboardData()}
          >
            Retry
          </button>
        </div>
      )}

      <div className="welcome-card">
        <div>
          <p className="welcome-small">Welcome back,</p>
          <h2>{displayName}! 👋</h2>
          <p className="welcome-text">
            You have notifications and messages on your feed.
          </p>
        </div>

        <button
          type="button"
          className="primary-btn lc-btn-hit"
          onClick={() => setActiveTab("findJobs")}
        >
          <Search size={17} strokeWidth={2} aria-hidden />
          Find Jobs
        </button>
      </div>

      <div className="stats-cards lc-dash-stats">
        <div className="mini-stat-card lc-mini-stat">
          <div className="mini-icon blue-bg lc-mini-ico">
            <FileText size={22} strokeWidth={2} aria-hidden />
          </div>
          <h3>{applications.length}</h3>
          <p>Applications</p>
        </div>

        <div className="mini-stat-card lc-mini-stat">
          <div className="mini-icon green-bg lc-mini-ico">
            <Heart size={22} strokeWidth={2} aria-hidden />
          </div>
          <h3>{savedJobs.length}</h3>
          <p>Saved Jobs</p>
        </div>

        <button
          type="button"
          className={`mini-stat-card lc-mini-stat lc-messages-stat-hit${messagesUnreadKnown ? "" : " lc-mini-stat--ghost"}`}
          onClick={() => navigate("/messages")}
        >
          <div className="mini-icon orange-bg lc-mini-ico">
            <MessageSquare size={22} strokeWidth={2} aria-hidden />
          </div>
          <h3>{messagesUnreadKnown ? messagesUnread : "—"}</h3>
          <p>Messages</p>
          <span className="lc-stat-demo">View conversations</span>
        </button>

        <div className="mini-stat-card lc-mini-stat lc-mini-stat--ghost">
          <div className="mini-icon purple-bg lc-mini-ico">
            <Sparkles size={22} strokeWidth={2} aria-hidden />
          </div>
          <h3 aria-hidden>—</h3>
          <p>Profile reach</p>
          <span className="lc-stat-demo">Insights soon</span>
        </div>
      </div>

      <section
        className="lc-dash-widgets lc-dash-widgets--full"
        aria-label="Quick actions"
      >
        <div className="lc-widget lc-widget--quick lc-glass-card lc-dash-cell">
          <h3 className="lc-widget-title">
            <Sparkles size={18} strokeWidth={2} aria-hidden />
            Quick actions
          </h3>
          <div className="lc-quick-grid lc-quick-grid--six">
            <button
              type="button"
              className="lc-quick-hit lc-btn-hit"
              onClick={() => {
                const id = user?.id ?? user?._id;
                if (id) navigate(`/candidate-profile/${id}`);
              }}
            >
              <UserRound size={20} strokeWidth={2} aria-hidden />
              <span>Complete profile</span>
            </button>
            <button
              type="button"
              className="lc-quick-hit lc-btn-hit"
              onClick={() =>
                navigate("/candidate-dashboard", {
                  state: { tab: "findJobs", sortJobs: "bestMatch" },
                })
              }
            >
              <Briefcase size={20} strokeWidth={2} aria-hidden />
              <span>Matching jobs</span>
            </button>
            <button
              type="button"
              className="lc-quick-hit lc-btn-hit"
              onClick={() => {
                if (location.pathname === "/candidate-dashboard") {
                  setActiveTab("findJobs");
                  requestAnimationFrame(() => scrollSavedSearchesIntoView());
                } else {
                  navigate("/candidate-dashboard", {
                    state: { tab: "findJobs", focusSavedSearches: true },
                  });
                }
              }}
            >
              <Bookmark size={20} strokeWidth={2} aria-hidden />
              <span>Saved searches</span>
            </button>
            <button
              type="button"
              className="lc-quick-hit lc-btn-hit"
              onClick={() => navigate("/notifications")}
            >
              <Bell size={20} strokeWidth={2} aria-hidden />
              <span>Notifications</span>
            </button>
            <button
              type="button"
              className="lc-quick-hit lc-btn-hit"
              onClick={() => navigate("/messages?admin=true")}
            >
              <LifeBuoy size={20} strokeWidth={2} aria-hidden />
              <span>Message support</span>
            </button>
            <button
              type="button"
              className="lc-quick-hit lc-btn-hit"
              onClick={() => {
                const id = user?.id ?? user?._id;
                if (id) {
                  navigate(`/candidate-profile/${id}`, { state: { focusCv: true } });
                }
              }}
            >
              <Upload size={20} strokeWidth={2} aria-hidden />
              <span>Upload CV</span>
            </button>
            <button
              type="button"
              className="lc-quick-hit lc-btn-hit"
              onClick={() => navigate(FEED_PATH)}
            >
              <Newspaper size={20} strokeWidth={2} aria-hidden />
              <span>Feed</span>
            </button>
          </div>
        </div>
      </section>

      <section className="lc-dash-section-grid" aria-label="Profile strength and CV keywords">
        <div className="lc-widget lc-widget--meter lc-glass-card lc-dash-cell">
          <h3 className="lc-widget-title">Profile strength</h3>
          <div
            className="lc-meter-track"
            role="progressbar"
            aria-valuenow={profileStrengthPct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="lc-meter-fill"
              style={{ width: `${profileStrengthPct}%` }}
            />
          </div>
          <p className="lc-meter-copy">
            {profileStrengthPct >= 85
              ? "Strong presence — keep sharing updates."
              : "Complete your checklist to stand out to employers."}{" "}
            <button
              type="button"
              className="lc-inline-link-btn"
              onClick={() => {
                const id = user?.id ?? user?._id;
                if (id) navigate(`/candidate-profile/${id}`);
              }}
            >
              Complete profile →
            </button>
          </p>
          {profileStrength.checklist?.length ? (
            <ul className="lc-strength-checklist lc-strength-checklist--actions">
              {(profileStrength.items || [])
                .filter((it) => !it.ok)
                .slice(0, 8)
                .map((it) => (
                  <li key={it.key}>
                    <button
                      type="button"
                      className="lc-inline-link-btn"
                      onClick={() => {
                        const id = user?.id ?? user?._id;
                        if (id)
                          navigate(`/candidate-profile/${id}`, {
                            state:
                              it.key === "cv"
                                ? { focusCv: true }
                                : { openEdit: true },
                          });
                      }}
                    >
                      {it.label}
                    </button>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="lc-widget-footnote" style={{ color: "#166534", fontWeight: 600 }}>
              Profile checklist looks complete — keep skills and CV current.
            </p>
          )}
          <p className="lc-widget-footnote">
            Computed on-device from profile fields — not third-party scoring.
          </p>
        </div>
        <div className="lc-dash-cell lc-dash-cell--cv lc-glass-card">
          <h3 className="lc-widget-title">
            <Upload size={18} strokeWidth={2} aria-hidden />
            CV Keyword Analysis
          </h3>
          <p className="lc-meter-copy">
            Analyze your CV from your profile to improve job matches.
          </p>
          <button
            type="button"
            className="lc-btn lc-btn--primary lc-btn-hit"
            onClick={() => {
              const id = user?.id ?? user?._id;
              if (id) {
                navigate(`/candidate-profile/${id}`, {
                  state: { openSection: "cv-analysis" },
                });
              }
            }}
          >
            Open CV Analysis
          </button>
          <p className="lc-widget-footnote">
            Run analysis and view full results from your profile page.
          </p>
        </div>
      </section>

      <section
        className="lc-dash-section-grid lc-dash-section-grid--stack-peers"
        aria-label="Interviews and people in your field"
      >
        <div className="lc-widget lc-glass-card lc-widget--interviews lc-dash-cell">
          <h3 className="lc-widget-title lc-widget-title--compact">
            <Calendar size={16} strokeWidth={2} aria-hidden />
            Upcoming interviews
          </h3>
          {interviewsMine.length === 0 ? (
            <div className="lc-interview-empty lc-interview-empty--compact">
              <p>No upcoming interviews yet.</p>
              <button
                type="button"
                className="lc-btn lc-btn--primary lc-btn-hit lc-interview-browse-btn"
                onClick={() => setActiveTab("findJobs")}
              >
                Browse jobs
              </button>
            </div>
          ) : (
            <ul className="lc-interview-list lc-interview-list--compact">
              {interviewsMine.slice(0, 24).map((iv) => {
                const { dateStr, timeStr } = formatInterviewSlots(iv.scheduledAt);
                const modeLabel =
                  iv.mode === "office" ? "Office" : "Online";
                const showCancel = interviewCanCancel(iv);
                const statusLabel =
                  iv.status
                    ? String(iv.status).replace(/_/g, " ")
                    : "Scheduled";
                const nid = iv.id != null ? String(iv.id) : "";
                const savedNote = nid ? interviewNotes[nid] || "" : "";
                const isEditing = interviewNoteEditId === iv.id;

                const persistNotes = (nextMap) => {
                  setInterviewNotes(nextMap);
                  writeInterviewNotesMap(nextMap);
                };

                const ivKey = Number.isFinite(interviewNumericId(iv))
                  ? `iv-${interviewNumericId(iv)}`
                  : `iv-${String(iv.scheduledAt || "")}-${iv.jobTitle || ""}`;
                return (
                  <li key={ivKey} className="lc-interview-item">
                    <div className="lc-interview-item-row">
                      <div className="lc-interview-item-text">
                        <div className="lc-interview-item-title-line">
                          <span className="lc-interview-item-co">{iv.companyName || "Company"}</span>
                          <span className="lc-interview-item-dot" aria-hidden>
                            ·
                          </span>
                          <span className="lc-interview-item-job">
                            {iv.jobTitle || "Interview"}
                          </span>
                        </div>
                        <div className="lc-interview-item-datetime">
                          {dateStr} · {timeStr} · {modeLabel}
                        </div>
                      </div>
                      <div className="lc-interview-item-actions">
                        <span
                          className="lc-interview-badge lc-interview-badge--scheduled"
                          title={statusLabel}
                        >
                          {statusLabel}
                        </span>
                        {showCancel ? (
                          <button
                            type="button"
                            className="lc-interview-btn-cancel-outline lc-btn-hit"
                            onClick={() => setInterviewCancelTarget(iv)}
                          >
                            Cancel
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {iv.locationOrLink ? (
                      <div className="lc-interview-item-extra lc-interview-item-extra--loc">
                        {/^https?:\/\//i.test(String(iv.locationOrLink).trim()) ? (
                          <a
                            href={String(iv.locationOrLink).trim()}
                            target="_blank"
                            rel="noreferrer"
                            className="lc-interview-link lc-interview-link--inline"
                          >
                            {iv.mode === "office" ? "Directions / link" : "Meeting link"}
                          </a>
                        ) : (
                          <span>{String(iv.locationOrLink).trim()}</span>
                        )}
                      </div>
                    ) : null}
                    {iv.message ? (
                      <p className="lc-interview-msg-muted" title={String(iv.message).trim()}>
                        <span className="lc-interview-msg-muted-label">Note</span>
                        {compactInterviewSnippet(iv.message)}
                      </p>
                    ) : null}

                    <details className="lc-interview-details">
                      <summary className="lc-interview-details-summary">
                        Private note
                        {savedNote && !isEditing ? " · saved" : ""}
                      </summary>
                      <div className="lc-interview-details-body">
                        {isEditing ? (
                          <div className="lc-interview-note-editor lc-interview-note-editor--compact">
                            <label className="lc-interview-note-label" htmlFor={`int-note-${iv.id}`}>
                              Stored only on this device
                            </label>
                            <textarea
                              id={`int-note-${iv.id}`}
                              className="lc-interview-note-input lc-interview-note-input--compact"
                              rows={2}
                              placeholder="e.g. Prepare questions"
                              value={interviewNoteDraft}
                              onChange={(e) => setInterviewNoteDraft(e.target.value)}
                            />
                            <div className="lc-interview-note-actions">
                              <button
                                type="button"
                                className="lc-btn lc-btn--secondary lc-btn-hit lc-interview-mini-btn"
                                onClick={() => {
                                  setInterviewNoteEditId(null);
                                  setInterviewNoteDraft("");
                                }}
                              >
                                Close
                              </button>
                              <button
                                type="button"
                                className="lc-btn lc-btn--primary lc-btn-hit lc-interview-mini-btn"
                                onClick={() => {
                                  if (!nid) return;
                                  const next = { ...interviewNotes };
                                  const t = interviewNoteDraft.trim();
                                  if (t) next[nid] = t;
                                  else delete next[nid];
                                  persistNotes(next);
                                  setInterviewNoteEditId(null);
                                  setInterviewNoteDraft("");
                                }}
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : savedNote ? (
                          <div className="lc-interview-note-block lc-interview-note-block--compact">
                            <p className="lc-interview-note-text">{savedNote}</p>
                            <div className="lc-interview-note-actions">
                              <button
                                type="button"
                                className="lc-inline-link-btn"
                                onClick={() => {
                                  setInterviewNoteEditId(iv.id);
                                  setInterviewNoteDraft(savedNote);
                                }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="lc-inline-link-btn"
                                onClick={() => {
                                  if (!nid) return;
                                  const next = { ...interviewNotes };
                                  delete next[nid];
                                  persistNotes(next);
                                  setInterviewNoteEditId(null);
                                  setInterviewNoteDraft("");
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="lc-btn lc-btn--secondary lc-btn-hit lc-interview-mini-btn lc-interview-add-note-btn"
                            onClick={() => {
                              setInterviewNoteEditId(iv.id);
                              setInterviewNoteDraft("");
                            }}
                          >
                            <StickyNote size={14} strokeWidth={2} aria-hidden />
                            Add note
                          </button>
                        )}
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="lc-widget lc-glass-card lc-widget--people-field lc-dash-cell">
          <h3 className="lc-widget-title">
            <Users size={17} strokeWidth={2} aria-hidden />
            People in your field
          </h3>
          <p className="lc-widget-subtitle">
            Professionals with similar interests and specialization.
          </p>
          {sameFieldNetworkFailed || sameFieldPeople.length === 0 ? (
            <div className="lc-empty-state lc-empty-state--nested" role="status">
              <strong>No people found in your field yet.</strong>
              <span>
                {!sameFieldNetworkFailed
                  ? "Try updating your specialization on your profile to discover more peers."
                  : "We couldn't load suggestions. Check your connection and try refreshing the dashboard."}
              </span>
            </div>
          ) : (
            <>
              <div className="lc-people-field-grid">
                {sameFieldPeople.slice(0, 3).map((p) => {
                  const pid = p.id ?? p._id;
                  const name =
                    (typeof p.fullName === "string" && p.fullName.trim()) ||
                    (typeof p.full_name === "string" && p.full_name.trim()) ||
                    `Member ${pid}`;
                  const roleLine =
                    (typeof p.specialization === "string" && p.specialization.trim()) ||
                    "Professional";
                  const loc =
                    (typeof p.location === "string" && p.location.trim()) || "";
                  const img =
                    typeof p.profileImage === "string"
                      ? p.profileImage.trim()
                      : typeof p.profile_image === "string"
                        ? p.profile_image.trim()
                        : "";
                  const following =
                    pid != null && followedSetSafe.has(String(pid));

                  return (
                    <article key={pid} className="lc-people-field-card">
                      <button
                        type="button"
                        className="lc-people-field-profile-hit lc-btn-hit"
                        onClick={() => navigate(`/candidate-profile/${pid}`)}
                      >
                        <UserAvatar
                          name={name}
                          src={isDisplayableMediaUrl(img) ? img : undefined}
                          size={44}
                          className="lc-people-field-avatar"
                        />
                        <div className="lc-people-field-head-text">
                          <span className="lc-people-field-name">{name}</span>
                          <span className="lc-people-field-role">{roleLine}</span>
                          {loc ? (
                            <span className="lc-people-field-loc">
                              <MapPin size={14} strokeWidth={2} aria-hidden />
                              {loc}
                            </span>
                          ) : null}
                          <span className="lc-badge lc-badge--primary lc-people-field-mutual lc-people-field-mutual--inline">
                            Same field
                          </span>
                        </div>
                      </button>
                      <div className="lc-people-field-actions">
                        <button
                          type="button"
                          className={`lc-btn lc-btn--secondary lc-btn-hit lc-people-follow-btn lc-people-follow-btn--compact ${
                            following ? "lc-people-follow-btn--on" : ""
                          }`}
                          disabled={followBusyUserId === Number(pid)}
                          onClick={(e) => void toggleFollowPerson(e, pid)}
                        >
                          <UserPlus size={16} strokeWidth={2} aria-hidden />
                          {following ? "Following" : "Follow"}
                        </button>
                        <button
                          type="button"
                          className="lc-btn lc-btn--primary lc-btn-hit lc-people-follow-btn--compact"
                          onClick={() => navigate(`/candidate-profile/${pid}`)}
                        >
                          View Profile
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
              {sameFieldPeople.length > 3 ? (
                <button
                  type="button"
                  className="lc-people-field-more lc-btn-hit"
                  onClick={() => navigate(FEED_PATH)}
                >
                  View more
                </button>
              ) : null}
            </>
          )}
        </div>
      </section>

      <div className="panel-card lc-panel-card">
        <div className="panel-head">
          <h3>Recent Applications</h3>
          <button
            type="button"
            className="link-like"
            style={{
              background: "none",
              border: "none",
              color: "inherit",
              cursor: "pointer",
            }}
            onClick={() => setActiveTab("applications")}
          >
            View all
          </button>
        </div>

        <div className="recent-apps">
          {applications.slice(0, 3).map((a) => (
            <div className="recent-app-item" key={String(a.apiId ?? a.title) + a.date}>
              <div>
                <h4>{a.title}</h4>
                <p>
                  {a.company}
                  {a.jobLocation ? ` · ${a.jobLocation}` : ""}
                  {a.date ? ` · ${a.date.replace("Applied on ", "")}` : ""}
                </p>
              </div>
              <span className={`status-pill lc-status-pill lc-status-pill--${a.color}`}>
                {a.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel-card">
        <div className="panel-head">
          <h3>Recommended for You</h3>
          <button
            type="button"
            style={{
              background: "none",
              border: "none",
              color: "inherit",
              cursor: "pointer",
            }}
            onClick={() => setActiveTab("findJobs")}
          >
            See all
          </button>
        </div>

        <div className="recommended-list">
          {jobs.length === 0 ? (
            <p style={{ opacity: 0.8 }}>No job listings yet.</p>
          ) : (
            jobs.slice(0, 4).map((job) => (
              <div className="simple-job-row" key={`${job.title}-${job.apiId}`}>
                <div className="simple-job-left">
                  <div className={`job-logo ${job.logoClass}`}>{job.logo}</div>
                  <div>
                    <div className="lc-job-title-row">
                      <h4>{job.title}</h4>
                      <JobMatchBadge
                        user={matchUser}
                        rawJob={job.rawJob}
                        matchDetail={calculateJobMatch(matchUser, job.rawJob)}
                        whyLabel="short"
                      />
                    </div>
                    <p>{job.company}</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="apply-small-btn"
                  onClick={() => openApplyModalFromJobCard(job)}
                  disabled={job.status === "Applied"}
                >
                  {job.status === "Applied" ? "Applied" : "Apply"}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );

  const renderFindJobs = () => (
    <>
      <div className="subtabs">
        <button className="subtab" onClick={() => setActiveTab("dashboard")}>
          Dashboard
        </button>
        <button className="subtab active">Find Jobs</button>
        <button
          className="subtab"
          onClick={() => setActiveTab("applications")}
        >
          My Applications
        </button>
        <button className="subtab" onClick={() => setActiveTab("savedJobs")}>
          Saved Jobs
        </button>
      </div>

      <section
        className="filters-bar lc-filters-bar lc-filters-bar--find-jobs"
        aria-label="Search and filter jobs"
      >
        <div className="lc-find-jobs-search-row">
          <div className="inner-search lc-filter-search">
            <Search className="lc-filter-search-ico" size={20} strokeWidth={2} aria-hidden />
            <input
              type="search"
              className="lc-find-jobs-search-input"
              placeholder="Search jobs or companies…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
              enterKeyHint="search"
            />
          </div>
        </div>

        <div className="lc-find-jobs-filters-row">
          <select
            className="lc-filter-select lc-find-jobs-filter-control"
            aria-label="Location filter"
            value={filterLocation}
            onChange={(e) => setFilterLocation(e.target.value)}
          >
            <option value="">All locations</option>
            {FIND_JOB_LOCATIONS.filter(Boolean).map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>

          <select
            className="lc-filter-select lc-find-jobs-filter-control"
            aria-label="Job type filter"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">All types</option>
            {FIND_JOB_TYPES.filter(Boolean).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <select
            className="lc-filter-select lc-find-jobs-filter-control"
            aria-label="Industry or role focus"
            value={filterField}
            onChange={(e) => setFilterField(e.target.value)}
          >
            {FIND_FIELD_HINTS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <select
            className="lc-filter-select lc-find-jobs-filter-control"
            aria-label="Salary filter"
            value={filterSalary}
            onChange={(e) => setFilterSalary(e.target.value)}
          >
            {FIND_SALARY_BANDS.map((o) => (
              <option key={o.value || "any"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <select
            className="lc-filter-select lc-find-jobs-filter-control"
            aria-label="Sort jobs"
            value={jobSortMode}
            onChange={(e) => setJobSortMode(e.target.value)}
          >
            <option value="recent">Sort: Recent</option>
            <option value="bestMatch">Sort: Best match</option>
          </select>

          <button
            type="button"
            className="lc-find-jobs-clear-btn lc-btn-hit"
            disabled={!hasActiveJobFilters}
            onClick={clearFindJobFilters}
            title="Clear search and filters"
          >
            Clear all
          </button>

          <button
            type="button"
            className="lc-save-search-btn lc-save-search-btn--premium lc-btn-hit"
            onClick={openSaveSearchModal}
            title="Save the current filters to reuse later"
          >
            Save Search
          </button>
        </div>
      </section>

      <div
        id="lc-saved-searches-anchor"
        className="lc-saved-search-board"
        role="region"
        aria-label="Saved job searches"
      >
        <div className="lc-saved-search-board-head">
          <h3 className="lc-saved-search-board-title">Saved searches</h3>
          <span className="lc-saved-search-board-hint">
            Tap a saved search to apply filters and reload results
          </span>
        </div>
        {savedSearchList.length ? (
          <div className="lc-saved-search-cards">
            {savedSearchList.map((s) => (
              <div key={s.id} className="lc-saved-search-card">
                <button
                  type="button"
                  className="lc-saved-search-card-hit"
                  onClick={() => applySavedSearchChip(s)}
                >
                  <span className="lc-saved-search-card-name">{s.name}</span>
                  <span className="lc-saved-search-card-sub">{savedSearchSummary(s)}</span>
                  {s.alertEnabled ? (
                    <span className="lc-saved-search-card-badge">Job alerts on</span>
                  ) : null}
                </button>
                <button
                  type="button"
                  className="lc-saved-search-card-del"
                  aria-label={`Delete saved search ${s.name}`}
                  onClick={(e) => void deleteSavedSearch(e, s.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="lc-saved-search-empty">
            No saved searches yet. Save filters to reuse them later.
          </p>
        )}
      </div>

      <div className="lc-find-jobs-toolbar">
        <p className="results-count lc-results-count">
          {displayJobs.length}{" "}
          {displayJobs.length === 1 ? "job" : "jobs"} found
        </p>
      </div>

      {allMatchesWeak ? (
        <p className="lc-match-weak-banner">
          Complete your profile to improve matches — add skills, location, and your CV on My Profile.
        </p>
      ) : null}

      {displayJobs.length === 0 ? (
        <div className="lc-empty-state lc-find-empty">
          <strong>No roles match these filters</strong>
          <span>
            Adjust keywords or clear filters to see more listings from the
            API. Salary and role focus refine results on top of location and job
            type.
          </span>
          {hasActiveJobFilters ? (
            <button
              type="button"
              className="lc-btn lc-btn--secondary lc-btn-hit"
              onClick={clearFindJobFilters}
            >
              Clear all filters
            </button>
          ) : (
            <button
              type="button"
              className="lc-btn lc-btn--secondary lc-btn-hit"
              onClick={() => navigate(FEED_PATH)}
            >
              Explore the feed
            </button>
          )}
        </div>
      ) : (
      <div className="job-list">
        {displayJobs.map((job) => (
          <div
            className="find-job-card lc-job-card-premium"
            key={`${job.title}-${job.apiId ?? job.company}`}
          >
            <div className="find-job-left">
              <div className={`job-logo ${job.logoClass}`}>{job.logo}</div>

              <div className="find-job-info">
                <div className="lc-job-title-row">
                  <h3>{job.title}</h3>
                  <JobMatchBadge
                    user={matchUser}
                    rawJob={job.rawJob}
                    matchDetail={job.matchDetail}
                    showWhy
                    whyLabel="long"
                  />
                </div>
                <p
                  className="company-line lc-link"
                  role={job.companyId ? "button" : undefined}
                  tabIndex={job.companyId ? 0 : undefined}
                  onClick={() =>
                    job.companyId &&
                    navigate(`/company-profile/${job.companyId}`)
                  }
                  onKeyDown={(e) =>
                    job.companyId &&
                    e.key === "Enter" &&
                    navigate(`/company-profile/${job.companyId}`)
                  }
                >
                  {job.company}
                </p>

                <div className="job-tags">
                  <span className="tag tag-location">
                    <MapPin size={14} strokeWidth={2} aria-hidden />
                    {job.location}
                  </span>
                  <span className="tag tag-type">
                    <Briefcase size={14} strokeWidth={2} aria-hidden />
                    {job.type}
                  </span>
                  <span className="tag tag-salary">{job.salary}</span>
                </div>

                <p className="meta-line lc-meta-line-icons">
                  <Users size={15} strokeWidth={2} aria-hidden />
                  {job.applicants} applicants · {job.time}
                </p>
              </div>
            </div>

            <div className="find-job-right lc-job-actions-stack">
              <button
                type="button"
                className={`lc-job-save-hit ${job.saved ? "lc-job-save-hit--saved" : ""}`}
                onClick={() => toggleSave(job)}
                title={job.saved ? "Remove from saved" : "Save job"}
                aria-pressed={job.saved}
              >
                <Heart
                  size={20}
                  strokeWidth={2}
                  fill={job.saved ? "currentColor" : "none"}
                  aria-hidden
                />
              </button>
              <button
                type="button"
                className="apply-small-btn lc-job-view-btn lc-btn-hit"
                onClick={() => job.apiId && openJobModalById(job.apiId)}
                disabled={!job.apiId}
              >
                View details
              </button>
              <button
                type="button"
                className={`lc-btn-hit ${job.status === "Applied" ? "applied-btn" : "apply-btn"}`}
                onClick={() =>
                  job.status === "Applied"
                    ? null
                    : openApplyModalFromJobCard(job)
                }
                disabled={job.status === "Applied"}
              >
                {job.status === "Applied" ? "Applied" : "Apply now"}
              </button>
            </div>
          </div>
        ))}
      </div>
      )}
    </>
  );

  const renderApplications = () => (
    <>
      <div className="subtabs">
        <button className="subtab" onClick={() => setActiveTab("dashboard")}>
          Dashboard
        </button>
        <button className="subtab" onClick={() => setActiveTab("findJobs")}>
          Find Jobs
        </button>
        <button className="subtab active">My Applications</button>
        <button className="subtab" onClick={() => setActiveTab("savedJobs")}>
          Saved Jobs
        </button>
      </div>

      <div className="application-summary lc-app-summary">
        <div className="summary-card lc-app-summary-card lc-app-summary-card--pending">
          <div className="mini-icon yellow-bg lc-mini-ico">
            <Clock size={22} strokeWidth={2} aria-hidden />
          </div>
          <h3>
            {applications.filter((x) => x.status === "Pending").length}
          </h3>
          <p>In review</p>
        </div>

        <div className="summary-card lc-app-summary-card lc-app-summary-card--accepted">
          <div className="mini-icon green-bg lc-mini-ico">
            <CheckCircle size={22} strokeWidth={2} aria-hidden />
          </div>
          <h3>
            {applications.filter((x) => x.status === "Accepted").length}
          </h3>
          <p>Accepted</p>
        </div>

        <div className="summary-card lc-app-summary-card lc-app-summary-card--rejected">
          <div className="mini-icon red-bg lc-mini-ico">
            <XCircle size={22} strokeWidth={2} aria-hidden />
          </div>
          <h3>
            {applications.filter((x) => x.status === "Rejected").length}
          </h3>
          <p>Rejected</p>
        </div>
      </div>

      <div
        className="application-tabs lc-app-tabs lc-app-tabs--filter"
        role="tablist"
        aria-label="Filter applications by status"
      >
        {[
          { id: "all", label: "All" },
          { id: "pending", label: "Pending" },
          { id: "accepted", label: "Accepted" },
          { id: "rejected", label: "Rejected" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={applicationFilter === tab.id}
            className={`app-tab lc-app-filter-tab ${applicationFilter === tab.id ? "active" : ""}`}
            onClick={() => setApplicationFilter(tab.id)}
          >
            <span>{tab.label}</span>
            <span className="lc-app-filter-count">
              {applicationTabCounts[tab.id] ?? 0}
            </span>
          </button>
        ))}
      </div>

      <div className="applications-list lc-applications-list">
        {filteredApplications.length === 0 ? (
          (() => {
            const copy = applicationsEmptyCopy(
              applicationFilter,
              Array.isArray(applications) ? applications.length : 0
            );
            return (
              <div className="lc-empty-state lc-app-list-empty">
                <strong>{copy.title}</strong>
                <span>{copy.hint}</span>
                <button
                  type="button"
                  className="lc-btn lc-btn--primary lc-btn-hit"
                  onClick={() => setActiveTab("findJobs")}
                >
                  Browse jobs
                </button>
              </div>
            );
          })()
        ) : (
          filteredApplications.map((item) => {
            const coInitials = initialsFromName(item.company || item.title || "Co").slice(0, 4);
            const logoSrc =
              typeof item.companyLogo === "string" && isDisplayableMediaUrl(item.companyLogo)
                ? item.companyLogo.trim()
                : "";

            return (
              <div
                className={`application-card lc-app-card lc-app-card--${item.color}`}
                key={item.apiId ?? `${item.title}-${item.date}`}
              >
                <div className="application-left lc-app-card-main">
                  {logoSrc ? (
                    <img
                      src={logoSrc}
                      alt=""
                      className="lc-app-co-logo lc-app-co-logo--img"
                    />
                  ) : (
                    <div className="job-logo logo-tech lc-app-co-logo">{coInitials}</div>
                  )}

                  <div className="lc-app-card-body">
                    <div className="lc-app-card-title-row">
                      <h3>{item.title}</h3>
                      <span className={`status-pill lc-status-pill lc-status-pill--${item.color}`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="lc-app-meta-row lc-app-meta-row--company">
                      <Building2 size={15} strokeWidth={2} aria-hidden />
                      {item.company}
                    </p>
                    {item.jobLocation ? (
                      <p className="lc-app-meta-row">
                        <MapPin size={15} strokeWidth={2} aria-hidden />
                        {item.jobLocation}
                      </p>
                    ) : null}
                    <p className="lc-app-meta-row">
                      <Calendar size={15} strokeWidth={2} aria-hidden />
                      {item.date || "Date unavailable"}
                    </p>
                    <div className="lc-app-pipeline-wrap">
                      <ApplicationPipeline stage={item.raw?.stage} status={item.raw?.status} />
                    </div>
                    {item.coverMessage ? (
                      <div className="lc-app-message-block">
                        <span className="lc-app-message-label">
                          <MessageSquare size={14} strokeWidth={2} aria-hidden />
                          Your message
                        </span>
                        <p className="lc-app-message-text">{item.coverMessage}</p>
                      </div>
                    ) : null}
                    <div className="lc-app-cv-row">
                      <span className="lc-app-meta-row lc-app-meta-row--muted">
                        <Paperclip size={15} strokeWidth={2} aria-hidden />
                        {item.cvLabel || "No CV filename on file"}
                      </span>
                      {item.apiId ? (
                        <button
                          type="button"
                          className="lc-btn lc-btn--ghost lc-btn-hit lc-app-cv-btn"
                          onClick={() => void openApplicationCv(item.apiId)}
                        >
                          <FileText size={16} strokeWidth={2} aria-hidden />
                          View CV
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="application-right lc-app-card-aside">
                  <div className="application-actions lc-app-card-actions">
                    <button
                      type="button"
                      className="view-job-btn lc-btn-hit"
                      onClick={() => openJobModalById(item.jobId)}
                      disabled={!item.jobId}
                    >
                      View Job
                    </button>
                    {item.companyId ? (
                      <button
                        type="button"
                        className="message-btn lc-btn-hit"
                        onClick={() =>
                          navigate(`/messages?userId=${encodeURIComponent(String(item.companyId))}`)
                        }
                      >
                        <MessageSquare size={16} strokeWidth={2} aria-hidden />
                        Message Company
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );

  const renderSavedJobs = () => (
    <>
      <div className="subtabs">
        <button className="subtab" onClick={() => setActiveTab("dashboard")}>
          Dashboard
        </button>
        <button className="subtab" onClick={() => setActiveTab("findJobs")}>
          Find Jobs
        </button>
        <button
          className="subtab"
          onClick={() => setActiveTab("applications")}
        >
          My Applications
        </button>
        <button className="subtab active">Saved Jobs</button>
      </div>

      <p className="results-count lc-results-count">
        {savedJobs.length} saved {savedJobs.length === 1 ? "job" : "jobs"}
      </p>

      {savedJobs.length === 0 ? (
        <div className="lc-empty-state lc-saved-empty">
          <strong>No saved jobs yet</strong>
          <span>
            Tap the heart on any listing to keep it here for quick access later.
          </span>
          <button
            type="button"
            className="lc-btn lc-btn--primary lc-btn-hit"
            onClick={() => setActiveTab("findJobs")}
          >
            Discover jobs
          </button>
        </div>
      ) : null}

      <div className="saved-list">
        {savedJobs.map((job) => (
          <div
            className="saved-job-card lc-job-card-premium lc-saved-job-card"
            key={job.apiId ?? job.title}
          >
            <div className="saved-job-left">
              <div className={`job-logo ${job.logoClass}`}>{job.logo}</div>
              <div className="find-job-info">
                <h3>{job.title}</h3>
                <p className="company-line">{job.company}</p>

                <div className="job-tags">
                  <span className="tag tag-type">
                    <Briefcase size={14} strokeWidth={2} aria-hidden />
                    {job.type}
                  </span>
                  <span className="tag tag-salary">{job.salary}</span>
                </div>
              </div>
            </div>

            <div className="find-job-right lc-job-actions-stack">
              <button
                type="button"
                className="lc-job-save-hit lc-job-save-hit--saved"
                onClick={() => toggleSave({ ...job, saved: true })}
                title="Remove from saved"
                aria-pressed
              >
                <Heart size={20} strokeWidth={2} fill="currentColor" aria-hidden />
              </button>
              <button
                type="button"
                className="apply-small-btn lc-job-view-btn lc-btn-hit"
                onClick={() => job.apiId && openJobModalById(job.apiId)}
                disabled={!job.apiId}
              >
                View details
              </button>
              <button
                type="button"
                className="apply-btn lc-btn-hit"
                onClick={() =>
                  openApplyModalFromJobCard({
                    apiId: job.apiId,
                    title: job.title,
                    company: job.company.split("·")[0]?.trim() || "Company",
                    logo: job.logo,
                    logoClass: job.logoClass,
                    status: "Apply",
                    location: "",
                    type: job.type,
                    salary: job.salary,
                    applicants: 0,
                    time: "",
                    saved: true,
                    companyId: null,
                  })
                }
              >
                Apply now
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <motion.div className="candidate-page lc-candidate-dashboard" {...lcMotionPage()}>
      <AppTopbar
        user={user}
        searchPlaceholder="Search jobs, companies..."
        searchValue={topSearch}
        onSearchChange={(e) => setTopSearch(e.target.value)}
        onSearchKeyDown={handleTopSearchKeyDown}
        notifUnread={notifUnread}
        messagesUnread={messagesUnread}
        onLogoClick={goRoleHome}
        onHomeClick={goRoleHome}
        onMessagesClick={() => navigate("/messages")}
        onNotificationsClick={() => navigate("/notifications")}
        subtitle={specialization || "Candidate"}
      />

      <div className="layout">
        <CandidateSidebar
          user={user}
          activeKey={activeTab}
          notifUnread={notifUnread}
          messagesUnread={messagesUnread}
          applicationsUnread={applicationsActivityUnread}
          onDashboard={() => setActiveTab("dashboard")}
          onFeed={() => navigate(FEED_PATH)}
          onFindJobs={() => setActiveTab("findJobs")}
          onApplications={() => setActiveTab("applications")}
          onSavedJobs={() => setActiveTab("savedJobs")}
          onMessages={() => navigate("/messages")}
          onNotifications={() => navigate("/notifications")}
          onMyProfile={() => {
            const uid = user?.id ?? user?._id;
            if (uid) navigate(`/candidate-profile/${uid}`);
          }}
          onSignOut={signOut}
        />

        <main className="main-content">
          {activeTab === "dashboard" && renderDashboardHome()}
          {activeTab === "findJobs" && renderFindJobs()}
          {activeTab === "applications" && renderApplications()}
          {activeTab === "savedJobs" && renderSavedJobs()}
        </main>

        <DashboardRail
          variant="candidate"
          candidateTab={activeTab}
          context={candidateRailContext}
        />

      </div>

      <Modal
        open={jobModalOpen}
        title={jobModalDetail?.title || "Job details"}
        onClose={() => {
          setJobModalOpen(false);
          setJobModalDetail(null);
        }}
      >
        {jobModalDetail ? (
          <div className="lc-job-modal">
            {(() => {
              const modalMatch =
                matchUser && String(matchUser.role || "").toLowerCase() === "candidate"
                  ? jobModalDetail.candidateMatch ??
                    calculateJobMatch(matchUser, jobModalDetail)
                  : null;
              if (!modalMatch) return null;
              return (
                <>
                  <div
                    style={{
                      marginBottom: 12,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    <JobMatchBadge
                      user={matchUser}
                      rawJob={jobModalDetail}
                      matchDetail={modalMatch}
                      showWhy={false}
                    />
                  </div>
                  <div className="lc-job-modal-match-explain" style={{ marginBottom: 14 }}>
                    <JobMatchExplain
                      detail={modalMatch}
                      variant="modal"
                      displayScore={computeJobMatchPct(matchUser, jobModalDetail)}
                    />
                  </div>
                </>
              );
            })()}
            <p style={{ fontWeight: 600, marginBottom: 8 }}>
              {jobModalDetail.company?.companyName || "Company"} ·{" "}
              {jobModalDetail.location}
            </p>
            <p style={{ marginBottom: 8 }}>
              <span style={{ marginRight: 12 }}>{jobModalDetail.type}</span>
              <span>{jobModalDetail.salary}</span>
            </p>
            <p style={{ whiteSpace: "pre-wrap", color: "var(--text-secondary)" }}>
              {jobModalDetail.description || "No description."}
            </p>
            {(() => {
              let req = jobModalDetail.requirements;
              if (typeof req === "string") {
                try {
                  req = JSON.parse(req);
                } catch {
                  req = [];
                }
              }
              const list = Array.isArray(req) ? req : [];
              if (!list.length) return null;
              return (
                <div style={{ marginTop: 12 }}>
                  <strong>Requirements</strong>
                  <ul style={{ marginTop: 8 }}>
                    {list.map((r) => (
                      <li key={String(r)}>{String(r)}</li>
                    ))}
                  </ul>
                </div>
              );
            })()}
            <div
              style={{
                marginTop: 16,
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              {loadErr || modalJobApplied ? null : (
                <button
                  type="button"
                  className="apply-btn"
                  onClick={() => {
                    const comp = jobModalDetail.company?.companyName || "";
                    const jid =
                      jobModalDetail.id ??
                      jobModalDetail._id;
                    setJobModalOpen(false);
                    openApplyModalFromJobCard({
                      apiId: jid,
                      title: jobModalDetail.title,
                      company: comp || "Company",
                      logo: initialsFromName(comp || jobModalDetail.title).slice(
                        0,
                        4
                      ),
                      logoClass: "logo-tech",
                      location: jobModalDetail.location || "",
                      type: jobModalDetail.type || "",
                      salary: jobModalDetail.salary || "",
                      applicants: 0,
                      time: "",
                      status: "Apply",
                      saved: false,
                      companyId:
                        jobModalDetail.company?.id ??
                        jobModalDetail.company?._id ??
                        null,
                    });
                  }}
                >
                  Apply
                </button>
              )}
              {modalJobApplied ? (
                <span style={{ alignSelf: "center", fontWeight: 600, color: "#0b73db" }}>
                  ✓ Applied
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        wide
        open={applyModalOpen}
        title={applyJobTarget?.title ? `Apply · ${applyJobTarget.title}` : "Apply"}
        onClose={() => {
          if (applySubmitting) return;
          setApplyModalOpen(false);
          setApplyJobTarget(null);
          setApplyCvBase64("");
          setApplyCvFileName("");
          setApplyMessage("");
        }}
      >
        <form className="co-job-modal-form" onSubmit={submitApplyModal}>
          {applyJobTarget?.company ? (
            <p style={{ marginTop: 0, color: "#475569", fontSize: 14 }}>
              {applyJobTarget.company}
              {applyJobTarget.location ? ` · ${applyJobTarget.location}` : ""}
            </p>
          ) : null}
          <p style={{ marginTop: 0, fontWeight: 600 }}>
            Résumé / CV upload is required. Optional message to employer.
          </p>
          <label className="co-modal-label">
            CV upload
            <input
              type="file"
              accept=".pdf,.doc,.docx,image/*"
              onChange={pickApplyCv}
            />
            <span style={{ fontSize: 13, fontWeight: 500 }}>
              {applyCvFileName || "No file chosen"}
            </span>
          </label>
          <label className="co-modal-label">
            Cover message
            <textarea
              className="co-modal-input co-modal-textarea"
              placeholder="Briefly explain why you're a fit…"
              value={applyMessage}
              onChange={(e) => setApplyMessage(e.target.value)}
              rows={4}
            />
          </label>
          <div className="co-modal-actions">
            <button
              type="button"
              className="apply-btn ghost"
              disabled={applySubmitting}
              onClick={() => {
                if (applySubmitting) return;
                setApplyModalOpen(false);
                setApplyJobTarget(null);
                setApplyCvBase64("");
                setApplyCvFileName("");
                setApplyMessage("");
              }}
            >
              Cancel
            </button>
            <button type="submit" className="apply-btn" disabled={applySubmitting}>
              {applySubmitting ? "Sending…" : "Submit application"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={saveSearchModalOpen}
        title="Save this search"
        onClose={() => {
          setSaveSearchModalOpen(false);
          setSaveSearchError("");
        }}
      >
        <div className="lc-save-search-modal">
          <p className="lc-save-search-modal-lead">
            Saves your keyword, location, type, field, salary, and sort so you can reapply them anytime.
          </p>
          {saveSearchError ? (
            <p className="lc-save-search-modal-err" role="alert">
              {saveSearchError}
            </p>
          ) : null}
          <label className="lc-save-search-modal-label" htmlFor="lc-save-search-name">
            Search name
          </label>
          <input
            id="lc-save-search-name"
            className="lc-save-search-modal-input"
            value={saveSearchName}
            onChange={(e) => {
              setSaveSearchName(e.target.value);
              setSaveSearchError("");
            }}
            placeholder="Frontend jobs in Beirut"
            autoComplete="off"
            maxLength={255}
          />
          <label className="lc-save-search-modal-check">
            <input
              type="checkbox"
              checked={saveSearchAlert}
              onChange={(e) => setSaveSearchAlert(e.target.checked)}
            />
            <span>Notify me when new jobs match these filters</span>
          </label>
          <p className="lc-save-search-modal-note">
            In-app notifications when a new listing lines up with this saved search (keyword,
            location, and type filters).
          </p>
          <div className="lc-save-search-modal-actions">
            <button
              type="button"
              className="lc-btn lc-btn--secondary lc-btn-hit"
              onClick={() => {
                setSaveSearchModalOpen(false);
                setSaveSearchError("");
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="lc-btn lc-btn--primary lc-btn-hit"
              disabled={!saveSearchName.trim()}
              onClick={() => void confirmSaveSavedSearch()}
            >
              Save Search
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(interviewCancelTarget)}
        title="Cancel interview?"
        onClose={() => {
          if (!interviewCancelLoading) setInterviewCancelTarget(null);
        }}
      >
        <div className="lc-interview-cancel-modal">
          <p className="lc-interview-cancel-modal-lead">
            Are you sure you want to cancel this interview?
          </p>
          <div className="lc-interview-cancel-modal-actions">
            <button
              type="button"
              className="lc-btn lc-btn--secondary lc-btn-hit"
              disabled={interviewCancelLoading}
              onClick={() => setInterviewCancelTarget(null)}
            >
              Keep Interview
            </button>
            <button
              type="button"
              className="lc-btn lc-btn--danger lc-btn-hit"
              disabled={interviewCancelLoading}
              onClick={() => void confirmInterviewCancel()}
            >
              {interviewCancelLoading ? "Cancelling…" : "Cancel Interview"}
            </button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}

export default CandidateDashboard;
