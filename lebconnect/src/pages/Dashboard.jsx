import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import UserAvatar from "../components/UserAvatar";
import CandidateSidebar from "../components/CandidateSidebar";
import { formatRelativeTime, initialsFromName } from "../utils/format";
import { displayNameFromUser } from "../utils/avatar";
import { getProfileImage, isDisplayableMediaUrl } from "../utils/profileMedia";
import { dashboardPath, getUser, isLoggedIn, logout } from "../utils/auth";
import { useAuthUser } from "../hooks/useAuthUser";
import {
  commentExtrasKey,
  loadCommentExtrasFlat,
  loadFollowSet,
  saveCommentExtrasFlat,
  subscribeFollowChanges,
  toggleFollowInStorage,
} from "../utils/feedStorage";
import { hydrateFollowing, toggleFollowViaApi } from "../utils/followApi";
import "./Dashboard.css";
import "./CandidateDashboard.css";

const STATIC_POSTS = [
  {
    company: "TechBeirut",
    label: "Company",
    authorRole: "company",
    subtitle: "Leading Tech Company · Beirut",
    time: "1h ago · 🌐",
    text1:
      "🚀 We're excited to announce sample content — connect your backend to see live posts.",
    text2: "",
    hashtags: "",
    image: null,
    logo: "TB",
    logoClass: "tb-logo",
    postId: null,
    likesCount: 0,
    liked: false,
    commentsCount: 0,
    comments: [],
    shareCount: 0,
    authorId: null,
    authorProfileImage: null,
  },
  {
    company: "Phoenix Media Group",
    label: "Company",
    authorRole: "company",
    subtitle: "Media & Marketing · Beirut",
    time: "3h ago · 🌐",
    text1: "Sample post when the feed API is unavailable.",
    text2: "",
    hashtags: "",
    image: null,
    logo: "PM",
    logoClass: "pm-logo",
    postId: null,
    likesCount: 0,
    liked: false,
    commentsCount: 0,
    comments: [],
    shareCount: 0,
    authorId: null,
    authorProfileImage: null,
  },
];

const LOGO_CLASSES = ["tb-logo", "pm-logo"];

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function idsEqual(a, b) {
  if (a === null || a === undefined || b === null || b === undefined) return false;
  if (a === "" || b === "") return false;
  return String(a) === String(b);
}

function ComposerPostSendIcon() {
  return (
    <svg
      className="composer-post-send-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"
      />
    </svg>
  );
}

function mapComment(c) {
  const u = c.user || {};
  const who = u.companyName || u.fullName || "Member";
  const avatarRaw = getProfileImage(u);
  return {
    id: c._id ?? c.id,
    text: c.text,
    who,
    time: formatRelativeTime(c.createdAt),
    userId: u.id ?? u._id,
    role: u.role,
    avatar: isDisplayableMediaUrl(avatarRaw) ? avatarRaw : null,
  };
}

function mapApiPost(p, idx, currentUserId) {
  const a = p.author || {};
  const name = a.companyName || a.fullName || "Member";
  const label = a.role === "company" ? "Company" : "Candidate";
  const subtitle = [a.industry || a.specialization, a.location]
    .filter(Boolean)
    .join(" · ");
  const liked =
    Array.isArray(p.likes) &&
    p.likes.some((x) =>
      idsEqual(currentUserId, x.id ?? x._id)
    );

  const rawImg = p.image;
  const image =
    rawImg != null && String(rawImg).trim() !== "" ? String(rawImg).trim() : null;

  const authorIdRaw = a.id ?? a._id;
  const authorId =
    authorIdRaw != null && authorIdRaw !== "" ? authorIdRaw : null;
  const authorRole =
    typeof a.role === "string" ? String(a.role).toLowerCase() : "";
  const pi = getProfileImage(a);
  const authorProfileImage = isDisplayableMediaUrl(pi) ? pi : null;

  const badgeSubtitle =
    a.role === "company"
      ? a.industry || a.companyName || "Organization"
      : a.specialization || a.email || subtitle || "Professional";

  return {
    company: name,
    label,
    authorRole,
    subtitle: subtitle || "LebConnect member",
    badgeSubtitle,
    time: `${formatRelativeTime(p.createdAt)} · 🌐`,
    text1: p.content || "",
    text2: "",
    hashtags: "",
    image,
    logo: initialsFromName(name).slice(0, 2),
    logoClass: LOGO_CLASSES[idx % LOGO_CLASSES.length],
    postId: p.id ?? p._id,
    likesCount: Array.isArray(p.likes) ? p.likes.length : 0,
    liked,
    commentsCount: Array.isArray(p.comments) ? p.comments.length : 0,
    comments: Array.isArray(p.comments) ? p.comments.map(mapComment) : [],
    shareCount: Number(p.shareCount ?? 0),
    authorId,
    authorProfileImage,
    postType: String(p.postType ?? p.post_type ?? "standard").toLowerCase(),
    jobId: p.jobId ?? p.job_id ?? null,
    linkedJobTitle: p.linkedJobTitle ?? p.linked_job_title ?? null,
    linkedJobLocation: p.linkedJobLocation ?? p.linked_job_location ?? null,
    linkedJobType: p.linkedJobType ?? p.linked_job_type ?? null,
    linkedJobSalary: p.linkedJobSalary ?? p.linked_job_salary ?? null,
  };
}

const FEED_FILTER_OPTIONS = [
  { id: "all", label: "All Posts" },
  { id: "following", label: "Following" },
  { id: "samefield", label: "Same Field" },
  { id: "people", label: "People" },
  { id: "companies", label: "Companies" },
];

const EMOJI_QUICK = ["😀", "🎉", "🚀", "💼", "👏", "❤️", "🔥"];

/** Rough safe limit before JSON/base64 blows past 25MB express cap */
const SAFE_IMAGE_FILE_BYTES = 22 * 1024 * 1024;

function defaultExtra() {
  return { likes: 0, dislikes: 0, vote: null, replies: [] };
}

function Dashboard() {
  const navigate = useNavigate();
  const composerFileRef = useRef(null);
  const user = useAuthUser();
  const displayName = displayNameFromUser(user);
  const roleLabel =
    user?.role === "company"
      ? "Company"
      : user?.role === "admin"
        ? "Admin"
        : "Candidate";

  const [posts, setPosts] = useState(STATIC_POSTS);
  const [composer, setComposer] = useState("");
  const [composerImageUrl, setComposerImageUrl] = useState("");
  const [composerImage, setComposerImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [expandedComments, setExpandedComments] = useState({});
  const [feedFilter, setFeedFilter] = useState("all");
  const [followedSet, setFollowedSet] = useState(() => loadFollowSet());
  const [commentExtras, setCommentExtras] = useState(() =>
    loadCommentExtrasFlat()
  );
  const [replyTargetKey, setReplyTargetKey] = useState(null);
  const [replyDrafts, setReplyDrafts] = useState({});

  const [liveFeed, setLiveFeed] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [appliedJobIds, setAppliedJobIds] = useState(() => new Set());
  const [composerMode, setComposerMode] = useState("post");
  const [jobDraft, setJobDraft] = useState({
    title: "",
    location: "",
    type: "",
    salary: "",
    description: "",
    requirements: "",
  });

  const [notifUnread, setNotifUnread] = useState(0);
  const [feedNotice, setFeedNotice] = useState("");
  const [sendTarget, setSendTarget] = useState(null);
  const [sendReceiver, setSendReceiver] = useState("");
  const [sendText, setSendText] = useState("");
  const [topSearch, setTopSearch] = useState("");
  const [messagesUnread, setMessagesUnread] = useState(0);

  const uid = user?.id ?? user?._id;

  useEffect(() => {
    saveCommentExtrasFlat(commentExtras);
  }, [commentExtras]);

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
  }, [uid]);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const q =
        feedFilter === "all" ? "" : `?filter=${encodeURIComponent(feedFilter)}`;
      const { data } = await api.get(`/api/posts${q}`);
      if (Array.isArray(data)) {
        setLiveFeed(true);
        if (data.length === 0) {
          setPosts([]);
        } else {
          setPosts(data.map((p, i) => mapApiPost(p, i, uid)));
        }
      } else {
        setPosts([]);
        setLiveFeed(true);
      }
    } catch {
      setPosts(STATIC_POSTS);
      setLiveFeed(false);
    } finally {
      setLoading(false);
    }
  }, [feedFilter, uid]);

  const filteredPosts = useMemo(() => {
    if (liveFeed) return posts;
    return posts.filter((post) => {
      if (feedFilter === "all") return true;
      const aid =
        post.authorId != null && post.authorId !== ""
          ? String(post.authorId)
          : "";
      const role = (post.authorRole || "").toLowerCase();
      if (feedFilter === "following") {
        if (!aid) return false;
        return followedSet.has(aid);
      }
      if (feedFilter === "samefield") return false;
      if (feedFilter === "people") {
        if (!aid) return false;
        return role !== "company";
      }
      if (feedFilter === "companies") return role === "company";
      return true;
    });
  }, [posts, feedFilter, followedSet, liveFeed]);

  const patchCommentExtra = (postId, commentId, fn) => {
    const k = commentExtrasKey(postId, commentId);
    setCommentExtras((prev) => {
      const prevE = prev[k] || defaultExtra();
      const nextE = fn(prevE);
      return { ...prev, [k]: nextE };
    });
  };

  const toggleFollowAuthor = async (authorId) => {
    if (authorId == null || authorId === "") return;
    const sid = String(authorId);
    const has = followedSet.has(sid);
    if (!isLoggedIn()) {
      setFollowedSet(toggleFollowInStorage(authorId));
      return;
    }
    try {
      const next = await toggleFollowViaApi(authorId, has);
      if (next) setFollowedSet(next);
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Could not update follow.";
      alert(msg);
    }
  };

  const isFollowingAuthor = (authorId) =>
    authorId != null && followedSet.has(String(authorId));

  const handleCommentVote = (postId, commentId, kind) => {
    patchCommentExtra(postId, commentId, (e) => {
      let likes = Number(e.likes) || 0;
      let dislikes = Number(e.dislikes) || 0;
      let vote = e.vote;
      if (vote === kind) {
        return {
          ...e,
          vote: null,
          likes:
            kind === "like"
              ? Math.max(0, likes - 1)
              : likes,
          dislikes:
            kind === "dislike"
              ? Math.max(0, dislikes - 1)
              : dislikes,
        };
      }
      if (vote === "like") likes = Math.max(0, likes - 1);
      if (vote === "dislike") dislikes = Math.max(0, dislikes - 1);
      vote = kind;
      if (kind === "like") likes += 1;
      else dislikes += 1;
      return { ...e, vote, likes, dislikes };
    });
  };

  const submitReply = (postId, commentId) => {
    const rk = `${String(postId)}::${String(commentId)}`;
    const text = (replyDrafts[rk] || "").trim();
    if (!text || !postId || !commentId) return;
    const replyId = `r-${Date.now()}`;
    const av = user ? getProfileImage(user) : "";
    const reply = {
      id: replyId,
      text,
      time: formatRelativeTime(new Date()),
      userId: uid,
      name: displayNameFromUser(user),
      avatar: isDisplayableMediaUrl(av) ? av : null,
    };
    patchCommentExtra(postId, commentId, (e) => ({
      ...e,
      replies: [...(e.replies || []), reply],
    }));
    setReplyDrafts((d) => ({ ...d, [rk]: "" }));
    setReplyTargetKey(null);
  };

  const loadUnread = async () => {
    try {
      const { data } = await api.get("/api/notifications");
      const list = Array.isArray(data) ? data : [];
      setNotifUnread(list.filter((n) => !n.isRead).length);
    } catch {
      setNotifUnread(0);
    }
  };

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    loadUnread();
  }, []);

  useEffect(() => {
    if (user?.role !== "candidate" || !isLoggedIn()) {
      setAppliedJobIds(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/api/applications/my");
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        const ids = new Set(
          list
            .map((x) => Number(x.job?.id ?? x.job?._id ?? x.jobId))
            .filter((n) => Number.isFinite(n))
        );
        setAppliedJobIds(ids);
      } catch {
        if (!cancelled) setAppliedJobIds(new Set());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, user?.role]);

  useEffect(() => {
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
  }, [uid]);

  const insertComposerEmoji = (chunk) => {
    setComposer((prev) => (prev || "") + chunk);
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    const imgPayload =
      (composerImage && String(composerImage).trim()) ||
      composerImageUrl.trim();

    const isCompanyJobComposer =
      user?.role === "company" && composerMode === "job";

    if (isCompanyJobComposer) {
      if (!jobDraft.title.trim() || !jobDraft.description.trim()) {
        setFeedNotice("Job posts need a title and description.");
        return;
      }
    } else {
      const hasMedia = Boolean(imgPayload);
      if (!composer.trim() && !hasMedia) {
        setFeedNotice("Write something or add a photo.");
        return;
      }
    }

    setPosting(true);
    setFeedNotice("");

    try {
      if (isCompanyJobComposer) {
        const requirements = jobDraft.requirements
          .split(/[\n,]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        const { data: created } = await api.post("/api/jobs", {
          title: jobDraft.title.trim(),
          description: jobDraft.description.trim(),
          location: jobDraft.location.trim(),
          type: jobDraft.type.trim(),
          salary: jobDraft.salary.trim(),
          requirements,
        });
        const jobId =
          created?.job?.id ?? created?.job?._id ?? created?.id ?? created?._id;
        if (jobId == null || !Number.isFinite(Number(jobId))) {
          setFeedNotice(
            "Job was created but the response was unexpected. Refresh the feed and try posting again if needed."
          );
          await loadPosts();
          return;
        }
        const announce = `We are hiring: ${jobDraft.title.trim()}`;
        await api.post("/api/posts", {
          content: announce,
          ...(imgPayload ? { image: imgPayload } : {}),
          ...(jobId != null ? { jobId } : {}),
        });
        setJobDraft({
          title: "",
          location: "",
          type: "",
          salary: "",
          description: "",
          requirements: "",
        });
        setComposerMode("post");
      } else {
        const content =
          composer.trim() || (imgPayload ? " " : composer.trim());
        await api.post("/api/posts", {
          content,
          ...(imgPayload ? { image: imgPayload } : {}),
        });
      }

      setComposer("");
      setComposerImageUrl("");
      setComposerImage(null);
      setFeedNotice("Posted successfully.");
      await loadPosts();
      await loadUnread();
    } catch (err) {
      const raw =
        err.response?.data?.message || err.message || "Could not post.";
      setFeedNotice(raw);
    } finally {
      setPosting(false);
    }
  };

  const chooseComposerPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !String(file.type || "").startsWith("image/")) return;
    if (typeof file.size === "number" && file.size > SAFE_IMAGE_FILE_BYTES) {
      setFeedNotice(
        "That image file is too large to upload (~22 MB maximum before encoding). Pick a smaller file."
      );
      if (composerFileRef.current) composerFileRef.current.value = "";
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setComposerImage(dataUrl);
    } catch {
      setFeedNotice("Could not read that image.");
    } finally {
      if (composerFileRef.current) composerFileRef.current.value = "";
    }
  };

  const handleLike = async (post, idx) => {
    if (!post.postId) return;
    try {
      const { data } = await api.put(`/api/posts/${post.postId}/like`);
      const refreshed = data?.post;
      if (refreshed) {
        const mapped = mapApiPost(refreshed, idx, uid);
        setPosts((prev) =>
          prev.map((p) =>
            p.postId === post.postId
              ? { ...mapped, logoClass: LOGO_CLASSES[idx % LOGO_CLASSES.length] }
              : p
          )
        );
      } else {
        await loadPosts();
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Like failed");
    }
  };

  const handleShare = async (post) => {
    if (!post.postId) return;
    try {
      const { data } = await api.put(`/api/posts/${post.postId}/share`);
      const count = data?.shareCount;
      if (count != null) {
        setPosts((prev) =>
          prev.map((p) =>
            p.postId === post.postId ? { ...p, shareCount: Number(count) } : p
          )
        );
      }
      setFeedNotice("Post shared successfully.");
    } catch {
      setPosts((prev) =>
        prev.map((p) =>
          p.postId === post.postId
            ? { ...p, shareCount: (p.shareCount || 0) + 1 }
            : p
        )
      );
      setFeedNotice("Post shared.");
    }
  };

  const openSend = (post) => {
    setSendTarget(post);
    setSendReceiver("");
    setSendText("");
  };

  const submitSend = async () => {
    if (!sendTarget) return;
    if (!sendReceiver.trim() || !sendText.trim()) {
      setFeedNotice("Enter receiver and message first.");
      return;
    }
    try {
      await api.post("/api/messages", {
        to: sendReceiver.trim(),
        message: sendText.trim(),
        postId: sendTarget.postId,
      });
      setFeedNotice("Message sent.");
      setSendTarget(null);
    } catch {
      setFeedNotice("Message feature coming soon.");
      setSendTarget(null);
    }
  };

  const handleComment = async (post) => {
    const text = commentDrafts[post.postId];
    if (!post.postId || !text?.trim()) return;
    try {
      await api.post(`/api/posts/${post.postId}/comments`, {
        text: text.trim(),
      });
      setCommentDrafts((d) => ({ ...d, [post.postId]: "" }));
      await loadPosts();
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Comment failed");
    }
  };

  const handleDelete = async (post) => {
    if (!post.postId) return;
    if (!window.confirm("Delete this post?")) return;
    try {
      await api.delete(`/api/posts/${post.postId}`);
      await loadPosts();
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Delete failed");
    }
  };

  const toggleComments = (postId) => {
    if (!postId) return;
    setExpandedComments((prev) => ({
      ...prev,
      [postId]: !prev[postId],
    }));
  };

  const goAuthorProfile = (post) => {
    const id = post.authorId;
    if (id == null || id === "") return;
    const role = (post.authorRole || "").toLowerCase();
    if (role === "company") {
      navigate(`/company-profile/${id}`);
      return;
    }
    navigate(`/candidate-profile/${id}`);
  };

  const canDelete = (post) => {
    if (!post.postId) return false;
    if (user?.role === "admin") return true;
    return post.authorId != null && idsEqual(uid, post.authorId);
  };

  const showFollowBtn = (post) => {
    if (post.authorId == null || post.authorId === "") return false;
    return !idsEqual(uid, post.authorId);
  };

  const handleSignOut = () => {
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
    if (user?.role === "candidate") {
      navigate("/candidate-dashboard", { state: { tab: "findJobs", q } });
      return;
    }
    if (user?.role) {
      navigate(`${dashboardPath(user.role)}?q=${encodeURIComponent(q)}`);
      return;
    }
    navigate(`/?q=${encodeURIComponent(q)}`);
  };

  const mergedExtraFor = (postId, cid) => {
    const k = commentExtrasKey(postId, cid);
    return commentExtras[k] || defaultExtra();
  };

  const headerNameCompany = displayNameFromUser(user) || displayName;

  const companyNav = {
    onDashboard: () =>
      navigate("/company-dashboard", { state: { tab: "dashboard" } }),
    onFeed: () => navigate("/dashboard"),
    onMyJobs: () =>
      navigate("/company-dashboard", { state: { tab: "jobs" } }),
    onApplicants: () =>
      navigate("/company-dashboard", { state: { tab: "applicants" } }),
    onMessages: () => navigate("/messages"),
    onNotifications: () => navigate("/notifications"),
    onMyProfile: () => {
      if (!uid) return;
      navigate(`/company-profile/${uid}`);
    },
  };

  const feedMainEl = (
    <main className="feed-content">
          <div className="feed-filter-bar">
            <div className="filter-left">
              <span className="sort-label">Show:</span>
              {FEED_FILTER_OPTIONS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`filter-pill ${feedFilter === f.id ? "active" : ""}`}
                  onClick={() => setFeedFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="post-count">
              {loading ? "…" : `${filteredPosts.length} posts`}
            </div>
          </div>
          {feedNotice ? (
            <div
              className={`feed-notice ${feedNotice.toLowerCase().includes("posted successfully") ? "feed-notice--ok" : ""}`}
              role="status"
            >
              {feedNotice}
            </div>
          ) : null}

          <form className="composer-card" onSubmit={handleCreatePost}>
            {user?.role === "company" ? (
              <div className="composer-mode-toggle">
                <button
                  type="button"
                  className={composerMode === "post" ? "active" : ""}
                  onClick={() => {
                    setComposerMode("post");
                    setFeedNotice("");
                  }}
                >
                  Post
                </button>
                <button
                  type="button"
                  className={composerMode === "job" ? "active" : ""}
                  onClick={() => {
                    setComposerMode("job");
                    setFeedNotice("");
                  }}
                >
                  Job post
                </button>
              </div>
            ) : null}

            {composerMode === "job" && user?.role === "company" ? (
              <div className="composer-job-card">
                <h3 className="composer-job-card-title">Create Job Post</h3>
                <div className="composer-job-grid">
                  <label className="composer-job-field composer-job-field--full">
                    <span className="composer-job-label">Job Title</span>
                    <input
                      className="composer-job-field-input"
                      placeholder="Senior Product Designer"
                      value={jobDraft.title}
                      onChange={(e) =>
                        setJobDraft((j) => ({ ...j, title: e.target.value }))
                      }
                    />
                  </label>
                  <label className="composer-job-field">
                    <span className="composer-job-label">Location</span>
                    <input
                      className="composer-job-field-input"
                      placeholder="Beirut · Hybrid"
                      value={jobDraft.location}
                      onChange={(e) =>
                        setJobDraft((j) => ({ ...j, location: e.target.value }))
                      }
                    />
                  </label>
                  <label className="composer-job-field">
                    <span className="composer-job-label">Job Type</span>
                    <input
                      className="composer-job-field-input"
                      placeholder="Full-time"
                      value={jobDraft.type}
                      onChange={(e) =>
                        setJobDraft((j) => ({ ...j, type: e.target.value }))
                      }
                    />
                  </label>
                  <label className="composer-job-field composer-job-field--full">
                    <span className="composer-job-label">Salary</span>
                    <input
                      className="composer-job-field-input"
                      placeholder="$2,000 – $3,500 / mo"
                      value={jobDraft.salary}
                      onChange={(e) =>
                        setJobDraft((j) => ({ ...j, salary: e.target.value }))
                      }
                    />
                  </label>
                  <label className="composer-job-field composer-job-field--full">
                    <span className="composer-job-label">Description</span>
                    <textarea
                      className="composer-job-field-textarea"
                      placeholder="What the role entails, team, perks…"
                      value={jobDraft.description}
                      onChange={(e) =>
                        setJobDraft((j) => ({ ...j, description: e.target.value }))
                      }
                    />
                  </label>
                  <label className="composer-job-field composer-job-field--full">
                    <span className="composer-job-label">Requirements</span>
                    <textarea
                      className="composer-job-field-textarea"
                      placeholder={"e.g. 3+ years experience\nFluent English"}
                      value={jobDraft.requirements}
                      onChange={(e) =>
                        setJobDraft((j) => ({ ...j, requirements: e.target.value }))
                      }
                    />
                  </label>
                  <p className="composer-job-requirements-hint">
                    Write each requirement on a new line
                  </p>
                </div>

                <div className="composer-job-photo-row">
                  <input
                    ref={composerFileRef}
                    className="composer-photo-hidden"
                    type="file"
                    accept="image/*"
                    onChange={chooseComposerPhoto}
                    aria-hidden
                    tabIndex={-1}
                  />
                  <button
                    type="button"
                    className="composer-job-inline-photo-btn"
                    onClick={() => composerFileRef.current?.click()}
                  >
                    📷 Add optional photo to announcement
                  </button>
                  <details className="composer-job-url-mini">
                    <summary>Image URL</summary>
                    <input
                      type="url"
                      className="composer-job-field-input"
                      placeholder="https://…"
                      value={composerImageUrl}
                      onChange={(e) => setComposerImageUrl(e.target.value)}
                    />
                  </details>
                </div>

                {composerImage ? (
                  <div className="composer-preview-wrap composer-job-inner-preview">
                    <img src={composerImage} alt="" />
                    <button
                      type="button"
                      className="composer-preview-remove"
                      aria-label="Remove image"
                      onClick={() => setComposerImage(null)}
                    >
                      ×
                    </button>
                  </div>
                ) : null}

                <div className="composer-job-actions">
                  <button
                    type="button"
                    className="composer-job-cancel-btn"
                    disabled={posting}
                    onClick={() => {
                      setComposerMode("post");
                      setJobDraft({
                        title: "",
                        location: "",
                        type: "",
                        salary: "",
                        description: "",
                        requirements: "",
                      });
                      setComposerImage(null);
                      setComposerImageUrl("");
                      setFeedNotice("");
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="composer-job-submit-btn"
                    disabled={
                      posting ||
                      !(jobDraft.title.trim() && jobDraft.description.trim())
                    }
                  >
                    <ComposerPostSendIcon />
                    {posting ? "Posting..." : "Post Job"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="composer-top">
                  <UserAvatar user={user} size={48} />
                  <textarea
                    placeholder="What's on your mind?"
                    value={composer}
                    onChange={(e) => setComposer(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="composer-emoji-row" aria-label="Insert emoji">
                  {EMOJI_QUICK.map((em) => (
                    <button
                      key={em}
                      type="button"
                      className="composer-emoji-hit"
                      onClick={() => insertComposerEmoji(em)}
                    >
                      {em}
                    </button>
                  ))}
                </div>

                {composerImage ? (
                  <div className="composer-preview-wrap">
                    <img src={composerImage} alt="" />
                    <button
                      type="button"
                      className="composer-preview-remove"
                      aria-label="Remove image"
                      onClick={() => setComposerImage(null)}
                    >
                      ×
                    </button>
                  </div>
                ) : null}

                <div className="composer-actions">
                  <input
                    ref={composerFileRef}
                    className="composer-photo-hidden"
                    type="file"
                    accept="image/*"
                    onChange={chooseComposerPhoto}
                    aria-hidden
                    tabIndex={-1}
                  />
                  <button
                    type="button"
                    className="composer-photo-btn"
                    onClick={() => composerFileRef.current?.click()}
                  >
                    📷 Add photo
                  </button>

                  <details className="composer-url-details">
                    <summary>Image URL (optional)</summary>
                    <input
                      type="url"
                      className="composer-url-input"
                      placeholder="https://…"
                      value={composerImageUrl}
                      onChange={(e) => setComposerImageUrl(e.target.value)}
                    />
                  </details>

                  <button
                    type="submit"
                    className="composer-submit-btn"
                    disabled={
                      posting ||
                      !(
                        composer.trim() ||
                        (composerImage && String(composerImage).trim()) ||
                        composerImageUrl.trim()
                      )
                    }
                  >
                    <ComposerPostSendIcon />
                    {posting ? "Posting..." : "Post"}
                  </button>
                </div>
              </>
            )}
          </form>

          {loading && (
            <p style={{ padding: "0 1rem", opacity: 0.8 }}>Loading feed…</p>
          )}

          {!loading &&
            filteredPosts.map((post, idx) => {
              const origIdx =
                posts.findIndex(
                  (p) =>
                    p.postId !== null &&
                    post.postId !== null &&
                    p.postId === post.postId
                );
              const likeIdx = origIdx >= 0 ? origIdx : idx;

              const chipTone =
                post.authorRole === "company"
                  ? "post-company-chip"
                  : "post-person-chip";

              const authorClickable =
                post.authorId != null && post.authorId !== "";

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
                  className="post-card"
                  key={post.postId ?? `${post.company}-${post.time}-${idx}`}
                >
                  <div className="post-header">
                    <div className="post-author">
                      {authorClickable ? (
                        <button
                          type="button"
                          className="post-author-click"
                          onClick={() => goAuthorProfile(post)}
                          aria-label={`View profile: ${post.company}`}
                        >
                          {authorMain}
                        </button>
                      ) : (
                        <div className="post-author-static">{authorMain}</div>
                      )}

                      {showFollowBtn(post) ? (
                        <button
                          type="button"
                          className={`post-follow-btn ${
                            isFollowingAuthor(post.authorId)
                              ? "post-follow-btn--on"
                              : ""
                          }`}
                          onClick={() => toggleFollowAuthor(post.authorId)}
                        >
                          {isFollowingAuthor(post.authorId)
                            ? "Following"
                            : "+ Follow"}
                        </button>
                      ) : null}
                    </div>

                    <div
                      style={{ display: "flex", gap: 6, alignItems: "center" }}
                    >
                      {canDelete(post) ? (
                        <button
                          type="button"
                          className="post-more"
                          title="Delete"
                          onClick={() => handleDelete(post)}
                        >
                          🗑
                        </button>
                      ) : null}
                      <button type="button" className="post-more">
                        ⋮
                      </button>
                    </div>
                  </div>

                  <div className="post-text">
                    <p>{post.text1}</p>
                    {post.text2 ? <p>{post.text2}</p> : null}
                    {post.hashtags ? (
                      <a href="/">{post.hashtags}</a>
                    ) : null}
                  </div>

                  {post.postType === "job" &&
                  post.jobId &&
                  Number.isFinite(Number(post.jobId)) ? (
                    <div className="feed-job-snippet-card">
                      <span className="feed-job-snippet-badge" aria-hidden>
                        JOB
                      </span>
                      <div className="feed-job-snippet-inner">
                        <h4 className="feed-job-snippet-title">
                          {post.linkedJobTitle ||
                            post.text1 ||
                            "Open role"}
                        </h4>
                        <div className="feed-job-snippet-company">{post.company}</div>
                        {post.linkedJobLocation ||
                        post.linkedJobType ||
                        post.linkedJobSalary ? (
                          <ul className="feed-job-snippet-meta">
                            {[
                              post.linkedJobLocation &&
                                `${post.linkedJobLocation}`,
                              post.linkedJobType && `${post.linkedJobType}`,
                              post.linkedJobSalary && `${post.linkedJobSalary}`,
                            ]
                              .filter(Boolean)
                              .map((line, li) => (
                                <li key={`${li}-${line}`}>{line}</li>
                              ))}
                          </ul>
                        ) : null}
                        <div className="feed-job-snippet-actions">
                          {user?.role === "company" &&
                          idsEqual(uid, post.authorId) ? (
                            <>
                              <button
                                type="button"
                                className="feed-job-action-btn"
                                onClick={() =>
                                  navigate("/company-dashboard", {
                                    state: { tab: "jobs" },
                                  })
                                }
                              >
                                Manage job
                              </button>
                              <button
                                type="button"
                                className="feed-job-action-btn ghost"
                                onClick={() =>
                                  navigate("/company-dashboard", {
                                    state: {
                                      tab: "applicants",
                                      jobId: Number(post.jobId),
                                    },
                                  })
                                }
                              >
                                View applicants
                              </button>
                            </>
                          ) : null}
                          {user?.role === "candidate" ? (
                            appliedJobIds.has(Number(post.jobId)) ? (
                              <span className="feed-job-applied">Applied</span>
                            ) : (
                              <button
                                type="button"
                                className="feed-job-action-btn primary"
                                onClick={() =>
                                  navigate("/candidate-dashboard", {
                                    state: {
                                      openApplyJobId: Number(post.jobId),
                                    },
                                  })
                                }
                              >
                                Apply
                              </button>
                            )
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {post.image ? (
                    <button
                      type="button"
                      className="post-image-wrap"
                      onClick={() => setLightboxSrc(post.image)}
                      aria-label="View image larger"
                    >
                      <img
                        className="post-image post-image--feed"
                        src={post.image}
                        alt=""
                      />
                    </button>
                  ) : null}

                  <div
                    className="post-meta-row"
                    style={{
                      padding: "8px 0",
                      fontSize: 13,
                      color: "#64748b",
                    }}
                  >
                    <span>{post.shareCount ?? 0} shares</span>
                  </div>

                  <div className="post-actions">
                    <button
                      type="button"
                      className={post.liked ? "lc-post-like--active" : ""}
                      onClick={() => handleLike(post, likeIdx)}
                    >
                      👍 Like
                      {post.likesCount != null ? ` (${post.likesCount})` : ""}
                    </button>
                    <button type="button" onClick={() => toggleComments(post.postId)}>
                      💬 Comment
                      {post.commentsCount != null
                        ? ` (${post.commentsCount})`
                        : ""}
                    </button>
                    <button type="button" onClick={() => handleShare(post)}>
                      ↗ Share
                    </button>
                    <button type="button" onClick={() => openSend(post)}>
                      ✉ Send
                    </button>
                  </div>

                  {post.postId && expandedComments[post.postId] ? (
                    <div className="lc-comment-shell">
                      <div className="lc-comment-intro">Comments</div>
                      <div className="lc-comment-list">
                        {(post.comments || []).length === 0 ? (
                          <p className="lc-comment-time">
                            No comments yet. Be the first to comment.
                          </p>
                        ) : (
                          (post.comments || []).map((c) => {
                            const cid = String(c.id);
                            const merged = mergedExtraFor(post.postId, cid);
                            const rk = `${String(post.postId)}::${cid}`;
                            const replies = merged.replies || [];
                            const openReply =
                              replyTargetKey === rk || false;

                            return (
                              <div className="lc-comment-row" key={cid}>
                                <div className="lc-comment-avatar-slot">
                                  <UserAvatar
                                    user={null}
                                    name={c.who}
                                    src={c.avatar}
                                    size={40}
                                  />
                                </div>
                                <div className="lc-comment-bubble">
                                  <div className="lc-comment-meta">
                                    <strong>{c.who}</strong>
                                    <span className="lc-comment-time">
                                      {c.time}
                                    </span>
                                  </div>
                                  <div className="lc-comment-text">{c.text}</div>

                                  <div className="lc-comment-mini-actions">
                                    <button
                                      type="button"
                                      className={
                                        merged.vote === "like"
                                          ? "lc-post-like--active"
                                          : ""
                                      }
                                      onClick={() =>
                                        handleCommentVote(post.postId, cid, "like")
                                      }
                                    >
                                      👍 Like ({merged.likes || 0})
                                    </button>
                                    <button
                                      type="button"
                                      className={
                                        merged.vote === "dislike"
                                          ? "lc-post-like--active"
                                          : ""
                                      }
                                      onClick={() =>
                                        handleCommentVote(
                                          post.postId,
                                          cid,
                                          "dislike"
                                        )
                                      }
                                    >
                                      👎 Dislike ({merged.dislikes || 0})
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setReplyTargetKey(openReply ? null : rk)
                                      }
                                    >
                                      Reply
                                    </button>
                                  </div>

                                  {openReply ? (
                                    <div className="lc-reply-mini">
                                      <input
                                        type="text"
                                        placeholder="Write a reply…"
                                        value={replyDrafts[rk] || ""}
                                        onChange={(e) =>
                                          setReplyDrafts((d) => ({
                                            ...d,
                                            [rk]: e.target.value,
                                          }))
                                        }
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            e.preventDefault();
                                            submitReply(post.postId, cid);
                                          }
                                        }}
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          submitReply(post.postId, cid)
                                        }
                                      >
                                        Reply
                                      </button>
                                    </div>
                                  ) : null}

                                  {replies.length ? (
                                    <div className="lc-reply-thread">
                                      {replies.map((rep) => (
                                        <div
                                          className="lc-reply-row"
                                          key={rep.id}
                                        >
                                          <div className="lc-comment-avatar-slot">
                                            <UserAvatar
                                              user={null}
                                              name={rep.name}
                                              src={rep.avatar || null}
                                              size={32}
                                            />
                                          </div>
                                          <div className="lc-comment-bubble">
                                            <div className="lc-comment-meta">
                                              <strong>{rep.name}</strong>
                                              <span className="lc-comment-time">
                                                {rep.time}
                                              </span>
                                            </div>
                                            <div className="lc-comment-text">
                                              {rep.text}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      <div className="lc-comment-composer">
                        <textarea
                          placeholder="Share your thoughts..."
                          rows={2}
                          value={commentDrafts[post.postId] || ""}
                          onChange={(e) =>
                            setCommentDrafts((d) => ({
                              ...d,
                              [post.postId]: e.target.value,
                            }))
                          }
                        />
                        <button
                          type="button"
                          className="lc-comment-send"
                          onClick={() => handleComment(post)}
                        >
                          Comment
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
    </main>
  );

  const sendModalJsx =
    sendTarget ? (
      <div className="feed-send-modal-backdrop">
        <div className="feed-send-modal">
          <h3>Send Post</h3>
          <p className="feed-send-title">{sendTarget.company}</p>
          <input
            type="text"
            placeholder="Receiver email or name"
            value={sendReceiver}
            onChange={(e) => setSendReceiver(e.target.value)}
          />
          <textarea
            placeholder="Message"
            value={sendText}
            onChange={(e) => setSendText(e.target.value)}
          />
          <div className="feed-send-actions">
            <button type="button" onClick={() => setSendTarget(null)}>
              Cancel
            </button>
            <button type="button" onClick={submitSend}>
              Send
            </button>
          </div>
        </div>
      </div>
    ) : null;

  const lightboxJsx = lightboxSrc ? (
    <div
      className="feed-lightbox-backdrop"
      role="presentation"
      onClick={() => setLightboxSrc(null)}
    >
      <button
        type="button"
        className="feed-lightbox-close"
        aria-label="Close"
        onClick={() => setLightboxSrc(null)}
      >
        ×
      </button>
      <img
        className="feed-lightbox-img"
        src={lightboxSrc}
        alt=""
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  ) : null;

  if (user?.role === "company") {
    return (
      <div className="candidate-page">
        <header className="topbar">
          <div className="topbar-left">
            <div
              className="brand-mark"
              role="button"
              tabIndex={0}
              onClick={goRoleHome}
              onKeyDown={(ev) => ev.key === "Enter" && goRoleHome()}
            >
              <div className="brand-center"></div>
            </div>

            <div className="top-search">
              <span>⌕</span>
              <input
                type="text"
                placeholder="Search jobs, companies..."
                value={topSearch}
                onChange={(e) => setTopSearch(e.target.value)}
                onKeyDown={handleTopSearchKeyDown}
              />
            </div>
          </div>

          <div className="topbar-right">
            <div
              className="top-nav"
              role="button"
              tabIndex={0}
              onClick={goRoleHome}
              onKeyDown={(ev) => ev.key === "Enter" && goRoleHome()}
            >
              <span>⌂</span>
              <p>Home</p>
            </div>

            <div
              className="top-nav lc-msg-nav-active"
              role="button"
              tabIndex={0}
              onClick={() => navigate("/messages")}
            >
              <span>✉</span>
              <p>Messaging</p>
              {messagesUnread > 0 ? (
                <div className="notif-badge msg-top-badge">{messagesUnread}</div>
              ) : null}
            </div>

            <div
              className="top-nav notif-nav"
              role="button"
              tabIndex={0}
              onClick={() => navigate("/notifications")}
            >
              <span>🔔</span>
              <p>Notifications</p>
              <div className="notif-badge">{notifUnread}</div>
            </div>

            <div className="top-divider"></div>

            <div className="top-user">
              <UserAvatar user={user} size={40} />
              <div>
                <h4>{headerNameCompany}</h4>
                <p>Company</p>
              </div>
            </div>
          </div>
        </header>

        <div className="layout">
          <CandidateSidebar
            variant="company"
            user={user}
            activeKey="feed"
            notifUnread={notifUnread}
            messagesUnread={messagesUnread}
            onDashboard={companyNav.onDashboard}
            onFeed={companyNav.onFeed}
            onMyJobs={companyNav.onMyJobs}
            onApplicants={companyNav.onApplicants}
            onMessages={companyNav.onMessages}
            onNotifications={companyNav.onNotifications}
            onMyProfile={companyNav.onMyProfile}
            onFindJobs={() => {}}
            onApplications={() => {}}
            onSavedJobs={() => {}}
            onSignOut={handleSignOut}
          />
          {feedMainEl}
        </div>
        {sendModalJsx}
        {lightboxJsx}
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <header className="topbar">
        <div className="topbar-left">
          <div
            className="small-brand"
            role="button"
            tabIndex={0}
            onClick={goRoleHome}
            onKeyDown={(event) => event.key === "Enter" && goRoleHome()}
          >
            <div className="small-brand-center"></div>
          </div>

          <div className="search-box">
            <span className="search-icon">⌕</span>
            <input
              type="text"
              placeholder="Search jobs, companies..."
              value={topSearch}
              onChange={(e) => setTopSearch(e.target.value)}
              onKeyDown={handleTopSearchKeyDown}
            />
          </div>
        </div>

        <div className="topbar-right">
          <div
            className="top-nav-item active"
            role="button"
            tabIndex={0}
            onClick={goRoleHome}
          >
            <span>⌂</span>
            <p>Home</p>
          </div>

          <div
            className="top-nav-item"
            role="button"
            tabIndex={0}
            onClick={() => navigate("/messages")}
          >
            <span>✉</span>
            <p>Messaging</p>
          </div>

          <div
            className="top-nav-item notif-item"
            role="button"
            tabIndex={0}
            onClick={() => navigate("/notifications")}
          >
            <span>🔔</span>
            <p>Notifications</p>
            <div className="notif-badge">{notifUnread}</div>
          </div>

          <div className="topbar-divider"></div>

          <div
            className="top-user"
            role="button"
            tabIndex={0}
            onClick={() => {
              const u = user ?? getUser();
              if (!u?.id && !u?._id) return;
              const id = u.id ?? u._id;
              if (u.role === "candidate") navigate(`/candidate-profile/${id}`);
              else if (u.role === "company") navigate(`/company-profile/${id}`);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              const u = user ?? getUser();
              if (!u?.id && !u?._id) return;
              const id = u.id ?? u._id;
              if (u.role === "candidate") navigate(`/candidate-profile/${id}`);
              else if (u.role === "company") navigate(`/company-profile/${id}`);
            }}
          >
            <UserAvatar user={user} size={40} />
            <div>
              <h4>{displayName}</h4>
              <p>{roleLabel}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="dashboard-body">
        <CandidateSidebar
          user={user}
          activeKey="feed"
          notifUnread={notifUnread}
          messagesUnread={messagesUnread}
          onDashboard={() =>
            navigate("/candidate-dashboard", { state: { tab: "dashboard" } })
          }
          onFeed={() => navigate("/dashboard")}
          onFindJobs={() =>
            navigate("/candidate-dashboard", { state: { tab: "findJobs" } })
          }
          onApplications={() =>
            navigate("/candidate-dashboard", { state: { tab: "applications" } })
          }
          onSavedJobs={() =>
            navigate("/candidate-dashboard", { state: { tab: "savedJobs" } })
          }
          onMessages={() => navigate("/messages")}
          onNotifications={() => navigate("/notifications")}
          onMyProfile={() => {
            const u = user ?? getUser();
            const id = u?.id ?? u?._id;
            if (!id) return;
            if (u.role === "candidate") navigate(`/candidate-profile/${id}`);
            else if (u.role === "company") navigate(`/company-profile/${id}`);
          }}
          onSignOut={handleSignOut}
        />

        {feedMainEl}
      </div>
      {sendModalJsx}
      {lightboxJsx}
    </div>
  );
}

export default Dashboard;
