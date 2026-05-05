import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/axios";
import AppTopbar from "../components/AppTopbar";
import CandidateSidebar from "../components/CandidateSidebar";
import Modal from "../components/Modal";
import UserAvatar from "../components/UserAvatar";
import {
  Briefcase,
  Calendar,
  ClipboardCheck,
  ClipboardList,
  Eye,
  Loader2,
  Mail,
  Pencil,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  Users,
  UserRound,
  X,
  XCircle,
} from "lucide-react";

import { formatRelativeTime, initialsFromName } from "../utils/format";
import { getProfileImage } from "../utils/profileMedia";
import { dashboardPath, FEED_PATH, logout } from "../utils/auth";
import { motion } from "framer-motion";

import { lcMotionPage } from "../utils/motionProps";

import { useAuthUser } from "../hooks/useAuthUser";
import { hasCvAttachment, openCv } from "../utils/openCv";
import { companyProfileStrength } from "../utils/profileStrength";
import {
  announceJobOnFeed,
  buildCreateJobPayload,
  createCompanyJob,
  jobIdFromCreateResponse,
} from "../utils/companyJobApi";
import "./Dashboard.css";
import "./CandidateDashboard.css";
import "./CompanyDashboardExtras.css";

const COMPANY_JOB_TYPES = [
  "",
  "Full-time",
  "Part-time",
  "Contract",
  "Internship",
  "Temporary",
  "Remote",
  "Hybrid",
  "On-site",
];

function formatApplicantStatus(s) {
  const x = String(s || "pending").toLowerCase();
  if (x === "accepted") return "accepted";
  if (x === "rejected") return "rejected";
  return "pending";
}

function statusLabelPretty(s) {
  const x = formatApplicantStatus(s);
  return x.charAt(0).toUpperCase() + x.slice(1);
}

function canOfferInterviewSlot(person) {
  if (!person || person.statusRaw === "rejected") return false;
  const stage = String(person.application?.stage || "applied").toLowerCase();
  if (person.statusRaw === "accepted" || person.statusRaw === "pending") return true;
  return ["shortlisted", "interview", "viewed", "applied"].includes(stage);
}

function CompanyDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthUser();
  const uid = user?.id ?? user?._id;
  const companyName = user?.companyName || user?.email || "Company";

  const [activeTab, setActiveTab] = useState("dashboard");
  const [myJobs, setMyJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [applicants, setApplicants] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [previewApps, setPreviewApps] = useState([]);
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [jobForm, setJobForm] = useState({
    title: "",
    description: "",
    location: "",
    type: "",
    salary: "",
    requirements: "",
  });
  const [notifUnread, setNotifUnread] = useState(0);
  const [messagesUnread, setMessagesUnread] = useState(0);
  const [topSearch, setTopSearch] = useState("");
  const [applicantStatusTab, setApplicantStatusTab] = useState("pending");
  const [cvImagePreviewSrc, setCvImagePreviewSrc] = useState(null);
  const [pendingAppsCount, setPendingAppsCount] = useState(0);
  /** Non-pending decisions across all of the company’s jobs (from aggregated API pulls). */
  const [answeredAppsCount, setAnsweredAppsCount] = useState(0);
  const [jobsSearch, setJobsSearch] = useState("");
  const [jobsStatusFilter, setJobsStatusFilter] = useState("all");
  const [jobSubmitting, setJobSubmitting] = useState(false);
  const [jobModalNotice, setJobModalNotice] = useState("");
  const [announceOnFeed, setAnnounceOnFeed] = useState(false);
  const [deleteJobTarget, setDeleteJobTarget] = useState(null);
  const [detailJob, setDetailJob] = useState(null);
  const [pageBanner, setPageBanner] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState(false);
  const bannerTimerRef = useRef(null);
  const [interviewModalPerson, setInterviewModalPerson] = useState(null);
  const [interviewForm, setInterviewForm] = useState({
    date: "",
    time: "",
    mode: "online",
    locationOrLink: "",
    message: "",
  });
  const [interviewSubmitting, setInterviewSubmitting] = useState(false);
  /** @type {Record<string, { status: string; scheduledAt?: string; id?: number }>} */
  const [interviewsByAppId, setInterviewsByAppId] = useState({});

  const showPageBanner = useCallback((kind, text) => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    setPageBanner({ kind, text });
    bannerTimerRef.current = setTimeout(() => {
      setPageBanner(null);
      bannerTimerRef.current = null;
    }, 4500);
  }, []);

  const closeCvPreview = () => {
    if (cvImagePreviewSrc?.startsWith("blob:")) {
      URL.revokeObjectURL(cvImagePreviewSrc);
    }
    setCvImagePreviewSrc(null);
  };

  const cvOpenOptions = {
    showImagePreview: (src) => {
      setCvImagePreviewSrc((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        return src;
      });
    },
    onMissing: () =>
      showPageBanner("err", "No CV uploaded for this application."),
  };

  const sidebarActive =
    activeTab === "dashboard"
      ? "dashboard"
      : activeTab === "jobs"
        ? "jobs"
        : activeTab === "applicants"
          ? "applicants"
          : "dashboard";

  const loadUnread = useCallback(async () => {
    try {
      const { data } = await api.get("/api/notifications");
      const list = Array.isArray(data) ? data : [];
      setNotifUnread(list.filter((n) => !n.isRead).length);
    } catch {
      setNotifUnread(0);
    }
  }, []);

  const loadMessagesUnread = useCallback(async () => {
    if (!uid) {
      setMessagesUnread(0);
      return;
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
  }, [uid]);

  const refreshInboxCounts = useCallback(async () => {
    await Promise.all([loadUnread(), loadMessagesUnread()]);
  }, [loadUnread, loadMessagesUnread]);

  const refreshCompanyInterviewsMap = useCallback(async () => {
    if (!uid) return;
    try {
      const { data } = await api.get("/api/interviews/company");
      const map = {};
      for (const iv of Array.isArray(data) ? data : []) {
        const aid = iv.applicationId ?? iv.application_id;
        if (aid == null) continue;
        const sid = String(aid);
        const next = {
          status: String(iv.status || "").toLowerCase(),
          scheduledAt: iv.scheduledAt,
          id: iv.id,
        };
        const prev = map[sid];
        if (!prev || String(iv.scheduledAt || "") > String(prev.scheduledAt || "")) {
          map[sid] = next;
        }
      }
      setInterviewsByAppId(map);
    } catch {
      setInterviewsByAppId({});
    }
  }, [uid]);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/jobs/mine");
      const mine = Array.isArray(data) ? data : [];
      setMyJobs(mine);
      setSelectedJobId((prev) => {
        if (prev != null && mine.some((x) => Number(x.id ?? x._id) === Number(prev)))
          return prev;
        return mine.length ? mine[0].id ?? mine[0]._id : null;
      });
    } catch {
      try {
        const { data } = await api.get("/api/jobs");
        const fallback = (data || []).filter(
          (j) =>
            Number(j.company?.id ?? j.company?._id ?? j.company_id) === Number(uid)
        );
        setMyJobs(fallback);
        setSelectedJobId((prev) => {
          if (prev != null && fallback.some((x) => Number(x.id ?? x._id) === Number(prev)))
            return prev;
          return fallback.length ? fallback[0].id ?? fallback[0]._id : null;
        });
      } catch {
        setMyJobs([]);
        setSelectedJobId(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
    void refreshInboxCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void refreshInboxCounts();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refreshInboxCounts]);

  useEffect(() => {
    if (!uid || activeTab !== "dashboard") return;
    let cancelled = false;
    (async () => {
      setAnalyticsLoading(true);
      setAnalyticsError(false);
      try {
        const { data } = await api.get("/api/company/analytics");
        if (!cancelled) setAnalytics(data || null);
      } catch {
        if (!cancelled) {
          setAnalytics(null);
          setAnalyticsError(true);
        }
      } finally {
        if (!cancelled) setAnalyticsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, activeTab]);

  useEffect(() => () => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
  }, []);

  useEffect(() => {
    const t = location.state?.tab;
    if (t === "jobs" || t === "applicants" || t === "dashboard") {
      setActiveTab(t);
    }
  }, [location.state]);

  useEffect(() => {
    const jid = location.state?.jobId;
    if (jid == null || jid === "") return;
    const n = Number(jid);
    if (!Number.isFinite(n)) return;
    setActiveTab("applicants");
    setSelectedJobId(n);
  }, [location.state?.jobId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!myJobs.length) {
        if (!cancelled) {
          setPendingAppsCount(0);
          setAnsweredAppsCount(0);
        }
        return;
      }
      try {
        const chunks = await Promise.all(
          myJobs.map(async (j) => {
            const jid = j.id ?? j._id;
            try {
              const { data } = await api.get(`/api/applications/job/${jid}`);
              return Array.isArray(data) ? data : [];
            } catch {
              return [];
            }
          })
        );
        const flat = chunks.flat();
        let pending = 0;
        let answered = 0;
        for (const a of flat) {
          const st = formatApplicantStatus(a.status);
          if (st === "pending") pending++;
          else if (st === "accepted" || st === "rejected") answered++;
        }
        if (!cancelled) {
          setPendingAppsCount(pending);
          setAnsweredAppsCount(answered);
        }
      } catch {
        if (!cancelled) {
          setPendingAppsCount(0);
          setAnsweredAppsCount(0);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [myJobs]);

  useEffect(() => {
    async function preview() {
      if (!myJobs.length) {
        setPreviewApps([]);
        return;
      }
      const jid = myJobs[0].id ?? myJobs[0]._id;
      try {
        const { data } = await api.get(`/api/applications/job/${jid}`);
        setPreviewApps(Array.isArray(data) ? data : []);
      } catch {
        setPreviewApps([]);
      }
    }
    preview();
  }, [myJobs]);

  useEffect(() => {
    setApplicantStatusTab("pending");
  }, [selectedJobId]);

  useEffect(() => {
    async function loadApplicants() {
      if (!selectedJobId || activeTab !== "applicants") return;
      try {
        const { data } = await api.get(`/api/applications/job/${selectedJobId}`);
        setApplicants(Array.isArray(data) ? data : []);
      } catch {
        setApplicants([]);
      }
    }
    loadApplicants();
  }, [selectedJobId, activeTab]);

  useEffect(() => {
    if (!uid || activeTab !== "applicants") return;
    void refreshCompanyInterviewsMap();
  }, [uid, activeTab, refreshCompanyInterviewsMap]);

  const openCreateModal = () => {
    setEditingJob(null);
    setJobModalNotice("");
    setAnnounceOnFeed(false);
    setJobForm({
      title: "",
      description: "",
      location: "",
      type: "",
      salary: "",
      requirements: "",
    });
    setJobModalOpen(true);
  };

  const openEditModal = (job) => {
    setEditingJob(job);
    let reqs = "";
    if (Array.isArray(job.requirements)) {
      reqs = job.requirements.map((x) => String(x).trim()).filter(Boolean).join("\n");
    } else if (typeof job.requirements === "string") {
      try {
        const parsed = JSON.parse(job.requirements);
        reqs = Array.isArray(parsed)
          ? parsed.map((x) => String(x).trim()).filter(Boolean).join("\n")
          : job.requirements;
      } catch {
        reqs = job.requirements;
      }
    }
    setJobModalNotice("");
    setJobForm({
      title: job.title || "",
      description: job.description || "",
      location: job.location || "",
      type: job.type || "",
      salary: job.salary || "",
      requirements: reqs,
    });
    setJobModalOpen(true);
  };

  const submitJobModal = async (e) => {
    e.preventDefault();
    setJobModalNotice("");
    const titleTrim = jobForm.title.trim();
    const descTrim = jobForm.description.trim();
    if (!titleTrim || !descTrim) {
      setJobModalNotice("Title and description are required.");
      return;
    }
    const payload = buildCreateJobPayload({
      title: titleTrim,
      description: descTrim,
      location: jobForm.location.trim(),
      type: jobForm.type.trim(),
      salary: jobForm.salary.trim(),
      requirements: jobForm.requirements,
    });
    setJobSubmitting(true);
    try {
      if (editingJob) {
        const jid = editingJob.id ?? editingJob._id;
        await api.put(`/api/jobs/${jid}`, payload);
        showPageBanner("ok", "Job updated.");
      } else {
        const created = await createCompanyJob(api, payload);
        const jobIdRaw = jobIdFromCreateResponse(created);
        if (announceOnFeed && jobIdRaw != null && Number.isFinite(Number(jobIdRaw))) {
          try {
            await announceJobOnFeed(api, {
              jobId: Number(jobIdRaw),
              title: titleTrim,
            });
            showPageBanner("ok", "Job posted and announced on Feed.");
          } catch {
            showPageBanner(
              "ok",
              "Job posted. Feed announcement could not be published — you can share from Feed."
            );
          }
        } else {
          showPageBanner("ok", "Job posted.");
        }
      }
      setJobModalOpen(false);
      await loadJobs();
      setAnnounceOnFeed(false);
    } catch (err) {
      const raw =
        err.response?.data?.message || err.message || "Could not save job.";
      setJobModalNotice(raw);
    } finally {
      setJobSubmitting(false);
    }
  };

  const closeJob = async (job) => {
    const jid = job.id ?? job._id;
    if (!jid) return;
    try {
      await api.put(`/api/jobs/${jid}/close`);
      showPageBanner("ok", "Job marked as closed.");
      await loadJobs();
    } catch (err) {
      showPageBanner(
        "err",
        err.response?.data?.message || err.message || "Could not close this job."
      );
    }
  };

  const confirmDeleteJob = async () => {
    const job = deleteJobTarget;
    if (!job) return;
    const jid = job.id ?? job._id;
    if (!jid) return;
    setJobSubmitting(true);
    try {
      await api.delete(`/api/jobs/${jid}`);
      setDeleteJobTarget(null);
      showPageBanner("ok", "Job deleted.");
      await loadJobs();
    } catch (err) {
      showPageBanner(
        "err",
        err.response?.data?.message || err.message || "Could not delete."
      );
    } finally {
      setJobSubmitting(false);
    }
  };

  const updateApplication = async (appId, status) => {
    const sid = Number(selectedJobId);
    if (!Number.isFinite(sid)) return;
    try {
      await api.put(`/api/applications/${Number(appId)}/status`, { status });
      const { data } = await api.get(`/api/applications/job/${sid}`);
      setApplicants(Array.isArray(data) ? data : []);
      await loadJobs();
    } catch (err) {
      showPageBanner(
        "err",
        err.response?.data?.message || err.message || "Update failed"
      );
    }
  };

  const updateApplicationPipeline = async (appId, stage) => {
    const sid = Number(selectedJobId);
    if (!Number.isFinite(sid)) return;
    try {
      await api.put(`/api/applications/${Number(appId)}/stage`, { stage });
      const { data } = await api.get(`/api/applications/job/${sid}`);
      setApplicants(Array.isArray(data) ? data : []);
      showPageBanner("ok", `Pipeline: ${stage}`);
    } catch (err) {
      showPageBanner(
        "err",
        err.response?.data?.message || err.message || "Stage update failed"
      );
    }
  };

  const openInterviewModal = (person) => {
    setInterviewModalPerson(person);
    setInterviewForm({
      date: "",
      time: "",
      mode: "online",
      locationOrLink: "",
      message: "",
    });
  };

  const closeInterviewModal = () => {
    if (interviewSubmitting) return;
    setInterviewModalPerson(null);
  };

  const submitInterviewModal = async (e) => {
    e.preventDefault();
    const person = interviewModalPerson;
    if (!person) return;
    const { date, time, mode, locationOrLink, message } = interviewForm;
    if (!String(date || "").trim() || !String(time || "").trim()) {
      showPageBanner("err", "Please choose a date and time.");
      return;
    }
    const candidateId = Number(person.candidateUserId);
    const jobIdNum = Number(
      person.jobId ?? person.application?.job?.id ?? person.application?.job_id ?? selectedJobId
    );
    setInterviewSubmitting(true);
    try {
      await api.post("/api/interviews", {
        applicationId: Number(person.apiId),
        ...(Number.isFinite(candidateId) ? { candidateId } : {}),
        ...(Number.isFinite(jobIdNum) ? { jobId: jobIdNum } : {}),
        date: String(date).trim(),
        time: String(time).trim(),
        mode: mode === "office" ? "office" : "online",
        locationOrLink: String(locationOrLink || "").trim(),
        message: String(message || "").trim(),
      });
      const sid = Number(selectedJobId);
      if (Number.isFinite(sid)) {
        const { data } = await api.get(`/api/applications/job/${sid}`);
        setApplicants(Array.isArray(data) ? data : []);
      }
      await loadJobs();
      void refreshInboxCounts();
      void refreshCompanyInterviewsMap();
      setInterviewModalPerson(null);
      showPageBanner("ok", "Interview scheduled.");
    } catch (err) {
      showPageBanner(
        "err",
        err.response?.data?.message ||
          err.message ||
          "Could not schedule interview"
      );
    } finally {
      setInterviewSubmitting(false);
    }
  };

  const activeCount = myJobs.filter((j) => j.status === "active").length;
  const totalApplicants = myJobs.reduce(
    (s, j) => s + (j.applicantsCount ?? j.applicants_count ?? 0),
    0
  );

  const jobsFiltered = useMemo(() => {
    let list = myJobs;
    if (jobsStatusFilter === "active")
      list = list.filter((j) => j.status === "active");
    else if (jobsStatusFilter === "closed")
      list = list.filter((j) => j.status === "closed");
    const q = jobsSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((j) =>
      `${j.title} ${j.location} ${j.type} ${j.salary} ${j.status || ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [myJobs, jobsSearch, jobsStatusFilter]);

  const jobListings = useMemo(
    () =>
      jobsFiltered.map((job) => ({
        title: job.title,
        location: job.location || "—",
        type: job.type || "—",
        salary: job.salary || "—",
        applicantsN: job.applicantsCount ?? job.applicants_count ?? 0,
        postedRel: formatRelativeTime(job.createdAt || job.created_at) || "—",
        statusKey: job.status,
        statusLabel: job.status === "closed" ? "Closed" : "Active",
        raw: job,
      })),
    [jobsFiltered]
  );

  const mapApplicantRows = (list) =>
    list.map((a) => {
      const cand = a.candidate || {};
      const candUser = {
        role: "candidate",
        fullName: cand.fullName ?? cand.full_name,
        email: cand.email,
        profileImage: cand.profileImage ?? cand.profile_image,
        logo: cand.logo,
      };
      let skills = [];
      if (Array.isArray(cand.skills)) skills = cand.skills;
      else if (typeof cand.skills === "string") {
        try {
          skills = JSON.parse(cand.skills);
        } catch {
          skills = [];
        }
      }
      const st = formatApplicantStatus(a.status);
      const normalizedApp = {
        ...a,
        cv: a.cv ?? a.cv_file ?? a.cvFile,
        cvFileName:
          a.cvFileName ??
          a.cv_file_name ??
          a.cv_filename ??
          a.cvFile ??
          "",
      };
      const jid = Number(a.job?.id ?? a.job_id ?? selectedJobId ?? NaN);
      return {
        name:
          cand.fullName ||
          cand.full_name ||
          cand.email ||
          "Candidate",
        candidateUserId: cand.id ?? cand._id,
        jobId: Number.isFinite(jid) ? jid : null,
        candidateUserForAvatar: candUser,
        jobTitle: a.job?.title || "Job",
        appliedShort: `${formatRelativeTime(a.createdAt || a.created_at) || ""}`,
        appliedFor: `Applied for: ${a.job?.title || "Job"} · ${formatRelativeTime(a.createdAt || a.created_at)}`,
        applicantMessage: typeof a.message === "string" ? a.message.trim() : "",
        skills: skills.length ? skills.slice(0, 4) : [],
        statusRaw: st,
        statusLabel: statusLabelPretty(a.status),
        apiId: a.id ?? a._id,
        application: normalizedApp,
      };
    });

  const applicantsMapped = mapApplicantRows(applicants);
  const applicantsFiltered = useMemo(() => {
    return applicantsMapped.filter((p) => {
      if (applicantStatusTab === "all") return true;
      return p.statusRaw === applicantStatusTab;
    });
  }, [applicantsMapped, applicantStatusTab]);
  const previewMapped = mapApplicantRows(previewApps);

  const applicantCounts = useMemo(() => {
    let pending = 0;
    let accepted = 0;
    let rejected = 0;
    for (const p of applicantsMapped) {
      if (p.statusRaw === "pending") pending++;
      else if (p.statusRaw === "accepted") accepted++;
      else if (p.statusRaw === "rejected") rejected++;
    }
    return {
      pending,
      accepted,
      rejected,
      all: applicantsMapped.length,
    };
  }, [applicantsMapped]);

  const companyStrength = useMemo(() => {
    const hasJob = myJobs.some((j) => j.status === "active");
    return companyProfileStrength(user, { hasActiveJob: hasJob });
  }, [user, myJobs]);

  const profileCompletionPct = companyStrength.pct;

  const jobTypeSelectOptions = useMemo(() => {
    const base = COMPANY_JOB_TYPES.filter(Boolean);
    const cur = (jobForm.type || "").trim();
    if (cur && !base.includes(cur)) return [cur, ...base];
    return base;
  }, [jobForm.type]);

  const detailJobRequirements = useMemo(() => {
    if (!detailJob) return [];
    const raw = detailJob.requirements;
    if (Array.isArray(raw))
      return raw.map((x) => String(x).trim()).filter(Boolean);
    if (typeof raw === "string") {
      try {
        const p = JSON.parse(raw);
        if (Array.isArray(p))
          return p.map((x) => String(x).trim()).filter(Boolean);
      } catch {
        /* ignore */
      }
      return raw
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  }, [detailJob]);

  const subtabsJobs = (
    <>
      <button type="button" className="subtab" onClick={() => setActiveTab("dashboard")}>
        Dashboard
      </button>
      <button type="button" className="subtab active">
        My Jobs
      </button>
      <button type="button" className="subtab" onClick={() => setActiveTab("applicants")}>
        Applicants
      </button>
    </>
  );

  const subtabsApplicants = (
    <>
      <button type="button" className="subtab" onClick={() => setActiveTab("dashboard")}>
        Dashboard
      </button>
      <button type="button" className="subtab" onClick={() => setActiveTab("jobs")}>
        My Jobs
      </button>
      <button type="button" className="subtab active">
        Applicants
      </button>
    </>
  );

  const subtabsDashboard = (
    <>
      <button type="button" className="subtab active">
        Dashboard
      </button>
      <button type="button" className="subtab" onClick={() => setActiveTab("jobs")}>
        My Jobs
      </button>
      <button type="button" className="subtab" onClick={() => setActiveTab("applicants")}>
        Applicants
      </button>
    </>
  );

  const postJobToolbar = (
    <button type="button" className="primary-btn co-post-job-head lc-co-icon-btn" onClick={openCreateModal}>
      <Plus size={18} strokeWidth={2.25} aria-hidden />
      Post Job
    </button>
  );

  const renderDashboard = () => (
    <>
      <div className="co-subtabs-row">
        <div className="subtabs">{subtabsDashboard}</div>
        {postJobToolbar}
      </div>

      <div className="welcome-card co-welcome-card lc-co-surface-accent">
        <div>
          <p className="welcome-small">Welcome back,</p>
          <h2>{companyName}</h2>
          <p className="welcome-text">Manage listings and applicants from one place.</p>
        </div>
        <button type="button" className="primary-btn lc-co-icon-btn" onClick={() => setActiveTab("jobs")}>
          <Briefcase size={18} strokeWidth={2} aria-hidden />
          My Jobs
        </button>
      </div>

      <div className="co-quick-actions" role="group" aria-label="Quick actions">
        <button type="button" className="co-qa-btn co-qa-btn--primary lc-co-icon-btn" onClick={openCreateModal}>
          <Plus size={18} strokeWidth={2.25} aria-hidden />
          Post Job
        </button>
        <button type="button" className="co-qa-btn lc-co-icon-btn" onClick={() => setActiveTab("applicants")}>
          <ClipboardCheck size={17} strokeWidth={2} aria-hidden />
          View Applicants
        </button>
        <button
          type="button"
          className="co-qa-btn lc-co-icon-btn"
          onClick={() => uid && navigate(`/company-profile/${uid}`)}
        >
          <Pencil size={17} strokeWidth={2} aria-hidden />
          Edit Company Profile
        </button>
        <button type="button" className="co-qa-btn lc-co-icon-btn" onClick={() => navigate("/messages?admin=true")}>
          <Mail size={17} strokeWidth={2} aria-hidden />
          Contact Support
        </button>
      </div>

      <div className="stats-cards co-stats-cards">
        <div className="mini-stat-card co-mini-stat">
          <div className="mini-icon blue-bg lc-co-mini-luc">
            <Briefcase size={22} strokeWidth={2} aria-hidden />
          </div>
          <h3>{activeCount}</h3>
          <p>Active jobs</p>
        </div>
        <div className="mini-stat-card co-mini-stat">
          <div className="mini-icon green-bg lc-co-mini-luc">
            <Users size={22} strokeWidth={2} aria-hidden />
          </div>
          <h3>{totalApplicants}</h3>
          <p>Total applicants</p>
          <span className="co-metric-note">Across your listings</span>
        </div>
        <div className="mini-stat-card co-mini-stat">
          <div className="mini-icon orange-bg lc-co-mini-luc">
            <Mail size={22} strokeWidth={2} aria-hidden />
          </div>
          <h3>{messagesUnread}</h3>
          <p>Unread messages</p>
          <span className="co-metric-note">Inbox unread count</span>
        </div>
        <div className="mini-stat-card co-mini-stat">
          <div className="mini-icon purple-bg lc-co-mini-luc">
            <ClipboardList size={22} strokeWidth={2} aria-hidden />
          </div>
          <h3>{pendingAppsCount}</h3>
          <p>Pending applications</p>
          <span className="co-metric-note">All jobs · live refresh</span>
        </div>
      </div>

      <div className="co-dash-two-col">
        <div className="panel-card co-panel-accent">
          <div className="panel-head">
            <h3>Profile completion</h3>
          </div>
          <div className="co-profile-completion">
            <div className="co-profile-meter" aria-hidden>
              <span
                className="co-profile-meter-fill"
                style={{ width: `${profileCompletionPct}%` }}
              />
            </div>
            <p className="co-profile-completion-num">{profileCompletionPct}% complete</p>
            <p className="co-metric-note">
              Based on saved profile fields and whether you have an active job posting.
            </p>
            {companyStrength.items?.some((it) => !it.ok) ? (
              <ul className="co-strength-mini" style={{ marginTop: 10, paddingLeft: 18 }}>
                {companyStrength.items
                  .filter((it) => !it.ok)
                  .slice(0, 8)
                  .map((it) => (
                    <li key={it.key} style={{ marginBottom: 6 }}>
                      <button
                        type="button"
                        className="lc-inline-link-btn"
                        onClick={() => {
                          if (!uid) return;
                          navigate(
                            `/company-profile/${uid}`,
                            it.key === "job"
                              ? { state: { openTab: "jobs" } }
                              : { state: { openEdit: true } }
                          );
                        }}
                      >
                        {it.label}
                      </button>
                    </li>
                  ))}
              </ul>
            ) : null}
          </div>
        </div>

        <div className="panel-card co-panel-accent">
          <div className="panel-head">
            <h3>Hiring checklist</h3>
          </div>
          <ul className="co-checklist">
            <li className={myJobs.length > 0 ? "co-checklist-done" : ""}>
              Publish at least one role
              {myJobs.length > 0 ? " — done" : ""}
            </li>
            <li className={activeCount > 0 ? "co-checklist-done" : ""}>
              Keep an active listing open while hiring
              {activeCount > 0 ? " — done" : ""}
            </li>
            <li className={totalApplicants > 0 ? "co-checklist-done" : ""}>
              Attract applicants to your postings
              {totalApplicants > 0 ? " — done" : ""}
            </li>
            <li className={answeredAppsCount > 0 ? "co-checklist-done" : ""}>
              Review and accept or decline candidates
              {answeredAppsCount > 0 ? " — done" : ""}
            </li>
            <li className="co-checklist-tip">
              <span>Suggested workflow tip:</span> reply to inbound messages promptly.
            </li>
          </ul>
          <p className="co-metric-note">
            Metrics above use API data where available (last row is advisory only).
          </p>
        </div>
      </div>

      <div className="panel-card co-panel-accent co-analytics-panel">
        <div className="panel-head">
          <h3>
            <TrendingUp size={18} strokeWidth={2} className="co-panel-head-ic" aria-hidden />
            Hiring analytics
          </h3>
        </div>
        {analyticsLoading ? (
          <p className="co-empty-hint">Loading analytics…</p>
        ) : null}
        {analyticsError && !analyticsLoading ? (
          <p className="co-empty-hint">Analytics could not load.</p>
        ) : null}
        {analytics && !analyticsLoading ? (
          <div className="co-analytics-grid">
            <div className="co-analytics-tile">
              <span className="co-analytics-label">Active jobs</span>
              <strong>{analytics.activeJobs ?? "—"}</strong>
            </div>
            <div className="co-analytics-tile">
              <span className="co-analytics-label">Applications (30 days)</span>
              <strong>{analytics.applicationsLast30Days ?? "—"}</strong>
            </div>
            <div className="co-analytics-tile">
              <span className="co-analytics-label">Pending applicants</span>
              <strong>{analytics.pendingApplicants ?? "—"}</strong>
            </div>
            <div className="co-analytics-tile">
              <span className="co-analytics-label">Acceptance rate</span>
              <strong>
                {analytics.acceptanceRatePercent != null
                  ? `${analytics.acceptanceRatePercent}%`
                  : "—"}
              </strong>
            </div>
            <div className="co-analytics-tile co-analytics-tile--wide">
              <span className="co-analytics-label">Best performing listing</span>
              <strong>
                {analytics.bestPerformingJob
                  ? `${analytics.bestPerformingJob} (${analytics.bestPerformingApplicants ?? 0} applicants)`
                  : "—"}
              </strong>
            </div>
            <div className="co-analytics-tile">
              <span className="co-analytics-label">Total accepted</span>
              <strong>{analytics.acceptedTotal ?? "—"}</strong>
            </div>
            <div className="co-analytics-tile">
              <span className="co-analytics-label">Total rejected</span>
              <strong>{analytics.rejectedTotal ?? "—"}</strong>
            </div>
          </div>
        ) : null}
        {analytics?.profileViewsNote ? (
          <p className="co-metric-note co-analytics-note">{analytics.profileViewsNote}</p>
        ) : null}
        {analytics?.postEngagementNote ? (
          <p className="co-metric-note co-analytics-note">{analytics.postEngagementNote}</p>
        ) : null}
      </div>

      <div className="panel-card co-panel-accent">
        <div className="panel-head">
          <h3>Active job listings</h3>
          <button type="button" className="link-like" onClick={() => setActiveTab("jobs")}>
            Manage all
          </button>
        </div>
        <div className="recent-apps">
          {myJobs.filter((j) => j.status === "active").slice(0, 4).map((job) => (
            <button
              type="button"
              className="recent-app-item co-dash-job-preview"
              key={job.id ?? job._id}
              onClick={() => {
                setDetailJob(job);
              }}
            >
              <div>
                <h4>{job.title}</h4>
                <p>
                  {job.applicantsCount ?? job.applicants_count ?? 0} applicants ·{" "}
                  {formatRelativeTime(job.createdAt || job.created_at)}
                </p>
              </div>
              <span className="status-pill accepted lc-co-live-pill">
                ● Active
              </span>
            </button>
          ))}
          {!myJobs.length && !loading ? (
            <p className="co-empty-hint">No jobs yet — post your first role.</p>
          ) : null}
        </div>
      </div>

      <div className="panel-card co-panel-accent">
        <div className="panel-head">
          <h3>Recent applicants</h3>
          <button type="button" className="link-like" onClick={() => setActiveTab("applicants")}>
            View all
          </button>
        </div>
        <div className="recent-apps">
          {previewMapped.slice(0, 3).map((person) => (
            <div className="recent-app-item co-applicant-snippet" key={person.apiId}>
              <div className="co-applicant-snippet-main">
                <UserAvatar user={person.candidateUserForAvatar} size={40} />
                <div>
                  <button
                    type="button"
                    className="co-inline-name"
                    onClick={() =>
                      person.candidateUserId &&
                      navigate(`/candidate-profile/${person.candidateUserId}`)
                    }
                  >
                    {person.name}
                  </button>
                  <p>{person.appliedFor}</p>
                </div>
              </div>
              <span className={`status-pill ${person.statusRaw}`}>
                ● {person.statusLabel}
              </span>
            </div>
          ))}
          {!previewMapped.length ? (
            <p className="co-empty-hint">Applicants will appear here once you receive applications.</p>
          ) : null}
        </div>
      </div>
    </>
  );

  const renderMyJobs = () => (
    <>
      <div className="co-subtabs-row">
        <div className="subtabs">{subtabsJobs}</div>
        {postJobToolbar}
      </div>

      <div className="filters-bar co-jobs-meta lc-co-job-filters">
        <label className="co-job-search lc-co-grow">
          <Search size={18} strokeWidth={2} className="co-job-search-icon" aria-hidden />
          <input
            type="search"
            className="co-job-search-input"
            placeholder="Search title, location, type, salary…"
            value={jobsSearch}
            onChange={(e) => setJobsSearch(e.target.value)}
            aria-label="Search jobs"
          />
        </label>
        <select
          className="co-job-select"
          aria-label="Filter by status"
          value={jobsStatusFilter}
          onChange={(e) => setJobsStatusFilter(e.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="closed">Closed</option>
        </select>
        <p className="results-count co-job-count">
          Showing {jobListings.length} of {myJobs.length} listing
          {myJobs.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="co-jobs-stack">
        {jobListings.map((job) => (
          <div
            className="find-job-card co-job-admin-card lc-co-job-card-premium"
            key={job.raw.id ?? job.raw._id ?? job.title}
          >
            <div className="find-job-left co-job-card-body">
              <div className="job-logo logo-tech lc-co-job-logo-ring">
                {initialsFromName(companyName).slice(0, 2)}
              </div>
              <div className="find-job-info">
                <div className="title-line">
                  <h3>{job.title}</h3>
                  <span
                    className={
                      job.statusKey === "active"
                        ? "company-tag company-tag-live"
                        : "company-tag"
                    }
                  >
                    {job.statusLabel}
                  </span>
                </div>
                <dl className="co-job-meta-grid">
                  <div>
                    <dt>Location</dt>
                    <dd>{job.location}</dd>
                  </div>
                  <div>
                    <dt>Type</dt>
                    <dd>{job.type}</dd>
                  </div>
                  <div>
                    <dt>Salary</dt>
                    <dd>{job.salary}</dd>
                  </div>
                  <div>
                    <dt>Applicants</dt>
                    <dd>{job.applicantsN}</dd>
                  </div>
                  <div>
                    <dt>Posted</dt>
                    <dd>{job.postedRel}</dd>
                  </div>
                </dl>
              </div>
            </div>
            <div className="co-job-actions">
              <button
                type="button"
                className="apply-btn ghost lc-co-icon-btn-sm"
                onClick={() => setDetailJob(job.raw)}
              >
                <Eye size={16} strokeWidth={2} aria-hidden /> View Details
              </button>
              <button
                type="button"
                className="apply-btn lc-co-icon-btn-sm"
                onClick={() => openEditModal(job.raw)}
              >
                <Pencil size={16} strokeWidth={2} aria-hidden /> Edit
              </button>
              <button
                type="button"
                className="apply-btn lc-co-icon-btn-sm"
                onClick={() => {
                  setActiveTab("applicants");
                  setSelectedJobId(job.raw.id ?? job.raw._id);
                }}
              >
                <Users size={16} strokeWidth={2} aria-hidden /> Applicants
              </button>
              {job.statusKey === "active" ? (
                <button
                  type="button"
                  className="apply-btn ghost lc-co-icon-btn-sm"
                  onClick={() => closeJob(job.raw)}
                >
                  <XCircle size={16} strokeWidth={2} aria-hidden /> Close
                </button>
              ) : (
                <span className="co-job-closed-hint">Closed</span>
              )}
              <button
                type="button"
                className="apply-btn danger lc-co-icon-btn-sm"
                onClick={() => setDeleteJobTarget(job.raw)}
              >
                <Trash2 size={16} strokeWidth={2} aria-hidden /> Delete
              </button>
            </div>
          </div>
        ))}
        {!myJobs.length && !loading ? (
          <p className="results-count co-empty-hint">
            No jobs posted yet — use Post Job to create your first listing.
          </p>
        ) : null}
        {myJobs.length > 0 && !jobListings.length && !loading ? (
          <p className="results-count co-empty-hint">No jobs match your search or filters.</p>
        ) : null}
      </div>
    </>
  );

  const renderApplicants = () => (
    <>
      <div className="co-subtabs-row">
        <div className="subtabs">{subtabsApplicants}</div>
        {postJobToolbar}
      </div>

      <div className="filters-bar co-applicant-toolbar">
        <p className="results-count" style={{ margin: 0 }}>
          {applicantStatusTab !== "all" ? (
            <>
              Showing {applicantsFiltered.length} ({applicantStatusTab}) ·{" "}
              {applicantsMapped.length} total for this job
            </>
          ) : (
            <>
              {applicantsFiltered.length} applicant
              {applicantsFiltered.length === 1 ? "" : "s"}
            </>
          )}
        </p>
        <select
          className="co-job-select"
          value={selectedJobId ?? ""}
          onChange={(e) => setSelectedJobId(Number(e.target.value))}
        >
          {myJobs.map((j) => (
            <option key={j.id ?? j._id} value={j.id ?? j._id}>
              {j.title}
            </option>
          ))}
        </select>
      </div>

      <div className="co-applicant-tabs" role="tablist" aria-label="Application status">
        {[
          { id: "pending", label: "Pending", count: applicantCounts.pending },
          { id: "accepted", label: "Accepted", count: applicantCounts.accepted },
          { id: "rejected", label: "Rejected", count: applicantCounts.rejected },
          { id: "all", label: "All", count: applicantCounts.all },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={applicantStatusTab === t.id}
            className={`co-applicant-tab ${applicantStatusTab === t.id ? "active" : ""}`}
            onClick={() => setApplicantStatusTab(t.id)}
          >
            {t.label}
            <span className="co-applicant-tab-count">{t.count}</span>
          </button>
        ))}
      </div>

      <div className="co-applicants-stack">
        {applicantsFiltered.map((person) => (
          <div
            className="find-job-card co-applicant-full lc-co-applicant-card"
            key={person.apiId}
          >
            <div className="find-job-left co-applicant-top">
              <button
                type="button"
                className="co-applicant-avatar-hit"
                onClick={() =>
                  person.candidateUserId &&
                  navigate(`/candidate-profile/${person.candidateUserId}`)
                }
              >
                <UserAvatar user={person.candidateUserForAvatar} size={56} />
              </button>
              <div className="find-job-info">
                <button
                  type="button"
                  className="co-inline-name title-line"
                  onClick={() =>
                    person.candidateUserId &&
                    navigate(`/candidate-profile/${person.candidateUserId}`)
                  }
                >
                  <h3 style={{ margin: 0 }}>{person.name}</h3>
                </button>
                <p className="co-applicant-job-line">{person.jobTitle}</p>
                <p className="co-applicant-date-line">{person.appliedShort}</p>
                {interviewsByAppId[String(person.apiId)]?.status === "cancelled" ? (
                  <p className="lc-co-interview-cancelled-note" role="status">
                    <span className="lc-co-interview-badge lc-co-interview-badge--cancelled">
                      Interview cancelled
                    </span>
                    The candidate withdrew from this scheduled interview.
                  </p>
                ) : null}
                <div>
                  <strong className="co-applicant-field-label">Message</strong>
                  {person.applicantMessage ? (
                    <div className="co-applicant-message">{person.applicantMessage}</div>
                  ) : (
                    <p className="about-text co-applicant-muted">
                      No cover message provided.
                    </p>
                  )}
                </div>
                {person.skills.length ? (
                  <div className="job-tags co-applicant-tags">
                    {person.skills.map((skill) => (
                      <span key={skill} className="tag tag-location">
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="co-applicant-buttons">
                  {hasCvAttachment(person.application) ? (
                    <button
                      type="button"
                      className="co-cv-view-btn lc-co-icon-btn-sm"
                      onClick={() =>
                        openCv(person.application ?? {}, cvOpenOptions)
                      }
                    >
                      <Eye size={16} strokeWidth={2} aria-hidden /> CV
                    </button>
                  ) : (
                    <span className="co-no-cv-uploaded">No CV uploaded</span>
                  )}
                  {(() => {
                    const stage = String(person.application?.stage || "applied").toLowerCase();
                    const stageTone = [
                      "accepted",
                      "rejected",
                      "interview",
                      "shortlisted",
                      "viewed",
                      "pending",
                      "applied",
                    ].includes(stage)
                      ? stage
                      : "applied";
                    const stageLabel =
                      stageTone === "shortlisted"
                        ? "Shortlisted"
                        : stageTone === "interview"
                          ? "Interview"
                          : stageTone === "viewed"
                            ? "Viewed"
                            : stageTone.charAt(0).toUpperCase() + stageTone.slice(1);
                    return (
                      <span
                        className={`company-applicant-status-pill company-applicant-status-pill--${stageTone}`}
                        aria-label={`Application status: ${stageLabel}`}
                        title={`Application status: ${stageLabel}`}
                      >
                        {stageLabel}
                      </span>
                    );
                  })()}
                  {canOfferInterviewSlot(person) ? (
                    <button
                      type="button"
                      className="apply-btn ghost lc-co-icon-btn-sm"
                      onClick={() => openInterviewModal(person)}
                    >
                      <Calendar size={16} strokeWidth={2} aria-hidden /> Schedule Interview
                    </button>
                  ) : null}
                  {person.statusRaw === "pending" ? (
                    <>
                      <button
                        type="button"
                        className="apply-btn lc-co-icon-btn-sm"
                        onClick={() => updateApplication(person.apiId, "accepted")}
                      >
                        ✓ Accept
                      </button>
                      <button
                        type="button"
                        className="apply-btn ghost lc-co-icon-btn-sm"
                        onClick={() => updateApplication(person.apiId, "rejected")}
                      >
                        ✕ Reject
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    className="apply-btn lc-co-icon-btn-sm"
                    disabled={!person.candidateUserId}
                    onClick={() =>
                      navigate(
                        `/messages?userId=${encodeURIComponent(String(person.candidateUserId))}`
                      )
                    }
                  >
                    <Mail size={16} strokeWidth={2} aria-hidden /> Message
                  </button>
                  <button
                    type="button"
                    className="apply-btn ghost lc-co-icon-btn-sm"
                    disabled={!person.candidateUserId}
                    onClick={() =>
                      navigate(`/candidate-profile/${person.candidateUserId}`)
                    }
                  >
                    <UserRound size={16} strokeWidth={2} aria-hidden /> Profile
                  </button>
                </div>
              </div>
            </div>
            <span className={`status-pill ${person.statusRaw}`}>
              ● {person.statusLabel}
            </span>
          </div>
        ))}
        {!applicantsFiltered.length ? (
          <p className="results-count">
            No applications in this view for the selected job.
          </p>
        ) : null}
      </div>
    </>
  );

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
    navigate(`${dashboardPath(user?.role)}?q=${encodeURIComponent(q)}`);
  };

  return (
    <motion.div className="candidate-page" {...lcMotionPage()}>
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
        subtitle="Company"
      />

      <div className="dashboard-body">
        <CandidateSidebar
          variant="company"
          user={user}
          activeKey={sidebarActive}
          notifUnread={notifUnread}
          messagesUnread={messagesUnread}
          pendingApplicantsCount={pendingAppsCount}
          onDashboard={() =>
            navigate("/company-dashboard", { state: { tab: "dashboard" } })
          }
          onFeed={() => navigate(FEED_PATH)}
          onMyJobs={() =>
            navigate("/company-dashboard", { state: { tab: "jobs" } })
          }
          onApplicants={() =>
            navigate("/company-dashboard", { state: { tab: "applicants" } })
          }
          onMessages={() => navigate("/messages")}
          onNotifications={() => navigate("/notifications")}
          onMyProfile={() => uid && navigate(`/company-profile/${uid}`)}
          onContactSupport={() => navigate("/messages?admin=true")}
          onSignOut={signOut}
          onFindJobs={() => {}}
          onApplications={() => {}}
          onSavedJobs={() => {}}
        />

        <main className="main-content co-company-main">
          {pageBanner?.text ? (
            <div
              className={`co-page-banner feed-notice ${
                pageBanner.kind === "ok" ? "feed-notice--ok" : "feed-notice--err"
              }`}
              role="status"
            >
              {pageBanner.text}
            </div>
          ) : null}
          {activeTab === "dashboard" && renderDashboard()}
          {activeTab === "jobs" && renderMyJobs()}
          {activeTab === "applicants" && renderApplicants()}
        </main>
      </div>

      <Modal
        open={jobModalOpen}
        wide
        title={editingJob ? "Edit job" : "Post a job"}
        onClose={() => {
          setJobModalOpen(false);
          setJobModalNotice("");
        }}
      >
        <form className="co-job-modal-form lc-co-post-job-modal" onSubmit={submitJobModal}>
          {jobModalNotice ? (
            <div className="co-job-modal-notice" role="alert">
              {jobModalNotice}
            </div>
          ) : null}
          <label className="co-modal-label">
            Title
            <input
              className="co-modal-input"
              value={jobForm.title}
              onChange={(e) => setJobForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
          </label>
          <label className="co-modal-label">
            Description
            <textarea
              className="co-modal-input co-modal-textarea"
              value={jobForm.description}
              onChange={(e) =>
                setJobForm((f) => ({ ...f, description: e.target.value }))
              }
              required
            />
          </label>
          <label className="co-modal-label">
            Location
            <input
              className="co-modal-input"
              value={jobForm.location}
              onChange={(e) =>
                setJobForm((f) => ({ ...f, location: e.target.value }))
              }
            />
          </label>
          <label className="co-modal-label">
            Type
            <select
              className="co-modal-input co-modal-select"
              value={jobForm.type}
              onChange={(e) => setJobForm((f) => ({ ...f, type: e.target.value }))}
            >
              <option value="">Select type (optional)</option>
              {jobTypeSelectOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
          <label className="co-modal-label">
            Salary
            <input
              className="co-modal-input"
              value={jobForm.salary}
              onChange={(e) =>
                setJobForm((f) => ({ ...f, salary: e.target.value }))
              }
            />
          </label>
          <label className="co-modal-label">
            Requirements
            <span className="co-modal-hint">One requirement per line (or comma-separated).</span>
            <textarea
              className="co-modal-input co-modal-textarea co-modal-textarea--reqs"
              rows={5}
              value={jobForm.requirements}
              onChange={(e) =>
                setJobForm((f) => ({ ...f, requirements: e.target.value }))
              }
              placeholder={"e.g. 3+ years React\nStrong English"}
            />
          </label>
          {!editingJob ? (
            <label className="co-modal-check">
              <input
                type="checkbox"
                checked={announceOnFeed}
                onChange={(e) => setAnnounceOnFeed(e.target.checked)}
              />
              <span>Also post a short hiring announcement on the company feed</span>
            </label>
          ) : null}
          <div className="co-modal-actions">
            <button
              type="button"
              className="apply-btn ghost"
              disabled={jobSubmitting}
              onClick={() => {
                setJobModalOpen(false);
                setJobModalNotice("");
              }}
            >
              Cancel
            </button>
            <button type="submit" className="apply-btn lc-co-icon-btn" disabled={jobSubmitting}>
              {jobSubmitting ? (
                <Loader2 className="lc-co-spin" size={18} strokeWidth={2.5} aria-hidden />
              ) : null}
              {editingJob ? "Save changes" : "Post Job"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(detailJob)}
        title={detailJob?.title || "Job details"}
        onClose={() => setDetailJob(null)}
        wide
      >
        {detailJob ? (
          <div className="co-job-detail-readonly">
            <p className="co-job-detail-meta">
              <span>{detailJob.location || "—"}</span>
              <span className="co-job-detail-dot">·</span>
              <span>{detailJob.type || "—"}</span>
              <span className="co-job-detail-dot">·</span>
              <span>{detailJob.salary || "—"}</span>
            </p>
            <p className="co-job-detail-status">
              Status:{" "}
              <strong>{detailJob.status === "closed" ? "Closed" : "Active"}</strong>
              {" · "}
              Applicants:{" "}
              <strong>
                {detailJob.applicantsCount ?? detailJob.applicants_count ?? 0}
              </strong>
              {" · "}
              Posted:{" "}
              <strong>
                {formatRelativeTime(detailJob.createdAt || detailJob.created_at) || "—"}
              </strong>
            </p>
            <h4 className="co-job-detail-heading">Description</h4>
            <p className="co-job-detail-desc">{detailJob.description || "—"}</p>
            {detailJobRequirements.length ? (
              <>
                <h4 className="co-job-detail-heading">Requirements</h4>
                <ul className="co-job-detail-reqs">
                  {detailJobRequirements.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </>
            ) : null}
            <div className="co-modal-actions co-job-detail-actions">
              <button type="button" className="apply-btn ghost" onClick={() => setDetailJob(null)}>
                Close
              </button>
              <button
                type="button"
                className="apply-btn"
                onClick={() => {
                  const j = detailJob;
                  setDetailJob(null);
                  if (j) openEditModal(j);
                }}
              >
                <Pencil size={16} strokeWidth={2} aria-hidden /> Edit
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(interviewModalPerson)}
        wide
        title="Schedule Interview"
        onClose={closeInterviewModal}
      >
        {interviewModalPerson ? (
          <form
            className="co-job-modal-form lc-co-interview-modal"
            onSubmit={submitInterviewModal}
          >
            <p className="co-applicant-job-line" style={{ marginTop: 0 }}>
              {interviewModalPerson.name} — {interviewModalPerson.jobTitle}
            </p>
            <label className="co-modal-label">
              Date
              <input
                type="date"
                className="co-modal-input"
                required
                value={interviewForm.date}
                onChange={(e) =>
                  setInterviewForm((f) => ({ ...f, date: e.target.value }))
                }
              />
            </label>
            <label className="co-modal-label">
              Time
              <input
                type="time"
                className="co-modal-input"
                required
                value={interviewForm.time}
                onChange={(e) =>
                  setInterviewForm((f) => ({ ...f, time: e.target.value }))
                }
              />
            </label>
            <label className="co-modal-label">
              Mode
              <select
                className="co-modal-input co-modal-select"
                value={interviewForm.mode}
                onChange={(e) =>
                  setInterviewForm((f) => ({ ...f, mode: e.target.value }))
                }
              >
                <option value="online">Online</option>
                <option value="office">Office</option>
              </select>
            </label>
            <label className="co-modal-label">
              Meeting link or location
              <input
                className="co-modal-input"
                value={interviewForm.locationOrLink}
                placeholder="Zoom / Meet link, or office address"
                onChange={(e) =>
                  setInterviewForm((f) => ({
                    ...f,
                    locationOrLink: e.target.value,
                  }))
                }
              />
            </label>
            <label className="co-modal-label">
              Message to candidate
              <textarea
                className="co-modal-input co-modal-textarea"
                rows={3}
                value={interviewForm.message}
                placeholder="Optional"
                onChange={(e) =>
                  setInterviewForm((f) => ({ ...f, message: e.target.value }))
                }
              />
            </label>
            <div className="co-modal-actions">
              <button
                type="button"
                className="apply-btn ghost"
                disabled={interviewSubmitting}
                onClick={closeInterviewModal}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="apply-btn lc-co-icon-btn"
                disabled={interviewSubmitting}
              >
                {interviewSubmitting ? (
                  <Loader2 className="lc-co-spin" size={18} strokeWidth={2.5} aria-hidden />
                ) : null}
                Submit
              </button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(deleteJobTarget)}
        title="Delete this job?"
        onClose={() => !jobSubmitting && setDeleteJobTarget(null)}
      >
        {deleteJobTarget ? (
          <div className="co-delete-job-modal">
            <p>
              This will permanently remove <strong>{deleteJobTarget.title}</strong> and cannot
              be undone.
            </p>
            <div className="co-modal-actions">
              <button
                type="button"
                className="apply-btn ghost"
                disabled={jobSubmitting}
                onClick={() => setDeleteJobTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="apply-btn danger lc-co-icon-btn"
                disabled={jobSubmitting}
                onClick={confirmDeleteJob}
              >
                {jobSubmitting ? (
                  <Loader2 className="lc-co-spin" size={18} strokeWidth={2.5} aria-hidden />
                ) : (
                  <Trash2 size={18} strokeWidth={2} aria-hidden />
                )}
                Delete
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      {cvImagePreviewSrc ? (
        <div
          className="cv-image-lightbox-backdrop"
          role="presentation"
          onClick={closeCvPreview}
        >
          <button
            type="button"
            className="cv-image-lightbox-close"
            aria-label="Close"
            onClick={closeCvPreview}
          >
            <X size={28} strokeWidth={2} aria-hidden />
          </button>
          <img
            className="cv-image-lightbox-img"
            src={cvImagePreviewSrc}
            alt="CV attachment"
            onClick={(ev) => ev.stopPropagation()}
          />
        </div>
      ) : null}
    </motion.div>
  );
}

export default CompanyDashboard;
