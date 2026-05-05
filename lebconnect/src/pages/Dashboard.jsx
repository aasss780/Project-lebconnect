import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import UserAvatar from "../components/UserAvatar";
import CandidateSidebar from "../components/CandidateSidebar";
import { formatRelativeTime } from "../utils/format";
import { displayNameFromUser } from "../utils/avatar";
import { getProfileImage, isDisplayableMediaUrl } from "../utils/profileMedia";
import {
  dashboardPath,
  FEED_PATH,
  getUser,
  isLoggedIn,
  logout,
} from "../utils/auth";
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
import { useToast } from "../context/ToastContext";
import {
  Flag,
  ImagePlus,
  Mail,
  MessageCircle,
  Send,
  Share2,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import {
  compressDataUrlForUpload,
  fileToCompressedDataUrl,
} from "../utils/imageUpload";

import DashboardRail from "../components/DashboardRail";
import AppTopbar from "../components/AppTopbar";
import ReportContentModal from "../components/ReportContentModal";
import VerifiedCompanyBadge from "../components/VerifiedCompanyBadge";
import "./Dashboard.css";
import "./CandidateDashboard.css";
import { safeUiString } from "../utils/uiString";
import {
  FEED_LOGO_CLASSES as LOGO_CLASSES,
  idsEqual,
  mapApiPost,
  viewerNormalizedFieldBucket,
} from "../utils/feedPostMap";
import {
  announceJobOnFeed,
  buildCreateJobPayload,
  createCompanyJob,
  jobIdFromCreateResponse,
} from "../utils/companyJobApi";

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
    authorNormalizedBucket: "",
    postType: "standard",
    authorIsVerified: false,
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
    authorNormalizedBucket: "",
    postType: "standard",
    authorIsVerified: false,
  },
];

const FEED_FILTER_OPTIONS = [
  { id: "all", label: "All Posts" },
  { id: "following", label: "Following" },
  { id: "samefield", label: "Same Field" },
  { id: "jobsforyou", label: "Jobs For You" },
  { id: "companieshiring", label: "Companies Hiring" },
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
  const commentAreaRefs = useRef({});
  const hookUser = useAuthUser();
  const sessionUserRaw = getUser();
  const sessionUser =
    sessionUserRaw && typeof sessionUserRaw === "object" ? sessionUserRaw : {};
  /** Prefer hook user; fallback to stored session so first paint never treats role as missing. */
  const currentUser =
    hookUser && typeof hookUser === "object" ? hookUser : sessionUser;
  const user = currentUser;
  const currentRole = String(currentUser?.role || "").trim().toLowerCase();
  console.log("Dashboard feed render", { currentUser, currentRole });
  const roleLower = currentRole;
  const roleLabel =
    roleLower === "company"
      ? "Company"
      : roleLower === "admin"
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
  const [reportTarget, setReportTarget] = useState(null);
  const [postsError, setPostsError] = useState("");

  const uid = user?.id ?? user?._id ?? null;
  const toast = useToast();

  const [railNetworkBlock, setRailNetworkBlock] = useState(null);
  const [railNetworkFailed, setRailNetworkFailed] = useState(false);
  const [railFollowBusyUserId, setRailFollowBusyUserId] = useState(null);

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

  useEffect(() => {
    if (!uid) {
      setRailNetworkBlock(null);
      setRailNetworkFailed(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const nwRes = await api.get("/api/network/same-field").then(
          (r) => ({ ok: true, data: r.data }),
          () => ({ ok: false, data: null })
        );
        if (cancelled) return;
        setRailNetworkFailed(!nwRes.ok);
        setRailNetworkBlock(
          nwRes.ok && nwRes.data && typeof nwRes.data === "object" ? nwRes.data : null
        );
      } catch {
        if (!cancelled) {
          setRailNetworkBlock(null);
          setRailNetworkFailed(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setPostsError("");
    try {
      const q =
        feedFilter === "all" ? "" : `?filter=${encodeURIComponent(feedFilter)}`;
      const { data } = await api.get(`/api/posts${q}`);
      if (Array.isArray(data)) {
        setLiveFeed(true);
        if (data.length === 0) {
          setPosts([]);
        } else {
          const mapped = [];
          for (let i = 0; i < data.length; i++) {
            try {
              const row = mapApiPost(data[i], i, uid);
              if (row) mapped.push(row);
            } catch {
              /* skip bad row */
            }
          }
          setPosts(mapped);
        }
      } else {
        setPosts([]);
        setLiveFeed(true);
      }
    } catch (error) {
      console.error("Feed load failed", error.response?.data || error.message);
      const msg =
        error?.response?.data?.message ??
        error?.response?.data ??
        error?.message ??
        "";
      const line =
        typeof msg === "string"
          ? msg
          : msg && typeof msg === "object"
            ? JSON.stringify(msg)
            : "Could not load posts.";
      setPostsError(line);
      setPosts(STATIC_POSTS);
      setLiveFeed(false);
    } finally {
      setLoading(false);
    }
  }, [feedFilter, uid]);

  const followedSetSafe = useMemo(() => {
    if (followedSet instanceof Set) return followedSet;
    console.error(
      "[Dashboard] followedUsers was not a Set — ignoring stored follow IDs for this render."
    );
    return new Set();
  }, [followedSet]);

  const railPeople = useMemo(() => {
    const raw = railNetworkBlock?.people;
    if (!Array.isArray(raw)) return [];
    const myId = uid != null ? String(uid) : "";
    return raw.filter(
      (p) =>
        p &&
        p.id != null &&
        String(p.id) !== myId &&
        Number(p.id) !== Number(myId)
    );
  }, [railNetworkBlock, uid]);

  const railCompanies = useMemo(() => {
    const raw = railNetworkBlock?.companies;
    return Array.isArray(raw) ? raw : [];
  }, [railNetworkBlock]);

  const handleRailTopicClick = useCallback((tag) => {
    const chunk = typeof tag === "string" ? tag : "";
    if (!chunk.trim()) return;
    setComposer((prev) => {
      const p = prev || "";
      const needsSpace = p.length > 0 && !/\s$/.test(p);
      return `${p}${needsSpace ? " " : ""}${chunk.trim()}`;
    });
  }, []);

  const toggleRailFollowPerson = useCallback(
    async (e, personId) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      const id = Number(personId);
      if (!Number.isFinite(id) || id === Number(uid)) return;
      if (railFollowBusyUserId != null) return;
      const sid = String(id);
      const has = followedSetSafe.has(sid);
      setRailFollowBusyUserId(id);
      try {
        const next = await toggleFollowViaApi(id, has);
        if (next) setFollowedSet(next);
      } catch {
        toast.error("Could not update follow.");
      } finally {
        setRailFollowBusyUserId(null);
      }
    },
    [uid, railFollowBusyUserId, followedSetSafe, toast]
  );

  const feedRailContext = useMemo(
    () => ({
      people: railPeople,
      companies: railCompanies,
      specialization: String(user?.specialization || "").trim(),
      followedSet: followedSetSafe,
      followBusyUserId: railFollowBusyUserId,
      toggleFollowPerson: toggleRailFollowPerson,
      networkFailed: railNetworkFailed,
      onTopicClick: handleRailTopicClick,
    }),
    [
      railPeople,
      railCompanies,
      user,
      followedSetSafe,
      railFollowBusyUserId,
      toggleRailFollowPerson,
      railNetworkFailed,
      handleRailTopicClick,
    ]
  );

  const safePosts = useMemo(
    () => (Array.isArray(posts) ? posts : []),
    [posts]
  );

  const filteredPosts = useMemo(() => {
    if (liveFeed) return safePosts;
    return safePosts.filter((post) => {
      if (feedFilter === "all") return true;
      const aid =
        post.authorId != null && post.authorId !== ""
          ? String(post.authorId)
          : "";
      const role = (post.authorRole || "").toLowerCase();
      if (feedFilter === "following") {
        if (!aid) return false;
        return followedSetSafe.has(aid);
      }
      if (feedFilter === "samefield") {
        const vb = viewerNormalizedFieldBucket(user);
        if (!vb) return true;
        const pb = post.authorNormalizedBucket || "";
        if (!pb) return true;
        return pb === vb;
      }
      if (feedFilter === "people") {
        if (!aid) return false;
        return role !== "company";
      }
      if (feedFilter === "companies") return role === "company";
      if (feedFilter === "jobsforyou") {
        if (post.postType !== "job") return false;
        const vb = viewerNormalizedFieldBucket(user);
        const pb = post.authorNormalizedBucket || "";
        return !vb || !pb ? true : vb === pb;
      }
      if (feedFilter === "companieshiring") return role === "company";
      return true;
    });
  }, [safePosts, feedFilter, followedSetSafe, liveFeed, user]);

  const emptyFeedHint = useMemo(() => {
    if (feedFilter === "following") {
      return "Follow colleagues and employers from posts — then open Following to see only their updates.";
    }
    if (feedFilter === "samefield") {
      return "We could not match specialization or industry buckets for every account. Try All Posts or update your profile so Same Field has more signal.";
    }
    if (feedFilter === "people") {
      return "No candidate or member-authored posts matched this filter.";
    }
    if (feedFilter === "companies") {
      return "No posts from organizations matched this filter yet.";
    }
    if (feedFilter === "jobsforyou") {
      return "Job posts tailored to your field will appear — try Same Field or All Posts.";
    }
    if (feedFilter === "companieshiring") {
      return "Follow companies hiring in your space — widen to All Posts for more signal.";
    }
    return liveFeed
      ? "The feed has no visible posts yet. Be the first to share an update."
      : "Showing sample posts while the feed API is offline.";
  }, [feedFilter, liveFeed]);

  const composerPreviewSrc =
    composerImage ||
    (composerImageUrl.trim() && isDisplayableMediaUrl(composerImageUrl.trim())
      ? composerImageUrl.trim()
      : "");

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
    const has = followedSetSafe.has(sid);
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
    authorId != null && followedSetSafe.has(String(authorId));

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
    if (roleLower !== "candidate" || !isLoggedIn()) {
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
  }, [uid, roleLower]);

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

    const isCompanyJobComposer =
      roleLower === "company" && composerMode === "job";

    if (isCompanyJobComposer) {
      if (!jobDraft.title.trim() || !jobDraft.description.trim()) {
        setFeedNotice("Job posts need a title and description.");
        return;
      }
    } else {
      const hasMedia =
        Boolean(composerImage && String(composerImage).trim()) ||
        Boolean(
          composerImageUrl.trim() &&
            isDisplayableMediaUrl(composerImageUrl.trim())
        );
      if (!composer.trim() && !hasMedia) {
        setFeedNotice("Write something or add a photo.");
        return;
      }
    }

    setPosting(true);
    setFeedNotice("");

    try {
      let imgPayloadPrep =
        (composerImage && String(composerImage).trim()) ||
        composerImageUrl.trim();
      imgPayloadPrep = await prepareImagePayload(imgPayloadPrep);
      const approxImgBytes =
        imgPayloadPrep.length > 0
          ? Math.ceil((imgPayloadPrep.length * 3) / 4)
          : 0;
      if (approxImgBytes > SAFE_IMAGE_FILE_BYTES + 2048) {
        setFeedNotice(
          "Image is still too large after compression. Choose a smaller file or lower resolution."
        );
        setPosting(false);
        return;
      }

      if (isCompanyJobComposer) {
        const payload = buildCreateJobPayload({
          title: jobDraft.title,
          description: jobDraft.description,
          location: jobDraft.location,
          type: jobDraft.type,
          salary: jobDraft.salary,
          requirements: jobDraft.requirements,
        });
        const created = await createCompanyJob(api, payload);
        const jobIdRaw = jobIdFromCreateResponse(created);
        if (jobIdRaw == null || !Number.isFinite(Number(jobIdRaw))) {
          setFeedNotice(
            "Job was created but the response was unexpected. Refresh the feed and try posting again if needed."
          );
          await loadPosts();
          return;
        }
        const jobId = Number(jobIdRaw);
        await announceJobOnFeed(api, {
          jobId,
          title: jobDraft.title.trim(),
          image: imgPayloadPrep || undefined,
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
          composer.trim() || (imgPayloadPrep ? " " : composer.trim());
        await api.post("/api/posts", {
          content,
          ...(imgPayloadPrep ? { image: imgPayloadPrep } : {}),
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
      const dataUrl = await fileToCompressedDataUrl(file, 1600, 0.85);
      setComposerImage(dataUrl);
      setComposerImageUrl("");
      setFeedNotice("");
    } catch {
      setFeedNotice("Could not read that image.");
    } finally {
      if (composerFileRef.current) composerFileRef.current.value = "";
    }
  };

  const prepareImagePayload = async (img) => {
    if (!img || !String(img).trim()) return "";
    const t = String(img).trim();
    if (/^data:image\//i.test(t))
      return compressDataUrlForUpload(t);
    return t;
  };

  const handleLike = async (post, idx) => {
    if (!post.postId) return;
    try {
      const { data } = await api.put(`/api/posts/${post.postId}/like`);
      const refreshed = data?.post;
      if (refreshed) {
        const mapped = mapApiPost(refreshed, idx, uid);
        const mappedSafe = mapped
          ? { ...mapped, logoClass: LOGO_CLASSES[idx % LOGO_CLASSES.length] }
          : null;
        if (mappedSafe) {
          setPosts((prev) =>
            prev.map((p) => (p.postId === post.postId ? mappedSafe : p))
          );
        }
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
    setSendReceiver(
      post.authorId != null && post.authorId !== ""
        ? String(post.authorId)
        : ""
    );
    setSendText("");
    setFeedNotice("");
  };

  const submitSend = async () => {
    if (!sendTarget) return;
    const receiverId = Number(String(sendReceiver).trim());
    const text = sendText.trim();
    if (!Number.isFinite(receiverId) || receiverId <= 0) {
      setFeedNotice(
        "Could not resolve the author's account to message. Open their profile from the feed and try again."
      );
      return;
    }
    if (!text) {
      setFeedNotice("Write a short message.");
      return;
    }
    try {
      await api.post("/api/messages", {
        receiver: receiverId,
        text,
      });
      setFeedNotice("Message sent.");
      setSendTarget(null);
      setSendReceiver("");
      setSendText("");
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Could not send message.";
      setFeedNotice(msg);
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
    setExpandedComments((prev) => {
      const opening = !prev[postId];
      if (opening) {
        queueMicrotask(() => {
          commentAreaRefs.current[String(postId)]?.focus?.();
        });
      }
      return { ...prev, [postId]: opening };
    });
  };

  const goUserProfileFromIds = (userId, role) => {
    if (userId == null || userId === "") return;
    const rid = Number(String(userId).trim());
    if (!Number.isFinite(rid) || rid <= 0) return;
    const r = String(role || "").toLowerCase();
    if (r === "company") {
      navigate(`/company-profile/${rid}`);
      return;
    }
    navigate(`/candidate-profile/${rid}`);
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
    if (roleLower === "admin") return true;
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
    if (roleLower) navigate(dashboardPath(user.role));
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
    if (roleLower === "candidate") {
      navigate("/candidate-dashboard", { state: { tab: "findJobs", q } });
      return;
    }
    if (roleLower) {
      navigate(`${dashboardPath(user.role)}?q=${encodeURIComponent(q)}`);
      return;
    }
    navigate(`/?q=${encodeURIComponent(q)}`);
  };

  const mergedExtraFor = (postId, cid) => {
    const k = commentExtrasKey(postId, cid);
    return commentExtras[k] || defaultExtra();
  };

  const companyNav = {
    onDashboard: () =>
      navigate("/company-dashboard", { state: { tab: "dashboard" } }),
    onFeed: () => navigate(FEED_PATH),
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
    <main className="feed-content feed-content--split">
          <div className="feed-center-stack">
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
              className={`feed-notice ${/success|posted|sent|shared/i.test(feedNotice) && !/could not|fail|error|too large|invalid|unexpected/i.test(feedNotice) ? "feed-notice--ok" : ""}`}
              role="status"
            >
              {feedNotice}
            </div>
          ) : null}

          {postsError ? (
            <div className="feed-notice" role="alert">
              Feed could not refresh: {safeUiString(postsError, "Unknown error")}.
              Sample posts are shown below until the server is available.
            </div>
          ) : null}

          <form className="composer-card" onSubmit={handleCreatePost}>
            {roleLower === "company" ? (
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

            {composerMode === "job" && roleLower === "company" ? (
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
                    <ImagePlus size={18} strokeWidth={2} aria-hidden />
                    Add optional photo
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

                {composerPreviewSrc ? (
                  <div className="composer-preview-wrap composer-job-inner-preview">
                    <img src={composerPreviewSrc} alt="" />
                    <button
                      type="button"
                      className="composer-preview-remove"
                      aria-label="Remove image"
                      onClick={() => {
                        setComposerImage(null);
                        setComposerImageUrl("");
                      }}
                    >
                      <X size={18} strokeWidth={2} aria-hidden />
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
                    <Send size={18} strokeWidth={2} aria-hidden />
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

                {composerPreviewSrc ? (
                  <div className="composer-preview-wrap">
                    <img src={composerPreviewSrc} alt="" />
                    <button
                      type="button"
                      className="composer-preview-remove"
                      aria-label="Remove image"
                      onClick={() => {
                        setComposerImage(null);
                        setComposerImageUrl("");
                      }}
                    >
                      <X size={18} strokeWidth={2} aria-hidden />
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
                    <ImagePlus size={18} strokeWidth={2} aria-hidden />
                    Add Photo
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
                        (composerImageUrl.trim() &&
                          isDisplayableMediaUrl(composerImageUrl.trim()))
                      )
                    }
                  >
                    <Send size={18} strokeWidth={2} aria-hidden />
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
            (filteredPosts.length === 0 ? (
              <div className="lc-empty-state lc-feed-empty">
                <strong>No posts yet</strong>
                <span>{emptyFeedHint}</span>
                <div className="lc-feed-empty-actions">
                  <button
                    type="button"
                    className="lc-btn lc-btn--primary lc-btn-hit"
                    onClick={() => setFeedFilter("all")}
                  >
                    All Posts
                  </button>
                  {roleLower === "candidate" ? (
                    <button
                      type="button"
                      className="lc-btn lc-btn--secondary lc-btn-hit"
                      onClick={() =>
                        navigate("/candidate-dashboard", {
                          state: { tab: "findJobs" },
                        })
                      }
                    >
                      Find jobs
                    </button>
                  ) : roleLower === "company" ? (
                    <button
                      type="button"
                      className="lc-btn lc-btn--secondary lc-btn-hit"
                      onClick={() =>
                        navigate("/company-dashboard", { state: { tab: "jobs" } })
                      }
                    >
                      My Jobs
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              filteredPosts
                .filter((post) => post && typeof post === "object")
                .map((post, idx) => {
              const origIdx =
                safePosts.findIndex(
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
                          title="Delete post"
                          onClick={() => handleDelete(post)}
                        >
                          <Trash2 size={18} strokeWidth={2} aria-hidden />
                        </button>
                      ) : null}
                      {isLoggedIn() &&
                      post.postId != null &&
                      !canDelete(post) ? (
                        <button
                          type="button"
                          className="post-more"
                          title="Report this post"
                          onClick={() =>
                            setReportTarget({
                              type: "post",
                              id: Number(post.postId),
                            })
                          }
                        >
                          <Flag size={18} strokeWidth={2} aria-hidden />
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="post-text">
                    <p>{post.text1}</p>
                    {post.text2 ? <p>{post.text2}</p> : null}
                    {post.hashtags ? (
                      <a href="/">{post.hashtags}</a>
                    ) : null}
                  </div>

                  {post.jobId != null &&
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
                          {idsEqual(uid, post.authorId) &&
                          roleLower === "company" ? (
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
                          ) : (
                            <>
                              <button
                                type="button"
                                className="feed-job-action-btn ghost"
                                onClick={() =>
                                  navigate("/candidate-dashboard", {
                                    state: {
                                      tab: "findJobs",
                                      openApplyJobId: Number(post.jobId),
                                    },
                                  })
                                }
                              >
                                View Job
                              </button>
                              {roleLower === "candidate" ? (
                                appliedJobIds.has(Number(post.jobId)) ? (
                                  <span className="feed-job-applied">
                                    Applied
                                  </span>
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
                            </>
                          )}
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
                      <ThumbsUp
                        size={18}
                        strokeWidth={2}
                        className="lc-post-act-icon"
                        aria-hidden
                      />
                      Like
                      {post.likesCount != null ? ` (${post.likesCount})` : ""}
                    </button>
                    <button type="button" onClick={() => toggleComments(post.postId)}>
                      <MessageCircle
                        size={18}
                        strokeWidth={2}
                        className="lc-post-act-icon"
                        aria-hidden
                      />
                      Comment
                      {post.commentsCount != null
                        ? ` (${post.commentsCount})`
                        : ""}
                    </button>
                    <button type="button" onClick={() => handleShare(post)}>
                      <Share2
                        size={18}
                        strokeWidth={2}
                        className="lc-post-act-icon"
                        aria-hidden
                      />
                      Share
                    </button>
                    <button type="button" onClick={() => openSend(post)}>
                      <Mail
                        size={18}
                        strokeWidth={2}
                        className="lc-post-act-icon"
                        aria-hidden
                      />
                      Send
                    </button>
                  </div>

                  {post.postId && expandedComments[post.postId] ? (
                    <div className="lc-comment-shell">
                      <div className="lc-comment-intro">Comments</div>
                      <div className="lc-comment-list">
                        {(Array.isArray(post.comments) ? post.comments : [])
                          .length === 0 ? (
                          <p className="lc-comment-time">
                            No comments yet. Be the first to comment.
                          </p>
                        ) : (
                          (Array.isArray(post.comments) ? post.comments : []).map((c) => {
                            const cid = String(c.id);
                            const merged = mergedExtraFor(post.postId, cid);
                            const rk = `${String(post.postId)}::${cid}`;
                            const replies = merged.replies || [];
                            const openReply =
                              replyTargetKey === rk || false;

                            return (
                              <div className="lc-comment-row" key={cid}>
                                <button
                                  type="button"
                                  className="lc-comment-avatar-hit"
                                  onClick={() =>
                                    goUserProfileFromIds(c.userId, c.role)
                                  }
                                  aria-label={`Open profile: ${c.who}`}
                                >
                                  <UserAvatar
                                    user={null}
                                    name={c.who}
                                    src={c.avatar}
                                    size={40}
                                  />
                                </button>
                                <div className="lc-comment-bubble">
                                  <div className="lc-comment-meta">
                                    <button
                                      type="button"
                                      className="lc-comment-name-hit"
                                      onClick={() =>
                                        goUserProfileFromIds(c.userId, c.role)
                                      }
                                    >
                                      <strong>{c.who}</strong>
                                    </button>
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
                                      <ThumbsUp
                                        size={16}
                                        strokeWidth={2}
                                        aria-hidden
                                      />
                                      {merged.likes || 0}
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
                                      <ThumbsDown
                                        size={16}
                                        strokeWidth={2}
                                        aria-hidden
                                      />
                                      {merged.dislikes || 0}
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
                          ref={(el) => {
                            if (post.postId != null) {
                              commentAreaRefs.current[String(post.postId)] = el;
                            }
                          }}
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
            })
          ))}
          </div>

          <DashboardRail variant="feed" context={feedRailContext} />
    </main>
  );

  const reportModalJsx = (
    <ReportContentModal
      open={reportTarget != null}
      onClose={() => setReportTarget(null)}
      targetType={
        reportTarget && typeof reportTarget === "object" && reportTarget.type
          ? reportTarget.type
          : "post"
      }
      targetId={
        reportTarget && typeof reportTarget === "object"
          ? reportTarget.id
          : null
      }
      title="Report this post"
    />
  );

  const sendReceiverLocked =
    sendTarget &&
    sendTarget.authorId != null &&
    sendTarget.authorId !== "";

  const sendModalJsx =
    sendTarget ? (
      <div className="feed-send-modal-backdrop">
        <div className="feed-send-modal lc-glass-card" role="dialog" aria-modal="true">
          <button
            type="button"
            className="feed-send-modal-dismiss"
            aria-label="Close"
            onClick={() => setSendTarget(null)}
          >
            <X size={22} strokeWidth={2} aria-hidden />
          </button>
          <h3>Message author</h3>
          <p className="feed-send-title">{sendTarget.company}</p>
          <p className="feed-send-hint">
            Sends a direct message using the feed author&apos;s account ID. Opens in
            your Messages inbox after success.
          </p>
          {sendReceiverLocked ? (
            <div className="feed-send-recipient-chip" role="group" aria-label="Recipient">
              <span className="feed-send-recipient-label">Recipient</span>
              <span className="feed-send-recipient-id">#{sendReceiver}</span>
            </div>
          ) : (
            <label className="lc-field">
              <span>Receiver user ID</span>
              <input
                className="lc-input"
                type="text"
                inputMode="numeric"
                placeholder="e.g. 12"
                value={sendReceiver}
                onChange={(e) => setSendReceiver(e.target.value)}
              />
            </label>
          )}
          <label className="lc-field">
            <span>Message</span>
            <textarea
              className="lc-textarea"
              placeholder="Say hello…"
              rows={3}
              value={sendText}
              onChange={(e) => setSendText(e.target.value)}
            />
          </label>
          <div className="feed-send-actions">
            <button
              type="button"
              className="lc-btn lc-btn--secondary lc-btn-hit"
              onClick={() => setSendTarget(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="lc-btn lc-btn--primary lc-btn-hit"
              onClick={submitSend}
            >
              <Mail size={18} strokeWidth={2} aria-hidden />
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
        <X size={28} strokeWidth={2} aria-hidden />
      </button>
      <img
        className="feed-lightbox-img"
        src={lightboxSrc}
        alt=""
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  ) : null;

  if (roleLower === "company") {
    return (
      <div className="candidate-page">
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
          subtitle={safeUiString(user?.industry, "Company")}
        />

        <div className="dashboard-body">
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
        {reportModalJsx}
        {lightboxJsx}
      </div>
    );
  }

  return (
    <div className="candidate-page">
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
        subtitle={safeUiString(user?.specialization, "") || roleLabel}
      />

      <div className="dashboard-body">
        <CandidateSidebar
          user={user}
          activeKey="feed"
          notifUnread={notifUnread}
          messagesUnread={messagesUnread}
          onDashboard={() =>
            navigate("/candidate-dashboard", { state: { tab: "dashboard" } })
          }
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
          onMessages={() => navigate("/messages")}
          onNotifications={() => navigate("/notifications")}
          onMyProfile={() => {
            const stored = getUser();
            const u =
              user && typeof user === "object"
                ? user
                : stored && typeof stored === "object"
                  ? stored
                  : null;
            if (!u) return;
            const id = u.id ?? u._id;
            if (!id) return;
            const r = String(u.role || "").toLowerCase();
            if (r === "candidate") navigate(`/candidate-profile/${id}`);
            else if (r === "company") navigate(`/company-profile/${id}`);
          }}
          onSignOut={handleSignOut}
        />

        {feedMainEl}
      </div>
      {sendModalJsx}
      {reportModalJsx}
      {lightboxJsx}
    </div>
  );
}

export default Dashboard;
