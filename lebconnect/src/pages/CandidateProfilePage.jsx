import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Flag,
  Mail,
  MessageCircle,
  Share2,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../api/axios";
import UserAvatar from "../components/UserAvatar";
import CandidateSidebar from "../components/CandidateSidebar";
import Modal from "../components/Modal";
import {
  dashboardPath,
  FEED_PATH,
  getToken,
  getUser,
  isLoggedIn,
  logout,
  setAuth,
} from "../utils/auth";
import {
  compressDataUrlForUpload,
  fileToCompressedDataUrl,
} from "../utils/imageUpload";
import { useAuthUser } from "../hooks/useAuthUser";
import {
  loadFollowSet,
  subscribeFollowChanges,
  toggleFollowInStorage,
} from "../utils/feedStorage";
import { hydrateFollowing, toggleFollowViaApi } from "../utils/followApi";
import CategoryPicker from "../components/CategoryPicker";
import {
  composeCategoryErrors,
  CANDIDATE_SPECIALIZATION_OPTIONS,
  inferCategorySelection,
  OTHER_LABEL,
} from "../constants/categories";
import {
  getCoverImage,
  getInitials,
  getProfileImage,
  isDisplayableMediaUrl,
} from "../utils/profileMedia";
import { normalizeStoredUser } from "../utils/sessionUser";
import AppTopbar from "../components/AppTopbar";
import ReportContentModal from "../components/ReportContentModal";
import VerifiedCompanyBadge from "../components/VerifiedCompanyBadge";
import DashboardRail from "../components/DashboardRail";
import CvKeywordAnalysisCard from "../components/CvKeywordAnalysisCard";
import { displayNameFromUser } from "../utils/avatar";
import { safeUiString } from "../utils/uiString";
import { fileToDataUrl } from "../utils/fileToDataUrl";
import { openUploadedCv } from "../utils/cvViewer";
import "./CandidateDashboard.css";
import "./CandidateProfilePage.css";
import "./Dashboard.css";
import { mapApiPost, idsEqual } from "../utils/feedPostMap";

const MAX_PROFILE_CV_BYTES = 10 * 1024 * 1024;

const EMPTY_CANDIDATE_PROFILE = {
  profileType: "candidate",
  fullName: "",
  specialization: "",
  location: "",
  bio: "",
  skills: [],
  education: [],
  experience: [],
  profileImage: null,
  coverImage: null,
  candidateCv: null,
  candidateCvFileName: null,
  candidateCvText: null,
  posts: [],
};

function normalizeSkillsList(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((s) =>
        typeof s === "string"
          ? s.trim()
          : safeUiString(String(s?.title ?? s?.name ?? ""), "")
      )
      .filter(Boolean);
  }
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return [];
    try {
      const p = JSON.parse(t);
      if (Array.isArray(p)) return normalizeSkillsList(p);
    } catch {
      /* comma / semicolon list */
    }
    return t
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function formatLoadError(error) {
  const m =
    error?.response?.data?.message ??
    error?.response?.data ??
    error?.message;
  if (typeof m === "string" && m.trim()) return m.trim();
  if (m && typeof m === "object") {
    try {
      return JSON.stringify(m);
    } catch {
      return "Request failed.";
    }
  }
  return "Profile not found or could not load.";
}

function formatEduRowForEdit(e) {
  return typeof e === "string"
    ? e.trim()
    : [e?.school, e?.degree].filter(Boolean).join(" · ").trim();
}

function formatExpRowForEdit(e) {
  return typeof e === "string"
    ? e.trim()
    : [e?.title, e?.company].filter(Boolean).join(" · ").trim();
}

/** Snapshot for edit modal — module scope so hooks can run before loading branch. */
function getCandidateEditFormDefaults(profile) {
  if (!profile || profile.profileType !== "candidate") return null;
  const prof = profile;
  const fullName =
    safeUiString(prof.fullName ?? prof.full_name, "").trim() || "Member";
  const specialization = safeUiString(prof.specialization, "").trim();
  const profileLocation = safeUiString(prof.location, "").trim();
  const bio =
    typeof prof.bio === "string"
      ? prof.bio.trim()
      : safeUiString(prof.bio != null ? String(prof.bio) : "", "").trim();
  const profileMediaUser = { ...prof, role: prof.role || "candidate" };
  const profilePic = getProfileImage(profileMediaUser);
  const coverRaw = getCoverImage(prof);
  const skillsArr = normalizeSkillsList(prof.skills);

  let education = Array.isArray(prof.education) ? prof.education : [];
  if (
    !education.length &&
    typeof prof.education === "string" &&
    prof.education.trim()
  ) {
    try {
      const p = JSON.parse(prof.education);
      education = Array.isArray(p) ? p : [];
    } catch {
      education = [];
    }
  }
  let experience = Array.isArray(prof.experience) ? prof.experience : [];
  if (
    !experience.length &&
    typeof prof.experience === "string" &&
    prof.experience.trim()
  ) {
    try {
      const p = JSON.parse(prof.experience);
      experience = Array.isArray(p) ? p : [];
    } catch {
      experience = [];
    }
  }
  const educationFlat = education
    .map(formatEduRowForEdit)
    .filter(Boolean)
    .join(", ");
  const experienceFlat = experience
    .map(formatExpRowForEdit)
    .filter(Boolean)
    .join(", ");
  const specializationPick = inferCategorySelection(
    specialization,
    CANDIDATE_SPECIALIZATION_OPTIONS
  );

  return {
    fullName: fullName || "",
    specializationCategory: specializationPick.category,
    specializationOther: specializationPick.custom,
    location: profileLocation || "",
    bio,
    skills: skillsArr
      .map((s) =>
        typeof s === "string" ? s : String(s?.title || s?.name || "").trim()
      )
      .filter(Boolean)
      .join(", "),
    education: educationFlat,
    experience: experienceFlat,
    profileImage: profilePic || "",
    coverImage: coverRaw || "",
  };
}

function CandidateProfilePage() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const viewerBase = useAuthUser();
  const viewerId = viewerBase?.id ?? viewerBase?._id;
  const stored = getUser();
  const currentUser =
    stored && typeof stored === "object" ? stored : {};
  const profileIdRaw =
    routeId != null && String(routeId).trim() !== ""
      ? routeId
      : currentUser?.id ?? currentUser?._id ?? null;
  const profileId =
    profileIdRaw != null && String(profileIdRaw).trim() !== ""
      ? profileIdRaw
      : null;

  const [activeTab, setActiveTab] = useState("about");
  const [profile, setProfile] = useState(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [notifUnread, setNotifUnread] = useState(0);
  const [messagesUnread, setMessagesUnread] = useState(0);
  const [applicationsActivityUnread, setApplicationsActivityUnread] = useState(0);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [statusKind, setStatusKind] = useState("");
  const [topSearch, setTopSearch] = useState("");
  const [followedSet, setFollowedSet] = useState(() => loadFollowSet());
  const [editForm, setEditForm] = useState({
    fullName: "",
    specializationCategory: "",
    specializationOther: "",
    location: "",
    bio: "",
    skills: "",
    education: "",
    experience: "",
    profileImage: "",
    coverImage: "",
  });
  const [specFieldErrors, setSpecFieldErrors] = useState({
    cat: "",
    cust: "",
  });

  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectEditing, setProjectEditing] = useState(null);
  const [projectForm, setProjectForm] = useState({
    title: "",
    description: "",
    link: "",
    technologies: "",
    image: "",
  });
  const [projectSaving, setProjectSaving] = useState(false);
  const [cvUploading, setCvUploading] = useState(false);
  const cvFileInputRef = useRef(null);
  const [feedCommentDrafts, setFeedCommentDrafts] = useState({});
  const [feedExpandedComments, setFeedExpandedComments] = useState({});
  const [feedLightboxSrc, setFeedLightboxSrc] = useState(null);
  const [feedReportTarget, setFeedReportTarget] = useState(null);
  const feedCommentAreaRefs = useRef({});

  const reloadProfile = async () => {
    try {
      if (!profileId) return;
      const { data } = await api.get(`/api/users/profile/${profileId}`);
      if (data && typeof data === "object") {
        setProfile(data);
        setUsedFallback(false);
        setFetchError("");
      } else {
        setProfile({ ...EMPTY_CANDIDATE_PROFILE });
        setUsedFallback(true);
        setFetchError("Invalid profile response.");
      }
    } catch (e) {
      setProfile({ ...EMPTY_CANDIDATE_PROFILE });
      setUsedFallback(true);
      setFetchError(formatLoadError(e));
    }
  };

  useEffect(() => {
    let cancelled = false;
    setProfile(null);
    setUsedFallback(false);
    setFetchError("");
    if (!profileId) {
      setProfile({ ...EMPTY_CANDIDATE_PROFILE });
      setUsedFallback(true);
      setFetchError("Missing profile id. Sign in again or open My Profile from the sidebar.");
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      try {
        const { data } = await api.get(`/api/users/profile/${profileId}`);
        if (!cancelled) {
          if (data && typeof data === "object") {
            setProfile(data);
            setUsedFallback(false);
            setFetchError("");
          } else {
            setProfile({ ...EMPTY_CANDIDATE_PROFILE });
            setUsedFallback(true);
            setFetchError("Invalid profile response.");
          }
        }
      } catch (e) {
        if (!cancelled) {
          setProfile({ ...EMPTY_CANDIDATE_PROFILE });
          setUsedFallback(true);
          setFetchError(formatLoadError(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  const reloadProjectsList = useCallback(async () => {
    const uid = Number(profileId);
    if (!Number.isFinite(uid)) return;
    setProjectsLoading(true);
    setProjectsError(false);
    try {
      const { data } = await api.get(`/api/projects/user/${uid}`);
      setProjects(Array.isArray(data) ? data : []);
    } catch {
      setProjects([]);
      setProjectsError(true);
    } finally {
      setProjectsLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    void reloadProjectsList();
  }, [reloadProjectsList]);

  useEffect(() => {
    if (!isLoggedIn()) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/api/notifications");
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        const unread = list.filter((n) => !n.isRead);
        setNotifUnread(unread.length);
        setApplicationsActivityUnread(
          unread.filter((n) => {
            const t = String(n.type || "").toLowerCase();
            return t === "application" || t === "interview" || t === "status";
          }).length
        );
      } catch {
        setNotifUnread(0);
        setApplicationsActivityUnread(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isLoggedIn()) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/api/messages/conversations");
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setMessagesUnread(
          list.reduce((acc, row) => acc + Number(row.unread || 0), 0)
        );
      } catch {
        if (!cancelled) setMessagesUnread(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => subscribeFollowChanges(setFollowedSet), []);

  useEffect(() => {
    if (!isLoggedIn()) {
      setFollowedSet(loadFollowSet());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await hydrateFollowing(setFollowedSet);
      } catch {
        if (!cancelled) setFollowedSet(loadFollowSet());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [viewerId]);

  const followedSetSafe = useMemo(() => {
    if (followedSet instanceof Set) return followedSet;
    return new Set();
  }, [followedSet]);

  const safeProjects = useMemo(
    () => (Array.isArray(projects) ? projects : []),
    [projects]
  );

  const viewerOwnProfile =
    viewerId && profileId && String(viewerId) === String(profileId);

  const handleCvFileChange = async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    if (!viewerOwnProfile) return;
    const low = (file.name || "").toLowerCase();
    if (!/\.(pdf|doc|docx)$/.test(low)) {
      setStatusKind("error");
      setStatusMsg("Please upload a PDF, DOC, or DOCX file.");
      ev.target.value = "";
      return;
    }
    if (file.size > MAX_PROFILE_CV_BYTES) {
      setStatusKind("error");
      setStatusMsg("File is too large. Please upload a file under 10MB.");
      ev.target.value = "";
      return;
    }

    setCvUploading(true);
    setStatusMsg("");
    try {
      const candidateCv = await fileToDataUrl(file);
      const { data } = await api.put("/api/users/profile", {
        candidateCv,
        candidateCvFileName: file.name || "cv-upload",
      });
      const u = data?.user ?? null;
      const tok = getToken();
      if (tok && u) {
        const prev = getUser() || {};
        setAuth(tok, { ...prev, ...u });
      }
      await reloadProfile();
      setStatusKind("success");
      setStatusMsg("CV uploaded and saved.");
    } catch (err) {
      console.error("[candidate CV upload]", err);
      const detail =
        err.response?.data?.message ??
        err.message ??
        "Could not save CV.";
      setStatusKind("error");
      setStatusMsg(String(detail));
      try {
        await reloadProfile();
      } catch {
        /* ignore */
      }
    } finally {
      setCvUploading(false);
      ev.target.value = "";
    }
  };

  const clearUploadedCv = async () => {
    if (!viewerOwnProfile) return;
    if (!window.confirm("Remove the CV saved on your LebConnect profile?")) return;
    setCvUploading(true);
    setStatusMsg("");
    try {
      const { data } = await api.put("/api/users/profile", {
        candidateCv: null,
        candidateCvFileName: null,
        candidateCvText: null,
      });
      const u = data?.user ?? null;
      const tok = getToken();
      if (tok && u) {
        const prev = getUser() || {};
        setAuth(tok, { ...prev, ...u });
      }
      await reloadProfile();
      setStatusKind("success");
      setStatusMsg("CV removed from profile.");
    } catch (err) {
      console.error("[clear CV]", err);
      const detail =
        err.response?.data?.message ??
        err.message ??
        "Could not remove CV.";
      setStatusKind("error");
      setStatusMsg(String(detail));
    } finally {
      setCvUploading(false);
    }
  };

  const viewer = useMemo(() => {
    if (!viewerBase) return null;
    if (!viewerOwnProfile || !profile || profile.profileType !== "candidate") {
      return viewerBase;
    }
    return normalizeStoredUser({
      ...viewerBase,
      ...profile,
      role: profile.role || viewerBase.role || "candidate",
      id: viewerBase.id ?? viewerBase._id,
      email: viewerBase.email,
    });
  }, [viewerBase, viewerOwnProfile, profile]);

  const experienceRows = useMemo(() => {
    if (!profile || profile.profileType !== "candidate") return [];
    let ex = Array.isArray(profile.experience) ? profile.experience : [];
    if (
      !ex.length &&
      typeof profile.experience === "string" &&
      profile.experience.trim()
    ) {
      try {
        const p = JSON.parse(profile.experience);
        ex = Array.isArray(p) ? p : [];
      } catch {
        ex = [];
      }
    }
    return ex
      .map((row, i) => {
        const title =
          typeof row === "string"
            ? row.trim()
            : String(row?.title || row?.role || "").trim();
        const company =
          typeof row === "string" ? "" : String(row?.company || "").trim();
        const timeline = [row?.start, row?.end].filter(Boolean).join(" — ");
        const loc =
          typeof row === "object" && row?.location ? String(row.location) : "";
        const line =
          typeof row === "string"
            ? row.trim()
            : [title, company].filter(Boolean).join(" · ").trim();
        const key = line || `row-${i}`;
        const hasDetail =
          (typeof row === "string" && line) ||
          (typeof row !== "string" &&
            Boolean(title || company || timeline || loc));
        if (!hasDetail) return null;
        return {
          key: `${key}-${i}`,
          title: title || (typeof row === "string" ? line : "Experience"),
          company,
          timeline,
          loc,
          initials: getInitials({ fullName: company || title || "Experience" }),
        };
      })
      .filter(Boolean);
  }, [profile]);

  const openEditModal = useCallback(() => {
    const defaults = getCandidateEditFormDefaults(profile);
    if (!defaults) return;
    setStatusMsg("");
    setStatusKind("");
    setSpecFieldErrors({ cat: "", cust: "" });
    setEditForm(defaults);
    setIsEditOpen(true);
  }, [profile]);

  const mergePostIntoProfile = useCallback((updatedPost) => {
    if (!updatedPost || typeof updatedPost !== "object") return;
    setProfile((prev) => {
      if (!prev || prev.profileType !== "candidate") return prev;
      const pid = updatedPost.id ?? updatedPost._id;
      const arr = Array.isArray(prev.posts) ? [...prev.posts] : [];
      const ix = arr.findIndex((p) => String(p.id ?? p._id) === String(pid));
      if (ix < 0) return prev;
      arr[ix] = updatedPost;
      return { ...prev, posts: arr };
    });
  }, []);

  const postsSource = useMemo(() => {
    if (!profile || profile.profileType !== "candidate") return [];
    return Array.isArray(profile.posts) ? profile.posts : [];
  }, [profile]);

  const feedMappedPosts = useMemo(() => {
    return postsSource
      .filter((p) => p && typeof p === "object")
      .map((p, i) => mapApiPost(p, i, viewerId))
      .filter(Boolean);
  }, [postsSource, viewerId]);

  const handleProfilePostLike = useCallback(
    async (post) => {
      if (!post.postId) return;
      try {
        const { data } = await api.put(`/api/posts/${post.postId}/like`);
        const refreshed = data?.post;
        if (refreshed) mergePostIntoProfile(refreshed);
        else await reloadProfile();
      } catch (e) {
        alert(e.response?.data?.message || e.message || "Could not like");
      }
    },
    [mergePostIntoProfile, reloadProfile]
  );

  const handleProfilePostShare = useCallback(
    async (post) => {
      if (!post.postId) return;
      try {
        const { data } = await api.put(`/api/posts/${post.postId}/share`);
        const count = data?.shareCount;
        if (count != null) {
          setProfile((prev) => {
            if (!prev || prev.profileType !== "candidate") return prev;
            const arr = Array.isArray(prev.posts) ? [...prev.posts] : [];
            const ix = arr.findIndex(
              (p) => String(p.id ?? p._id) === String(post.postId)
            );
            if (ix < 0) return prev;
            const row = { ...arr[ix], shareCount: Number(count) };
            arr[ix] = row;
            return { ...prev, posts: arr };
          });
        }
      } catch {
        await reloadProfile();
      }
    },
    [reloadProfile]
  );

  const handleProfilePostComment = useCallback(
    async (post) => {
      const text = feedCommentDrafts[post.postId];
      if (!post.postId || !text?.trim()) return;
      try {
        const { data } = await api.post(`/api/posts/${post.postId}/comments`, {
          text: text.trim(),
        });
        setFeedCommentDrafts((d) => ({ ...d, [post.postId]: "" }));
        if (data?.post) mergePostIntoProfile(data.post);
        else await reloadProfile();
      } catch (e) {
        alert(e.response?.data?.message || e.message || "Could not comment");
      }
    },
    [feedCommentDrafts, mergePostIntoProfile, reloadProfile]
  );

  const handleProfilePostDelete = useCallback(
    async (post) => {
      if (!post.postId) return;
      if (!window.confirm("Delete this post?")) return;
      try {
        await api.delete(`/api/posts/${post.postId}`);
        await reloadProfile();
      } catch (e) {
        alert(e.response?.data?.message || e.message || "Delete failed");
      }
    },
    [reloadProfile]
  );

  const toggleProfilePostComments = useCallback((postId) => {
    if (!postId) return;
    setFeedExpandedComments((prev) => {
      const opening = !prev[postId];
      if (opening) {
        queueMicrotask(() => {
          feedCommentAreaRefs.current[String(postId)]?.focus?.();
        });
      }
      return { ...prev, [postId]: opening };
    });
  }, []);

  const goAuthorFromPost = useCallback(
    (post) => {
      const id = post.authorId;
      if (id == null || id === "") return;
      const role = (post.authorRole || "").toLowerCase();
      if (role === "company") {
        navigate(`/company-profile/${id}`);
        return;
      }
      navigate(`/candidate-profile/${id}`);
    },
    [navigate]
  );

  useEffect(() => {
    if (profile === null || profile.profileType !== "candidate") return;
    const st =
      routerLocation.state && typeof routerLocation.state === "object"
        ? routerLocation.state
        : null;
    const openCvSection = st?.focusCv || st?.openSection === "cv-analysis";
    if (!st?.openEdit && !openCvSection) return;
    if (st.openEdit) {
      queueMicrotask(() => openEditModal());
    }
    if (openCvSection) {
      setActiveTab("about");
      requestAnimationFrame(() => {
        document
          .getElementById("profile-cv-anchor")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    navigate(routerLocation.pathname, { replace: true, state: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot open from navigation signals
  }, [routerLocation.state, routerLocation.pathname, profile, navigate, openEditModal]);

  const viewerLabel = safeUiString(
    viewer?.fullName || viewer?.companyName || viewer?.email,
    "Member"
  );

  const signOut = () => {
    logout();
    navigate("/login");
  };

  const goMyProfile = () => {
    const uid = viewer?.id ?? viewer?._id;
    if (uid) navigate(`/candidate-profile/${uid}`);
  };

  const goRoleHome = () => {
    if (viewer?.role) navigate(dashboardPath(viewer.role));
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
    if (viewer?.role === "candidate") {
      navigate("/candidate-dashboard", { state: { tab: "findJobs", q } });
      return;
    }
    if (viewer?.role) {
      navigate(`${dashboardPath(viewer.role)}?q=${encodeURIComponent(q)}`);
      return;
    }
    navigate(`/?q=${encodeURIComponent(q)}`);
  };

  if (profile === null) {
    return (
      <div className="candidate-page">
        <AppTopbar
          user={viewerBase}
          searchPlaceholder="Search jobs, companies..."
          searchValue={topSearch}
          onSearchChange={(e) => setTopSearch(e.target.value)}
          onSearchKeyDown={handleTopSearchKeyDown}
          notifUnread={notifUnread}
          messagesUnread={messagesUnread}
          onLogoClick={goRoleHome}
          onHomeClick={goRoleHome}
          onMessagesClick={() =>
            viewerBase ? navigate("/messages") : navigate("/login")
          }
          onNotificationsClick={() =>
            viewerBase ? navigate("/notifications") : navigate("/login")
          }
          subtitle={
            displayNameFromUser(viewerBase)
              ? "Profile"
              : "Professional profile"
          }
        />
        <div className="layout">
          <CandidateSidebar
            user={viewerBase}
            activeKey="myProfile"
            notifUnread={notifUnread}
            messagesUnread={messagesUnread}
            applicationsUnread={applicationsActivityUnread}
            onDashboard={() => navigate("/candidate-dashboard")}
            onFeed={() => navigate(FEED_PATH)}
            onFindJobs={() =>
              navigate("/candidate-dashboard", { state: { tab: "findJobs" } })
            }
            onApplications={() =>
              navigate("/candidate-dashboard", {
                state: { tab: "applications" },
              })
            }
            onSavedJobs={() =>
              navigate("/candidate-dashboard", { state: { tab: "savedJobs" } })
            }
            onMessages={() =>
              viewerBase ? navigate("/messages") : navigate("/login")
            }
            onNotifications={() =>
              viewerBase ? navigate("/notifications") : navigate("/login")
            }
            onMyProfile={goMyProfile}
            onSignOut={signOut}
          />
          <main className="main-content lc-profile-loading-main">
            <div className="lc-profile-loading-shell lc-glass-card">
              <p>Loading profile…</p>
            </div>
          </main>
          <DashboardRail />
        </div>
      </div>
    );
  }

  if (profile.profileType === "company") {
    return <Navigate to={`/company-profile/${profileId}`} replace />;
  }

  const prof =
    profile.profileType === "candidate" ? profile : EMPTY_CANDIDATE_PROFILE;

  const cvStrForFp = String(prof.candidateCv || prof.candidate_cv || "").trim();
  const cvFnForFp = String(
    prof.candidateCvFileName || prof.candidate_cv_file_name || ""
  ).trim();
  const candidateCvFingerprint =
    cvStrForFp || cvFnForFp
      ? `${new TextEncoder().encode(cvStrForFp).length}|${cvFnForFp}`
      : "";

  const fullName = (prof.fullName || "").trim() || "Member";
  const specialization = (prof.specialization || "").trim();
  const profileLocation = (prof.location || "").trim();
  const bio = typeof prof.bio === "string" ? prof.bio.trim() : "";
  const profileMediaUser = { ...prof, role: prof.role || "candidate" };
  const profilePic = getProfileImage(profileMediaUser);
  const profileImageUrl = isDisplayableMediaUrl(profilePic) ? profilePic : "";
  const coverRaw = getCoverImage(prof);
  const coverImageUrl = isDisplayableMediaUrl(coverRaw) ? coverRaw : "";
  let skills = Array.isArray(prof.skills) ? prof.skills : [];
  if (!Array.isArray(skills) && prof.skills) {
    try {
      const p = JSON.parse(prof.skills);
      skills = Array.isArray(p) ? p : [];
    } catch {
      skills = [];
    }
  }

  let education = Array.isArray(prof.education) ? prof.education : [];
  if (!education.length && typeof prof.education === "string" && prof.education.trim()) {
    try {
      const p = JSON.parse(prof.education);
      education = Array.isArray(p) ? p : [];
    } catch {
      education = [];
    }
  }
  let experience = Array.isArray(prof.experience) ? prof.experience : [];
  if (!experience.length && typeof prof.experience === "string" && prof.experience.trim()) {
    try {
      const p = JSON.parse(prof.experience);
      experience = Array.isArray(p) ? p : [];
    } catch {
      experience = [];
    }
  }
  const formatEduRow = (e) =>
    typeof e === "string"
      ? e.trim()
      : [e?.school, e?.degree].filter(Boolean).join(" · ").trim();
  const formatExpRow = (e) =>
    typeof e === "string"
      ? e.trim()
      : [e?.title, e?.company].filter(Boolean).join(" · ").trim();
  const educationFlat = education.map(formatEduRow).filter(Boolean).join(", ");
  const educationText = educationFlat;
  const experienceText = experience.map(formatExpRow).filter(Boolean).join(", ");
  const experienceFlat = experienceText;
  const specializationPick = inferCategorySelection(
    specialization,
    CANDIDATE_SPECIALIZATION_OPTIONS
  );

  const buildCandidatePutBody = () => ({
    fullName,
    specializationCategory: specializationPick.category,
    specializationOther: specializationPick.custom,
    location: profileLocation,
    bio,
    skills: (skills || [])
      .map((s) =>
        typeof s === "string" ? s : String(s?.title || s?.name || "").trim()
      )
      .filter(Boolean),
    education: education.map(formatEduRow).filter(Boolean),
    experience: experience.map(formatExpRow).filter(Boolean),
  });

  const isFollowingThisCandidate =
    profileId != null &&
    profileId !== "" &&
    followedSetSafe.has(String(profileId));

  const toggleFollowCandidate = async () => {
    if (profileId == null || profileId === "") return;
    const sid = String(profileId);
    const has = followedSetSafe.has(sid);
    if (!isLoggedIn()) {
      setFollowedSet(toggleFollowInStorage(profileId));
      return;
    }
    try {
      const next = await toggleFollowViaApi(profileId, has);
      if (next) setFollowedSet(next);
    } catch (err) {
      const msg =
        err.response?.data?.message || err.message || "Could not update follow.";
      alert(msg);
    }
  };

  const handleFileChange = async (event, field) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const input = event.target;
    let dataUrl = "";
    try {
      dataUrl = await fileToCompressedDataUrl(file);
    } catch {
      setStatusKind("error");
      setStatusMsg("Could not read selected image.");
      input.value = "";
      return;
    }
    setEditForm((prev) => ({ ...prev, [field]: dataUrl }));
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            ...(field === "profileImage"
              ? { profileImage: dataUrl, profile_image: dataUrl }
              : { coverImage: dataUrl, cover_image: dataUrl }),
          }
        : prev
    );

    if (!viewerOwnProfile) {
      input.value = "";
      return;
    }

    try {
      const payload = {
        ...buildCandidatePutBody(),
        ...(field === "profileImage"
          ? { profileImage: dataUrl }
          : { coverImage: dataUrl }),
      };
      const { data } = await api.put("/api/users/profile", payload);
      const tok = getToken();
      if (tok && data?.user) {
        setAuth(tok, { ...(getUser() || {}), ...data.user });
      }
      await reloadProfile();
      setStatusKind("success");
      setStatusMsg(
        field === "coverImage"
          ? "Cover photo saved."
          : "Profile photo saved."
      );
    } catch (err) {
      console.error(
        "[PUT /api/users/profile]",
        err.response?.data ?? err.message ?? err
      );
      const detail =
        err.response?.data?.message ??
        err.response?.data?.error ??
        (typeof err.response?.data === "string" ? err.response.data : null) ??
        err.message ??
        "Could not save photo.";
      setStatusKind("error");
      setStatusMsg(String(detail));
      try {
        await reloadProfile();
      } catch {
        /* ignore */
      }
    } finally {
      input.value = "";
    }
  };

  const parseCommaList = (value) =>
    String(value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const submitEditProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatusKind("");
    setStatusMsg("");
    const specErr = composeCategoryErrors(
      editForm.specializationCategory,
      editForm.specializationOther,
      CANDIDATE_SPECIALIZATION_OPTIONS
    );
    if (specErr.category || specErr.custom) {
      setSpecFieldErrors({ cat: specErr.category, cust: specErr.custom });
      setSaving(false);
      return;
    }
    setSpecFieldErrors({ cat: "", cust: "" });
    try {
      const specializationOther =
        editForm.specializationCategory === OTHER_LABEL
          ? editForm.specializationOther.trim()
          : "";
      let pit =
        typeof editForm.profileImage === "string"
          ? editForm.profileImage.trim()
          : "";
      let cit =
        typeof editForm.coverImage === "string"
          ? editForm.coverImage.trim()
          : "";
      if (pit && pit.startsWith("data:image"))
        pit = await compressDataUrlForUpload(pit);
      if (cit && cit.startsWith("data:image"))
        cit = await compressDataUrlForUpload(cit);

      const payload = {
        fullName: editForm.fullName.trim(),
        specializationCategory: editForm.specializationCategory.trim(),
        specializationOther,
        location: editForm.location.trim(),
        bio: editForm.bio.trim(),
        skills: parseCommaList(editForm.skills),
        education: parseCommaList(editForm.education),
        experience: parseCommaList(editForm.experience),
      };
      if (pit && isDisplayableMediaUrl(pit)) payload.profileImage = pit;
      if (cit && isDisplayableMediaUrl(cit)) payload.coverImage = cit;
      const { data } = await api.put("/api/users/profile", payload);
      const u = data?.user ?? null;
      const tok = getToken();
      if (tok && u) {
        const prev = getUser() || {};
        setAuth(tok, { ...prev, ...u });
      }
      await reloadProfile();
      setStatusKind("success");
      setStatusMsg("Profile updated successfully.");
      setIsEditOpen(false);
    } catch (err) {
      console.error(
        "[PUT /api/users/profile]",
        err.response?.data ?? err.message ?? err
      );
      const detail =
        err.response?.data?.message ??
        err.response?.data?.error ??
        (typeof err.response?.data === "string" ? err.response.data : null) ??
        err.message ??
        "Could not update profile.";
      setStatusKind("error");
      setStatusMsg(String(detail));
      try {
        await reloadProfile();
      } catch {
        /* ignore */
      }
    } finally {
      setSaving(false);
    }
  };

  const renderAbout = () => (
    <div className="candidate-tab-content">
      <h3>About</h3>
      {bio ? (
        <p className="candidate-about-text">{bio}</p>
      ) : (
        <div style={{ marginBottom: 12 }}>
          <p className="candidate-about-text lc-profile-empty-msg">
            {usedFallback
              ? "We couldn't load this profile."
              : "No about information added yet."}
          </p>
          {viewerOwnProfile ? (
            <button
              type="button"
              className="candidate-outline-btn"
              style={{ marginTop: 8 }}
              onClick={openEditModal}
            >
              ✎ Edit Profile
            </button>
          ) : null}
        </div>
      )}

      <div className="candidate-about-grid">
        <div className="candidate-about-card">
          <div className="candidate-about-icon">💼</div>
          <div>
            <h4>Current Role</h4>
            <p>
              {specialization ||
                (!usedFallback ? (
                  <span className="lc-profile-muted">Not added yet.</span>
                ) : (
                  <span className="lc-profile-muted">—</span>
                ))}
            </p>
          </div>
        </div>

        <div className="candidate-about-card">
          <div className="candidate-about-icon">📍</div>
          <div>
            <h4>Location</h4>
            <p>
              {profileLocation ||
                (!usedFallback ? (
                  <span className="lc-profile-muted">Not added yet.</span>
                ) : (
                  <span className="lc-profile-muted">—</span>
                ))}
            </p>
          </div>
        </div>

        <div className="candidate-about-card">
          <div className="candidate-about-icon">🎓</div>
          <div>
            <h4>Education</h4>
            <p>
              {educationFlat ? (
                educationFlat
              ) : !usedFallback ? (
                <span className="lc-profile-muted">No education added yet.</span>
              ) : (
                <span className="lc-profile-muted">—</span>
              )}
            </p>
          </div>
        </div>

            <div className="candidate-about-card">
          <div className="candidate-about-icon">🕒</div>
          <div>
            <h4>Experience</h4>
            <p>
              {experienceFlat ? (
                experienceFlat
              ) : !usedFallback ? (
                <span className="lc-profile-muted">No experience added yet.</span>
              ) : (
                <span className="lc-profile-muted">—</span>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="candidate-skill-section" id="profile-cv-anchor">
        <h3>CV / Résumé</h3>
        {viewerOwnProfile ? (
          <>
            <input
              ref={cvFileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,application/pdf"
              style={{ display: "none" }}
              onChange={handleCvFileChange}
              disabled={cvUploading || saving}
              aria-hidden
            />
            <p className="candidate-about-text" style={{ marginBottom: 10 }}>
              {(() => {
                const fn =
                  (
                    prof.candidateCvFileName ||
                    prof.candidate_cv_file_name ||
                    ""
                  ).trim();
                const has = Boolean((prof.candidateCv || prof.candidate_cv || "").trim());
                if (!has)
                  return "No CV uploaded. Recruiters you message will rely on what you paste in applications.";
                return `Uploaded: ${fn || "your CV file"}`;
              })()}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <button
                type="button"
                className="candidate-outline-btn"
                disabled={cvUploading || saving}
                onClick={() => cvFileInputRef.current?.click()}
              >
                {(prof.candidateCv || prof.candidate_cv || "").trim()
                  ? "Replace CV"
                  : "Upload CV"}
              </button>
              {(prof.candidateCv || prof.candidate_cv || "").trim() ? (
                <button
                  type="button"
                  className="candidate-primary-btn"
                  disabled={cvUploading}
                  onClick={() => {
                    const ok = openUploadedCv(
                      prof.candidateCv || prof.candidate_cv,
                      prof.candidateCvFileName || prof.candidate_cv_file_name || ""
                    );
                    if (!ok) {
                      alert("Could not open this CV.");
                    }
                  }}
                >
                  View CV
                </button>
              ) : null}
              {(prof.candidateCv || prof.candidate_cv || "").trim() ? (
                <button
                  type="button"
                  className="candidate-outline-btn"
                  disabled={cvUploading}
                  onClick={() => void clearUploadedCv()}
                >
                  Remove CV
                </button>
              ) : null}
            </div>
            {cvUploading ? (
              <p className="candidate-about-text" style={{ marginTop: 8, opacity: 0.85 }}>
                Uploading…
              </p>
            ) : null}
            <div
              className="lc-profile-cv-analysis lc-glass-card"
              style={{ marginTop: 16, padding: "1rem 1.1rem", borderRadius: 12 }}
            >
              <CvKeywordAnalysisCard
                userId={profileId}
                hasCvFile={Boolean((prof.candidateCv || prof.candidate_cv || "").trim())}
                cvFingerprint={candidateCvFingerprint}
              />
            </div>
          </>
        ) : (
          <p className="lc-profile-muted" style={{ marginBottom: 8 }}>
            CV upload stays private until you attach it elsewhere.
          </p>
        )}
      </div>

      <div className="candidate-skill-section">
        <h3>Skills</h3>
        {skills.length ? (
          <div className="candidate-skills">
            {skills.map((s, i) => (
              <span key={`${typeof s === "string" ? s : i}-${i}`}>
                {typeof s === "string" ? s : s.title || "—"}
              </span>
            ))}
          </div>
        ) : (
          <>
            <p className="candidate-about-text lc-profile-empty-msg">
              No skills added yet.
            </p>
            {viewerOwnProfile ? (
              <button
                type="button"
                className="candidate-outline-btn"
                onClick={openEditModal}
              >
                ✎ Edit Profile to add skills
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );

  const renderExperience = () => (
    <div className="candidate-tab-content">
      {experienceRows.length === 0 ? (
        <>
          <p className="candidate-about-text lc-profile-empty-msg">
            No experience added yet.
          </p>
          {viewerOwnProfile ? (
            <button
              type="button"
              className="candidate-outline-btn"
              onClick={openEditModal}
            >
              ✎ Edit Profile to add experience
            </button>
          ) : null}
        </>
      ) : (
        experienceRows.map((row) => (
          <div className="experience-card" key={row.key}>
            <div className="experience-logo">{row.initials}</div>
            <div>
              <h4>{row.title}</h4>
              {row.company ? <p>{row.company}</p> : null}
              <span>
                {row.timeline}
                {row.loc ? `${row.timeline ? " · " : ""}${row.loc}` : ""}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const openProjectCreate = () => {
    setProjectEditing(null);
    setProjectForm({
      title: "",
      description: "",
      link: "",
      technologies: "",
      image: "",
    });
    setProjectModalOpen(true);
  };

  const openProjectEdit = (p) => {
    setProjectEditing(p);
    setProjectForm({
      title: p.title || "",
      description: p.description || "",
      link: p.link || "",
      technologies: p.technologies || "",
      image: "",
    });
    setProjectModalOpen(true);
  };

  const pickProjectImage = async (ev) => {
    const file = ev.target.files?.[0];
    if (!file || !String(file.type || "").startsWith("image/")) return;
    try {
      const dataUrl = await fileToCompressedDataUrl(file, 1400, 0.82);
      setProjectForm((f) => ({
        ...f,
        image: compressDataUrlForUpload(dataUrl),
      }));
    } catch {
      alert("Could not read image.");
    } finally {
      ev.target.value = "";
    }
  };

  const saveProject = async (e) => {
    e.preventDefault();
    if (!viewerOwnProfile) return;
    const title = projectForm.title.trim();
    if (!title) {
      alert("Project title required.");
      return;
    }
    const basePayload = {
      title,
      description: projectForm.description.trim(),
      link: projectForm.link.trim(),
      technologies: projectForm.technologies.trim(),
    };
    setProjectSaving(true);
    try {
      const imagePayload = projectForm.image?.trim()
        ? projectForm.image.trim()
        : "";
      if (projectEditing?.id) {
        const body = { ...basePayload };
        if (imagePayload) body.image = imagePayload;
        await api.put(`/api/projects/${projectEditing.id}`, body);
      } else {
        await api.post("/api/projects", {
          ...basePayload,
          ...(imagePayload ? { image: imagePayload } : {}),
        });
      }
      setProjectModalOpen(false);
      setStatusMsg("Project saved.");
      setStatusKind("success");
      await reloadProjectsList();
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Save failed");
    } finally {
      setProjectSaving(false);
    }
  };

  const deleteProject = async (pid) => {
    if (!viewerOwnProfile || !window.confirm("Delete this project?")) return;
    try {
      await api.delete(`/api/projects/${pid}`);
      setStatusMsg("Project removed.");
      setStatusKind("success");
      await reloadProjectsList();
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Could not delete");
    }
  };

  const renderPortfolio = () => (
    <div className="candidate-tab-content lc-portfolio-tab">
      {projectsLoading ? (
        <p className="lc-profile-muted">Loading projects…</p>
      ) : null}
      {projectsError ? (
        <p className="candidate-about-text lc-profile-muted">
          Projects could not load from the API.
        </p>
      ) : null}
      {viewerOwnProfile ? (
        <button
          type="button"
          className="candidate-primary-btn lc-port-add"
          onClick={openProjectCreate}
        >
          + Add project
        </button>
      ) : null}
      {!projectsLoading && safeProjects.length === 0 && !projectsError ? (
        <p className="candidate-about-text lc-profile-muted">
          No portfolio items yet.
        </p>
      ) : null}
      <ul className="lc-project-grid">
        {safeProjects.map((p, pi) => {
          const techs = String(p.technologies || "")
            .split(/[,;\n]+/)
            .map((s) => s.trim())
            .filter(Boolean);
          const imgOk = isDisplayableMediaUrl(p.image);
          const pid = p.id ?? p._id ?? `idx-${pi}`;
          return (
            <li key={pid} className="lc-project-card lc-glass-mini">
              {imgOk ? (
                <div className="lc-project-cover">
                  <img src={p.image} alt="" />
                </div>
              ) : null}
              <h4>{p.title}</h4>
              {p.description ? (
                <p className="lc-project-desc">{p.description}</p>
              ) : null}
              {techs.length ? (
                <div className="lc-project-tags">
                  {techs.map((t) => (
                    <span key={`${pid}-${t}`} className="lc-project-tag">
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}
              {p.link ? (
                <a
                  className="lc-project-link"
                  href={
                    /^https?:\/\//i.test(p.link.trim())
                      ? p.link.trim()
                      : `https://${p.link.trim()}`
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  View link ↗
                </a>
              ) : null}
              {viewerOwnProfile ? (
                <div className="lc-project-actions">
                  <button
                    type="button"
                    className="candidate-outline-btn"
                    onClick={() => openProjectEdit(p)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="candidate-outline-btn"
                    onClick={() => deleteProject(p.id)}
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );

  const roleLower = String(viewerBase?.role || "").toLowerCase();

  const canDeleteProfilePost = (post) => {
    if (!post.postId) return false;
    if (roleLower === "admin") return true;
    return post.authorId != null && idsEqual(viewerId, post.authorId);
  };

  const renderPosts = () => (
    <div className="candidate-tab-content lc-profile-posts-feed">
      {!feedMappedPosts.length ? (
        <p className="candidate-about-text lc-profile-empty-msg">No posts yet.</p>
      ) : null}
      {feedMappedPosts.map((post, idx) => {
        const chipTone =
          post.authorRole === "company" ? "post-company-chip" : "post-person-chip";
        const authorClickable = post.authorId != null && post.authorId !== "";
        const authorMain = (
          <>
            <div className="post-avatar-slot">
              <UserAvatar
                user={null}
                name={post.company}
                src={post.authorProfileImage}
                size={48}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="post-title-row">
                <h3>{post.company}</h3>
                {post.authorRole === "company" && post.authorIsVerified ? (
                  <VerifiedCompanyBadge />
                ) : null}
                <span className={`company-chip ${chipTone}`}>{post.label}</span>
              </div>
              <p className="post-subtitle">{post.subtitle}</p>
              <p className="post-role-line">{post.badgeSubtitle}</p>
              <p className="post-time">{post.time}</p>
            </div>
          </>
        );

        return (
          <div
            className="post-card lc-post-card-motion"
            key={post.postId ?? `${post.company}-${post.time}-${idx}`}
          >
            <div className="post-header">
              <div className="post-author">
                {authorClickable ? (
                  <button
                    type="button"
                    className="post-author-click"
                    onClick={() => goAuthorFromPost(post)}
                    aria-label={`View profile: ${post.company}`}
                  >
                    {authorMain}
                  </button>
                ) : (
                  <div className="post-author-static">{authorMain}</div>
                )}
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {canDeleteProfilePost(post) ? (
                  <button
                    type="button"
                    className="post-more"
                    title="Delete post"
                    onClick={() => void handleProfilePostDelete(post)}
                  >
                    <Trash2 size={18} strokeWidth={2} aria-hidden />
                  </button>
                ) : null}
                {isLoggedIn() && post.postId != null && !canDeleteProfilePost(post) ? (
                  <button
                    type="button"
                    className="post-more"
                    title="Report this post"
                    onClick={() =>
                      setFeedReportTarget({ type: "post", id: Number(post.postId) })
                    }
                  >
                    <Flag size={18} strokeWidth={2} aria-hidden />
                  </button>
                ) : null}
              </div>
            </div>

            <div className="post-text">
              <p>{post.text1}</p>
            </div>

            {post.image ? (
              <button
                type="button"
                className="post-image-wrap"
                onClick={() => setFeedLightboxSrc(post.image)}
                aria-label="View image larger"
              >
                <img className="post-image post-image--feed" src={post.image} alt="" />
              </button>
            ) : null}

            <div className="post-actions">
              <button
                type="button"
                className={post.liked ? "lc-post-like--active" : ""}
                onClick={() => void handleProfilePostLike(post)}
              >
                <ThumbsUp size={18} strokeWidth={2} className="lc-post-act-icon" aria-hidden />
                Like
                {post.likesCount != null ? ` (${post.likesCount})` : ""}
              </button>
              <button
                type="button"
                onClick={() => toggleProfilePostComments(post.postId)}
              >
                <MessageCircle size={18} strokeWidth={2} className="lc-post-act-icon" aria-hidden />
                Comment
                {post.commentsCount != null ? ` (${post.commentsCount})` : ""}
              </button>
              <button type="button" onClick={() => void handleProfilePostShare(post)}>
                <Share2 size={18} strokeWidth={2} className="lc-post-act-icon" aria-hidden />
                Share
              </button>
              {viewerId &&
              post.authorId != null &&
              post.authorId !== "" &&
              !idsEqual(viewerId, post.authorId) ? (
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/messages?userId=${encodeURIComponent(String(post.authorId))}`)
                  }
                >
                  <Mail size={18} strokeWidth={2} className="lc-post-act-icon" aria-hidden />
                  Send
                </button>
              ) : null}
            </div>

            {post.postId && feedExpandedComments[post.postId] ? (
              <div className="lc-comment-shell">
                <div className="lc-comment-intro">Comments</div>
                <div className="lc-comment-list">
                  {(Array.isArray(post.comments) ? post.comments : []).length === 0 ? (
                    <p className="lc-comment-time">No comments yet. Be the first to comment.</p>
                  ) : (
                    (Array.isArray(post.comments) ? post.comments : []).map((c) => (
                      <div className="lc-comment-row" key={String(c.id)}>
                        <UserAvatar user={null} name={c.who} src={c.avatar} size={40} />
                        <div className="lc-comment-bubble">
                          <div className="lc-comment-meta">
                            <strong>{c.who}</strong>
                            <span className="lc-comment-time">{c.time}</span>
                          </div>
                          <div className="lc-comment-text">{c.text}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="lc-comment-composer">
                  <textarea
                    ref={(el) => {
                      if (post.postId != null) {
                        feedCommentAreaRefs.current[String(post.postId)] = el;
                      }
                    }}
                    placeholder="Write a comment…"
                    rows={2}
                    value={feedCommentDrafts[post.postId] || ""}
                    onChange={(e) =>
                      setFeedCommentDrafts((d) => ({
                        ...d,
                        [post.postId]: e.target.value,
                      }))
                    }
                  />
                  <button
                    type="button"
                    className="lc-comment-send"
                    onClick={() => void handleProfilePostComment(post)}
                  >
                    Comment
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="candidate-page">
      <AppTopbar
        user={viewer}
        searchPlaceholder="Search jobs, companies..."
        searchValue={topSearch}
        onSearchChange={(e) => setTopSearch(e.target.value)}
        onSearchKeyDown={handleTopSearchKeyDown}
        notifUnread={notifUnread}
        messagesUnread={messagesUnread}
        onLogoClick={goRoleHome}
        onHomeClick={goRoleHome}
        onMessagesClick={() =>
          viewer ? navigate("/messages") : navigate("/login")
        }
        onNotificationsClick={() =>
          viewer ? navigate("/notifications") : navigate("/login")
        }
        subtitle={
          specialization ||
          safeUiString(viewerLabel, "") ||
          "Candidate"
        }
      />

      <div className="layout">
        <CandidateSidebar
          user={viewer || prof}
          activeKey="myProfile"
          notifUnread={notifUnread}
          messagesUnread={messagesUnread}
          applicationsUnread={applicationsActivityUnread}
          onDashboard={() => navigate("/candidate-dashboard")}
          onFeed={() => navigate(FEED_PATH)}
          onFindJobs={() =>
            navigate("/candidate-dashboard", { state: { tab: "findJobs" } })
          }
          onApplications={() =>
            navigate("/candidate-dashboard", { state: { tab: "applications" } })
          }
          onSavedJobs={() =>
            navigate("/candidate-dashboard", { state: { tab: "savedJobs" } })
          }
          onMessages={() => (viewer ? navigate("/messages") : navigate("/login"))}
          onNotifications={() =>
            viewer ? navigate("/notifications") : navigate("/login")
          }
          onMyProfile={goMyProfile}
          onSignOut={signOut}
        />

        <main className="main-content lc-candidate-profile-shell">
          {fetchError ? (
            <div className="feed-notice" role="alert" style={{ marginBottom: 12 }}>
              <strong>Profile not found or could not load.</strong>{" "}
              {safeUiString(fetchError, "")}
              <button
                type="button"
                className="candidate-outline-btn"
                style={{ marginLeft: 10 }}
                onClick={() => void reloadProfile()}
              >
                Retry
              </button>
            </div>
          ) : null}
          <div className="candidate-header-card">
            <div
              className="candidate-cover"
              style={
                coverImageUrl
                  ? { backgroundImage: `url(${coverImageUrl})` }
                  : undefined
              }
            >
              {viewerOwnProfile && (
                <label className="cover-upload-btn">
                  Change Cover
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, "coverImage")}
                  />
                </label>
              )}
            </div>

            <div className="candidate-header-content">
              <div className="candidate-header-top">
                <div className="candidate-brand-block">
                  <div className="candidate-avatar-column">
                    <UserAvatar
                      name={fullName}
                      src={profileImageUrl || undefined}
                      size={112}
                      className="candidate-avatar-large"
                    />
                    {viewerOwnProfile ? (
                      <label className="avatar-upload-btn">
                        Change Photo
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileChange(e, "profileImage")}
                        />
                      </label>
                    ) : null}
                  </div>

                <div className="candidate-main-info">
                    <div className="candidate-name-row">
                      <h1>{fullName}</h1>
                      <span className="candidate-verified-icon">✓</span>
                    </div>

                    <p className="candidate-role">
                      {specialization ? (
                        specialization
                      ) : viewerOwnProfile ? (
                        <span className="lc-profile-muted">
                          Add your focus area in Edit Profile
                        </span>
                      ) : (
                        <span className="lc-profile-muted">—</span>
                      )}
                    </p>
                    <p className="candidate-location">
                      {profileLocation ? (
                        <>📍 {profileLocation}</>
                      ) : viewerOwnProfile ? (
                        <span className="lc-profile-muted">
                          Add your location in Edit Profile
                        </span>
                      ) : (
                        <span className="lc-profile-muted">—</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="candidate-header-actions">
                  {viewerOwnProfile && (
                    <button
                      type="button"
                      className="candidate-primary-btn"
                      onClick={openEditModal}
                    >
                      ✎ Edit Profile
                    </button>
                  )}
                  {!viewerOwnProfile && profileId ? (
                    <button
                      type="button"
                      className={
                        isFollowingThisCandidate
                          ? "candidate-outline-btn"
                          : "candidate-primary-btn"
                      }
                      onClick={toggleFollowCandidate}
                    >
                      {isFollowingThisCandidate ? "✓ Following" : "+ Follow"}
                    </button>
                  ) : null}
                  {viewer && !viewerOwnProfile && profileId ? (
                    <button
                      type="button"
                      className="candidate-outline-btn"
                      onClick={() =>
                        navigate(`/messages?userId=${profileId}`)
                      }
                    >
                      💬 Message
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="candidate-stats-row">
                <div className="candidate-stat">
                  <strong>{feedMappedPosts.length}</strong>
                  <span>Posts</span>
                </div>

                <div className="candidate-stat">
                  <strong>—</strong>
                  <span>Connections</span>
                </div>

                <div className="candidate-stat">
                  <strong>—</strong>
                  <span>Years Exp.</span>
                </div>
              </div>
            </div>
          </div>
          {statusMsg && (
            <p
              className={
                statusKind === "success"
                  ? "profile-status-msg success"
                  : "profile-status-msg error"
              }
            >
              {statusMsg}
            </p>
          )}

          <div className="candidate-tabs-card">
            <div className="candidate-tabs">
              <button
                type="button"
                className={
                  activeTab === "about"
                    ? "candidate-tab active"
                    : "candidate-tab"
                }
                onClick={() => setActiveTab("about")}
              >
                About
              </button>

              <button
                type="button"
                className={
                  activeTab === "experience"
                    ? "candidate-tab active"
                    : "candidate-tab"
                }
                onClick={() => setActiveTab("experience")}
              >
                Experience
              </button>

              <button
                type="button"
                className={
                  activeTab === "posts"
                    ? "candidate-tab active"
                    : "candidate-tab"
                }
                onClick={() => setActiveTab("posts")}
              >
                Posts
              </button>

              <button
                type="button"
                className={
                  activeTab === "portfolio"
                    ? "candidate-tab active"
                    : "candidate-tab"
                }
                onClick={() => setActiveTab("portfolio")}
              >
                Portfolio
              </button>
            </div>

            {activeTab === "about" && renderAbout()}
            {activeTab === "experience" && renderExperience()}
            {activeTab === "posts" && renderPosts()}
            {activeTab === "portfolio" && renderPortfolio()}
          </div>
        </main>

        <DashboardRail />
      </div>
      {isEditOpen && (
        <div className="edit-profile-modal-backdrop">
          <form className="edit-profile-modal" onSubmit={submitEditProfile}>
            <h3>Edit Profile</h3>
            <label>
              Full Name
              <input
                value={editForm.fullName}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, fullName: e.target.value }))
                }
                required
              />
            </label>
            <CategoryPicker
              variant="candidate"
              idPrefix="cand-prof"
              category={editForm.specializationCategory}
              custom={editForm.specializationOther}
              categoryError={specFieldErrors.cat}
              customError={specFieldErrors.cust}
              onCategoryChange={(v) =>
                setEditForm((prev) => ({ ...prev, specializationCategory: v }))
              }
              onCustomChange={(v) =>
                setEditForm((prev) => ({ ...prev, specializationOther: v }))
              }
            />
            <label>
              Location
              <input
                value={editForm.location}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, location: e.target.value }))
                }
              />
            </label>
            <label>
              Bio
              <textarea
                value={editForm.bio}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, bio: e.target.value }))
                }
              />
            </label>
            <label>
              Skills (comma separated)
              <input
                value={editForm.skills}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, skills: e.target.value }))
                }
              />
            </label>
            <label>
              Education
              <input
                value={editForm.education}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, education: e.target.value }))
                }
              />
            </label>
            <label>
              Experience
              <input
                value={editForm.experience}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, experience: e.target.value }))
                }
              />
            </label>
            <label>
              Profile Photo
              <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, "profileImage")} />
            </label>
            <label>
              Cover Photo
              <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, "coverImage")} />
            </label>
            <div className="edit-profile-actions">
              <button
                type="button"
                className="candidate-outline-btn"
                onClick={() => setIsEditOpen(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button type="submit" className="candidate-primary-btn" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}

      <Modal
        open={projectModalOpen}
        title={projectEditing?.id ? "Edit project" : "Add project"}
        onClose={() => !projectSaving && setProjectModalOpen(false)}
      >
        <form className="lc-project-modal-form" onSubmit={saveProject}>
          <label className="lc-review-field">
            Title
            <input
              value={projectForm.title}
              disabled={projectSaving}
              onChange={(e) =>
                setProjectForm((f) => ({ ...f, title: e.target.value }))
              }
              required
              maxLength={255}
            />
          </label>
          <label className="lc-review-field">
            Description
            <textarea
              rows={3}
              value={projectForm.description}
              disabled={projectSaving}
              onChange={(e) =>
                setProjectForm((f) => ({
                  ...f,
                  description: e.target.value,
                }))
              }
            />
          </label>
          <label className="lc-review-field">
            Link (URL)
            <input
              value={projectForm.link}
              disabled={projectSaving}
              onChange={(e) =>
                setProjectForm((f) => ({ ...f, link: e.target.value }))
              }
              placeholder="https://…"
            />
          </label>
          <label className="lc-review-field">
            Technologies (comma separated)
            <input
              value={projectForm.technologies}
              disabled={projectSaving}
              onChange={(e) =>
                setProjectForm((f) => ({
                  ...f,
                  technologies: e.target.value,
                }))
              }
            />
          </label>
          <label className="lc-review-field">
            Cover image (optional)
            <input
              type="file"
              accept="image/*"
              disabled={projectSaving}
              onChange={pickProjectImage}
            />
          </label>
          <div className="lc-project-modal-actions">
            <button
              type="button"
              className="candidate-outline-btn"
              disabled={projectSaving}
              onClick={() => setProjectModalOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="candidate-primary-btn" disabled={projectSaving}>
              {projectSaving ? "Saving…" : "Save project"}
            </button>
          </div>
        </form>
      </Modal>

      <ReportContentModal
        open={feedReportTarget != null}
        onClose={() => setFeedReportTarget(null)}
        targetType={
          feedReportTarget && feedReportTarget.type ? feedReportTarget.type : "post"
        }
        targetId={
          feedReportTarget && typeof feedReportTarget === "object"
            ? feedReportTarget.id
            : null
        }
        title="Report this post"
      />

      {feedLightboxSrc ? (
        <div
          className="feed-lightbox-backdrop"
          role="presentation"
          onClick={() => setFeedLightboxSrc(null)}
        >
          <button
            type="button"
            className="feed-lightbox-close"
            aria-label="Close"
            onClick={() => setFeedLightboxSrc(null)}
          >
            <X size={22} strokeWidth={2} aria-hidden />
          </button>
          <img
            className="feed-lightbox-img"
            src={feedLightboxSrc}
            alt=""
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}

export default CandidateProfilePage;
