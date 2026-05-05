import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import api from "../api/axios";
import CandidateSidebar from "../components/CandidateSidebar";
import Modal from "../components/Modal";
import ReportContentModal from "../components/ReportContentModal";
import UserAvatar from "../components/UserAvatar";
import VerifiedCompanyBadge from "../components/VerifiedCompanyBadge";
import { formatRelativeTime, initialsFromName } from "../utils/format";
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
  loadFollowSet,
  subscribeFollowChanges,
  toggleFollowInStorage,
} from "../utils/feedStorage";
import { hydrateFollowing, toggleFollowViaApi } from "../utils/followApi";
import CategoryPicker from "../components/CategoryPicker";
import AppTopbar from "../components/AppTopbar";
import DashboardRail from "../components/DashboardRail";
import {
  COMPANY_INDUSTRY_OPTIONS,
  composeIndustryErrors,
  inferCategorySelection,
  OTHER_LABEL,
} from "../constants/categories";
import {
  getCoverImage,
  getProfileImage,
  isDisplayableMediaUrl,
} from "../utils/profileMedia";
import { normalizeStoredUser } from "../utils/sessionUser";
import {
  compressDataUrlForUpload,
  fileToCompressedDataUrl,
} from "../utils/imageUpload";
import { useAuthUser } from "../hooks/useAuthUser";
import { safeUiString } from "../utils/uiString";
import "./ProfilePage.css";
import "./CandidateDashboard.css";
import "./CompanyDashboardExtras.css";
import "./AdminDashboard.css";

/** Minimal offline / error skeleton — never show fake narrative copy as real profile data */
const PROFILE_EMPTY_COMPANY = {
  profileType: "company",
  companyName: "",
  industry: "",
  location: "",
  website: "",
  bio: "",
  logo: null,
  coverImage: null,
  openJobs: [],
  posts: [],
};

function idsEqual(a, b) {
  if (a === null || a === undefined || b === null || b === undefined)
    return false;
  if (a === "" || b === "") return false;
  return String(a) === String(b);
}

function formatProfileLoadError(error) {
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

function mapPostForUi(p, idx) {
  if (!p || typeof p !== "object") {
    return {
      company: "Member",
      time: "— · 🌐",
      text: "",
      image: null,
      logoText: "ME",
      avatarUrl: null,
      postId: null,
      idx,
    };
  }
  const a =
    p.author && typeof p.author === "object" ? p.author : {};
  const name = safeUiString(
    a.companyName || a.fullName || a.company_name || a.full_name,
    "Member"
  );
  const img =
    p.image && String(p.image).trim() ? String(p.image).trim() : null;
  const av = getProfileImage(a);
  const avatarUrl = isDisplayableMediaUrl(av) ? av : null;
  let timeStr = "— · 🌐";
  try {
    timeStr = `${formatRelativeTime(p.createdAt)} · 🌐`;
  } catch {
    /* keep default */
  }
  const logoSource = safeUiString(name, "Company");
  return {
    company: name,
    time: timeStr,
    text:
      typeof p.content === "string"
        ? p.content
        : safeUiString(p.content != null ? String(p.content) : "", ""),
    image: img,
    logoText: initialsFromName(logoSource).slice(0, 4),
    avatarUrl,
    postId: p.id ?? p._id,
    idx,
  };
}

function ProfilePage() {
  const { id: urlProfileId } = useParams();
  const navigate = useNavigate();
  const viewerBase = useAuthUser();
  const loggedIn = isLoggedIn();
  const viewerRole = viewerBase?.role ?? null;
  const viewerId = viewerBase?.id ?? viewerBase?._id;
  const stored = getUser();
  const currentUser =
    stored && typeof stored === "object" ? stored : {};
  const profileId =
    urlProfileId != null && String(urlProfileId).trim() !== ""
      ? urlProfileId
      : viewerId ?? currentUser?.id ?? currentUser?._id ?? null;

  const [activeTab, setActiveTab] = useState("about");
  const [profile, setProfile] = useState(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [notifUnread, setNotifUnread] = useState(0);
  const [topSearch, setTopSearch] = useState("");
  const [followedSet, setFollowedSet] = useState(() => loadFollowSet());
  const [messagesUnread, setMessagesUnread] = useState(0);
  const [companyEditOpen, setCompanyEditOpen] = useState(false);
  const [companySaving, setCompanySaving] = useState(false);
  const [companyEdit, setCompanyEdit] = useState({
    companyName: "",
    industryCategory: "",
    industryOther: "",
    location: "",
    website: "",
    bio: "",
    companySize: "",
    logoUrl: "",
    coverUrl: "",
  });
  const [companyIndustryErrors, setCompanyIndustryErrors] = useState({
    cat: "",
    cust: "",
  });
  const [companyProfileNotice, setCompanyProfileNotice] = useState("");
  const [reportCompanyOpen, setReportCompanyOpen] = useState(false);
  const [companyReviewsBundle, setCompanyReviewsBundle] = useState(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsLoadError, setReviewsLoadError] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    rating: 5,
    title: "",
    comment: "",
    interviewExperience: "",
  });
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewNotice, setReviewNotice] = useState("");

  const profileNumericId = useMemo(() => {
    const n = Number(profileId);
    return Number.isFinite(n) ? n : null;
  }, [profileId]);

  const reloadProfile = async () => {
    try {
      if (!profileId) return;
      const { data: prof } = await api.get(`/api/users/profile/${profileId}`);
      if (prof && typeof prof === "object") {
        setProfile(prof);
        setUsedFallback(false);
        setFetchError("");
      } else {
        setProfile({ ...PROFILE_EMPTY_COMPANY });
        setUsedFallback(true);
        setFetchError("Invalid profile response.");
      }
    } catch (e) {
      setProfile({ ...PROFILE_EMPTY_COMPANY });
      setUsedFallback(true);
      setFetchError(formatProfileLoadError(e));
    }
  };

  useEffect(() => {
    let cancelled = false;
    setProfile(null);
    setUsedFallback(false);
    setFetchError("");
    if (!profileId) {
      setProfile({ ...PROFILE_EMPTY_COMPANY });
      setUsedFallback(true);
      setFetchError("Missing profile id. Open Company Profile from the sidebar.");
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      try {
        const { data: prof } = await api.get(`/api/users/profile/${profileId}`);
        if (!cancelled) {
          if (prof && typeof prof === "object") {
            setProfile(prof);
            setUsedFallback(false);
            setFetchError("");
          } else {
            setProfile({ ...PROFILE_EMPTY_COMPANY });
            setUsedFallback(true);
            setFetchError("Invalid profile response.");
          }
        }
      } catch (e) {
        if (!cancelled) {
          setProfile({ ...PROFILE_EMPTY_COMPANY });
          setUsedFallback(true);
          setFetchError(formatProfileLoadError(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  useEffect(() => {
    if (
      profile?.profileType !== "company" ||
      profileNumericId == null ||
      Number.isNaN(profileNumericId)
    ) {
      setCompanyReviewsBundle(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setReviewsLoading(true);
      setReviewsLoadError(false);
      try {
        const { data } = await api.get(
          `/api/companies/${profileNumericId}/reviews`
        );
        if (!cancelled) setCompanyReviewsBundle(data || null);
      } catch {
        if (!cancelled) {
          setCompanyReviewsBundle(null);
          setReviewsLoadError(true);
        }
      } finally {
        if (!cancelled) setReviewsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.profileType, profileNumericId, profileId]);

  useEffect(() => {
    if (!loggedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/api/notifications");
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setNotifUnread(list.filter((n) => !n.isRead).length);
      } catch {
        setNotifUnread(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loggedIn]);

  useEffect(() => {
    if (!loggedIn) return;
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
  }, [loggedIn]);

  useEffect(() => subscribeFollowChanges(setFollowedSet), []);

  useEffect(() => {
    if (!loggedIn) {
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
  }, [loggedIn]);

  const followedSetSafe = useMemo(() => {
    if (followedSet instanceof Set) return followedSet;
    return new Set();
  }, [followedSet]);

  const goRoleHome = () => {
    if (viewerRole) navigate(dashboardPath(viewerRole));
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
    if (viewerRole === "candidate") {
      navigate("/candidate-dashboard", { state: { tab: "findJobs", q } });
      return;
    }
    navigate(`${dashboardPath(viewerRole)}?q=${encodeURIComponent(q)}`);
  };

  const signOut = () => {
    logout();
    navigate("/login");
  };

  const toggleFollowProfile = async () => {
    if (!profileId) return;
    const has = followedSetSafe.has(String(profileId));
    if (!loggedIn) {
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

  const isFollowingProfile =
    profileId != null ? followedSetSafe.has(String(profileId)) : false;

  const sameAsViewer =
    viewerId != null && profileId != null && idsEqual(viewerId, profileId);

  const viewer = useMemo(() => {
    if (!viewerBase) return null;
    if (!loggedIn || !sameAsViewer || !profile || profile.profileType !== "company") {
      return viewerBase;
    }
    return normalizeStoredUser({
      ...viewerBase,
      ...profile,
      role: profile.role || viewerBase.role || "company",
      id: viewerBase.id ?? viewerBase._id,
      email: viewerBase.email,
    });
  }, [viewerBase, loggedIn, sameAsViewer, profile]);

  if (profile === null) {
    const loadingMain = (
      <main className="main-content lc-candidate-profile-shell">
        <div className="lc-profile-loading-shell lc-glass-card">
          <p>Loading profile…</p>
        </div>
      </main>
    );
    if (!loggedIn) {
      return (
        <div className="lc-profile-loading lc-profile-loading--simple lc-profile-loading--guest-wide">
          <p>Loading company profile…</p>
        </div>
      );
    }
    if (viewerRole === "company") {
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
            onMessagesClick={() => navigate("/messages")}
            onNotificationsClick={() => navigate("/notifications")}
            subtitle="Company"
          />
          <div className="layout">
            <CandidateSidebar
              variant="company"
              user={viewer}
              activeKey="myProfile"
              notifUnread={notifUnread}
              messagesUnread={messagesUnread}
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
              onMyProfile={() =>
                viewerId && navigate(`/company-profile/${viewerId}`)
              }
              onFindJobs={() => {}}
              onApplications={() => {}}
              onSavedJobs={() => {}}
              onSignOut={signOut}
            />
            {loadingMain}
            <DashboardRail />
          </div>
        </div>
      );
    }

    const dashCand = () =>
      viewerRole === "admin"
        ? navigate("/admin-dashboard")
        : navigate("/candidate-dashboard", { state: { tab: "dashboard" } });

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
          onMessagesClick={() => navigate("/messages")}
          onNotificationsClick={() => navigate("/notifications")}
          subtitle="Profile"
        />
        <div className="layout">
          <CandidateSidebar
            user={viewer}
            activeKey="companyBrowse"
            notifUnread={notifUnread}
            messagesUnread={messagesUnread}
            onDashboard={dashCand}
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
            onMessages={() => navigate("/messages")}
            onNotifications={() => navigate("/notifications")}
            onMyProfile={() => {
              const uid = viewer?.id ?? viewer?._id;
              if (uid) navigate(`/candidate-profile/${uid}`);
            }}
            onSignOut={signOut}
          />
          {loadingMain}
          <DashboardRail />
        </div>
      </div>
    );
  }

  if (profile.profileType === "candidate") {
    return <Navigate to={`/candidate-profile/${profileId}`} replace />;
  }

  const prof =
    profile.profileType === "company"
      ? profile
      : usedFallback
        ? PROFILE_EMPTY_COMPANY
        : PROFILE_EMPTY_COMPANY;

  const companyName =
    safeUiString(prof?.companyName ?? prof?.company_name, "").trim() ||
    "Company";
  const industry = safeUiString(prof?.industry, "").trim();
  const location = safeUiString(prof?.location, "").trim();
  const website = safeUiString(prof?.website, "").trim();
  const bio =
    typeof prof?.bio === "string"
      ? prof.bio.trim()
      : safeUiString(prof?.bio != null ? String(prof.bio) : "", "").trim();
  const profWithRole = { ...prof, role: prof.role || "company" };
  const logoSource = getProfileImage(profWithRole);
  const logoImgSrc = isDisplayableMediaUrl(logoSource) ? logoSource : null;
  const coverSource = getCoverImage(prof);
  const coverBgUrl = isDisplayableMediaUrl(coverSource) ? coverSource : null;
  const openJobs = (
    Array.isArray(prof?.openJobs) ? prof.openJobs : []
  ).filter((j) => j && typeof j === "object");
  const postsRaw = (
    Array.isArray(prof?.posts) && prof.posts.length ? prof.posts : []
  ).filter((p) => p && typeof p === "object");
  const isCoVerified =
    prof?.isVerified === true ||
    prof?.is_verified === true ||
    prof?.isVerified === 1 ||
    prof?.is_verified === 1 ||
    String(prof?.isVerified || prof?.is_verified || "")
      .toLowerCase()
      .trim() === "true";

  const logoMark = logoImgSrc ? (
      <div className="company-logo-large" style={{ padding: 0 }}>
        <img
          src={logoImgSrc}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: 12,
            display: "block",
          }}
        />
      </div>
    ) : (
      <div className="company-logo-large">
        {initialsFromName(safeUiString(companyName, "Company"))}
      </div>
    );

  const postsUi =
    postsRaw.length > 0 ? postsRaw.map((p, i) => mapPostForUi(p, i)) : [];

  const companySizeStr = safeUiString(
    typeof prof?.companySize === "string"
      ? prof.companySize
      : prof?.companySize != null
        ? String(prof.companySize)
        : "",
    ""
  ).trim();

  const handlePostLike = async (postId) => {
    if (!postId) return;
    if (!loggedIn) {
      navigate("/login");
      return;
    }
    try {
      await api.put(`/api/posts/${postId}/like`);
      await reloadProfile();
    } catch (e) {
      alert(e.response?.data?.message || e.message || "Could not like");
    }
  };

  const handlePostShare = async (postId) => {
    if (!postId) return;
    if (!loggedIn) {
      navigate("/login");
      return;
    }
    try {
      await api.put(`/api/posts/${postId}/share`);
      await reloadProfile();
    } catch {
      alert("Could not update share.");
    }
  };

  const handlePostComment = async (postId) => {
    if (!postId) return;
    if (!loggedIn) {
      navigate("/login");
      return;
    }
    const text = window.prompt("Write a comment:");
    if (!text?.trim()) return;
    try {
      await api.post(`/api/posts/${postId}/comments`, { text: text.trim() });
      await reloadProfile();
    } catch (e) {
      alert(e.response?.data?.message || e.message || "Could not comment");
    }
  };

  const canDeleteProfilePost = (row) => {
    if (!row?.postId) return false;
    if (String(viewerRole || "").toLowerCase() === "admin") return true;
    return Boolean(
      loggedIn &&
        sameAsViewer &&
        String(viewerRole || "").toLowerCase() === "company"
    );
  };

  const handleProfilePostDelete = async (postId) => {
    if (!postId) return;
    if (!window.confirm("Delete this post? This action cannot be undone.")) return;
    try {
      await api.delete(`/api/posts/${postId}`);
      await reloadProfile();
    } catch (e) {
      alert(e.response?.data?.message || e.message || "Could not delete post");
    }
  };

  const renderAbout = () => (
    <div className="profile-tab-content">
      <h3>About</h3>
      {bio ? (
        <p className="about-text">{bio}</p>
      ) : (
        <div style={{ marginBottom: 14 }}>
          <p className="about-text lc-profile-empty-msg">
            {usedFallback
              ? "We couldn't load this company profile."
              : "No about information added yet."}
          </p>
          {loggedIn && viewerRole === "company" && sameAsViewer ? (
            <button type="button" className="link-like" onClick={openCompanyEdit}>
              ✎ Edit Profile to add details
            </button>
          ) : null}
        </div>
      )}

      <div className="about-grid">
        <div className="about-card">
          <div className="about-icon">⌗</div>
          <div>
            <h4>Industry</h4>
            <p>
              {industry ||
                (!usedFallback ? (
                  <span className="lc-profile-muted">No industry added yet.</span>
                ) : (
                  <span className="lc-profile-muted">—</span>
                ))}
            </p>
          </div>
        </div>

        <div className="about-card">
          <div className="about-icon">◫</div>
          <div>
            <h4>Company Size</h4>
            <p>
              {companySizeStr ? (
                companySizeStr
              ) : !usedFallback ? (
                <span className="lc-profile-muted">No company size added yet.</span>
              ) : (
                <span className="lc-profile-muted">—</span>
              )}
            </p>
          </div>
        </div>

        <div className="about-card">
          <div className="about-icon">⌂</div>
          <div>
            <h4>Location</h4>
            <p>
              {location ||
                (!usedFallback ? (
                  <span className="lc-profile-muted">No location added yet.</span>
                ) : (
                  <span className="lc-profile-muted">—</span>
                ))}
            </p>
          </div>
        </div>

        <div className="about-card">
          <div className="about-icon">↗</div>
          <div>
            <h4>Website</h4>
            <p>
              {website ||
                (!usedFallback ? (
                  <span className="lc-profile-muted">No website added yet.</span>
                ) : (
                  <span className="lc-profile-muted">—</span>
                ))}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPosts = () => (
    <div className="profile-tab-content">
      {!postsUi.length ? (
        <p className="about-text">No posts yet.</p>
      ) : null}
      {postsUi.map((row) => (
        <div className="company-post-card" key={row.postId ?? `p-${row.idx}`}>
          <div className="company-post-header">
            <div className="company-post-user">
              <UserAvatar
                name={row.company}
                src={row.avatarUrl || undefined}
                size={44}
                className="company-post-user-avatar"
              />
              <div>
                <h4>{row.company}</h4>
                <p>{row.time}</p>
              </div>
            </div>
            {canDeleteProfilePost(row) ? (
              <button
                type="button"
                className="three-dots-btn lc-company-post-del"
                title="Delete post"
                onClick={() => void handleProfilePostDelete(row.postId)}
              >
                Delete
              </button>
            ) : (
              <button
                type="button"
                className="three-dots-btn"
                disabled
                title="More actions"
              >
                ⋮
              </button>
            )}
          </div>

          <p className="company-post-text">{row.text}</p>

          {row.image ? (
            <img className="company-post-image" src={row.image} alt="" />
          ) : null}

          <div className="company-post-actions">
            <button
              type="button"
              onClick={() => handlePostLike(row.postId)}
              disabled={!row.postId}
            >
              👍 Like
            </button>
            <button
              type="button"
              onClick={() => handlePostComment(row.postId)}
              disabled={!row.postId}
            >
              💬 Comment
            </button>
            <button
              type="button"
              onClick={() => handlePostShare(row.postId)}
              disabled={!row.postId}
            >
              ↗ Share
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  const renderJobs = () => {
    const jobRows = openJobs;
    const ownsProfileCompany =
      loggedIn &&
      viewerRole === "company" &&
      viewerId &&
      profileId &&
      String(viewerId) === String(profileId);
    const isCandidate = loggedIn && viewerRole === "candidate";

    return (
      <div className="profile-tab-content">
        {jobRows.length === 0 ? (
          <p className="about-text">No open positions right now.</p>
        ) : (
          jobRows.map((j) => {
            const jid = j.id ?? j._id;
            return (
              <div className="open-job-card" key={jid}>
                <div>
                  <h4>{safeUiString(j.title, "Open role")}</h4>
                  <p>
                    {[
                      j.location ? safeUiString(j.location, "") : "",
                      j.type ? safeUiString(j.type, "") : "",
                      j.salary ? safeUiString(j.salary, "") : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    alignItems: "flex-end",
                  }}
                >
                  {!loggedIn ? (
                    <button
                      type="button"
                      className="apply-profile-btn"
                      onClick={() => navigate("/login")}
                    >
                      Sign in to apply
                    </button>
                  ) : ownsProfileCompany ? (
                    <>
                      <button
                        type="button"
                        className="apply-profile-btn"
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
                        className="outline-btn"
                        onClick={() =>
                          navigate("/company-dashboard", {
                            state: { tab: "applicants", jobId: jid },
                          })
                        }
                      >
                        View applicants
                      </button>
                    </>
                  ) : isCandidate ? (
                    <button
                      type="button"
                      className="apply-profile-btn"
                      onClick={() =>
                        navigate("/candidate-dashboard", {
                          state: { tab: "findJobs", openApplyJobId: jid },
                        })
                      }
                    >
                      Apply
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="apply-profile-btn"
                      disabled
                      title="Only candidates can apply"
                    >
                      Only candidates can apply
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  };

  /** Company profile counts followers from local follows for this id (approximate UX). */
  const followerApprox =
    profileNumericId != null ? (isFollowingProfile ? 1 : 0) : 0;

  const industryPickFromProf = inferCategorySelection(
    industry,
    COMPANY_INDUSTRY_OPTIONS
  );

  const buildCompanyPutBody = () => ({
    companyName: (companyName || "").trim(),
    industryCategory: industryPickFromProf.category,
    industryOther: industryPickFromProf.custom,
    location,
    website,
    bio,
    companySize:
      typeof prof?.companySize === "string"
        ? prof.companySize.trim()
        : prof?.companySize ?? "",
  });

  /** Keep logo + profile_image in sync so avatars/feeds/cache stay consistent */
  const companyPhotoSavePayload = (dataUrl) => ({
    profileImage: dataUrl,
    logo: dataUrl,
  });

  const persistCompanyAvatarMedia = async (patch, notice) => {
    try {
      const { data } = await api.put("/api/users/profile", patch);
      const tok = getToken();
      if (tok && data?.user) {
        const prev = getUser() || {};
        setAuth(tok, { ...prev, ...data.user });
      }
      await reloadProfile();
      if (notice) setCompanyProfileNotice(notice);
    } catch (err) {
      console.error(
        "[PUT /api/users/profile]",
        err.response?.data ?? err.message ?? err
      );
      try {
        await reloadProfile();
      } catch {
        /* ignore */
      }
      throw err;
    }
  };

  const openCompanyEdit = () => {
    setCompanyProfileNotice("");
    const indPick = inferCategorySelection(industry, COMPANY_INDUSTRY_OPTIONS);
    setCompanyIndustryErrors({ cat: "", cust: "" });
    setCompanyEdit({
      companyName: companyName || "",
      industryCategory: indPick.category,
      industryOther: indPick.custom,
      location: location || "",
      website: website || "",
      bio: bio || "",
      companySize: prof?.companySize || "",
      logoUrl:
        typeof logoSource === "string" && logoSource.trim() !== ""
          ? logoSource.trim()
          : "",
      coverUrl:
        typeof coverSource === "string" && coverSource.trim() !== ""
          ? coverSource.trim()
          : "",
    });
    setCompanyEditOpen(true);
  };

  const submitCompanyEdit = async (e) => {
    e.preventDefault();
    if (!loggedIn || viewerRole !== "company") return;
    const indErr = composeIndustryErrors(
      companyEdit.industryCategory,
      companyEdit.industryOther
    );
    if (indErr.category || indErr.custom) {
      setCompanyIndustryErrors({ cat: indErr.category, cust: indErr.custom });
      return;
    }
    setCompanyIndustryErrors({ cat: "", cust: "" });
    setCompanySaving(true);
    try {
      const industryOther =
        companyEdit.industryCategory === OTHER_LABEL
          ? companyEdit.industryOther.trim()
          : "";
      const payload = {
        companyName: companyEdit.companyName.trim(),
        industryCategory: companyEdit.industryCategory.trim(),
        industryOther,
        location: companyEdit.location.trim(),
        website: companyEdit.website.trim(),
        bio: companyEdit.bio.trim(),
        companySize: companyEdit.companySize.trim(),
      };
      let logoTrim = companyEdit.logoUrl.trim();
      let covTrim = companyEdit.coverUrl.trim();
      if (logoTrim.startsWith("data:image"))
        logoTrim = await compressDataUrlForUpload(logoTrim);
      if (covTrim.startsWith("data:image"))
        covTrim = await compressDataUrlForUpload(covTrim);
      if (logoTrim && isDisplayableMediaUrl(logoTrim)) {
        Object.assign(payload, companyPhotoSavePayload(logoTrim));
      }
      if (covTrim && isDisplayableMediaUrl(covTrim)) {
        payload.coverImage = covTrim;
      }
      const { data } = await api.put("/api/users/profile", payload);
      const tok = getToken();
      if (tok && data?.user) {
        const prev = getUser() || {};
        setAuth(tok, { ...prev, ...data.user });
      }
      await reloadProfile();
      setCompanyProfileNotice("Profile saved successfully.");
      setCompanyEditOpen(false);
    } catch (err) {
      console.error(
        "[PUT /api/users/profile]",
        err.response?.data ?? err.message ?? err
      );
      const detail =
        err.response?.data?.message ??
        err.response?.data?.error ??
        err.message ??
        "Update failed";
      alert(String(detail));
    } finally {
      setCompanySaving(false);
    }
  };

  const pickCompanyLogoUpload = async (ev) => {
    const file = ev.target.files?.[0];
    if (!file || !String(file.type || "").startsWith("image/")) return;
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setCompanyEdit((f) => ({ ...f, logoUrl: dataUrl }));
      setProfile((prev) =>
        prev?.profileType === "company"
          ? {
              ...prev,
              logo: dataUrl,
              profileImage: dataUrl,
              profile_image: dataUrl,
            }
          : prev
      );
      const canPersist =
        loggedIn && viewerRole === "company" && sameAsViewer;
      if (canPersist) {
        try {
          await persistCompanyAvatarMedia(
            {
              ...buildCompanyPutBody(),
              ...companyPhotoSavePayload(dataUrl),
            },
            "Logo saved."
          );
        } catch (err) {
          console.error(
            "[PUT /api/users/profile]",
            err.response?.data ?? err.message ?? err
          );
          alert(
            String(
              err.response?.data?.message ??
                err.response?.data?.error ??
                err.message ??
                "Could not save image."
            )
          );
        }
      }
    } catch {
      alert("Could not read that image.");
    } finally {
      ev.target.value = "";
    }
  };

  const pickCompanyCoverUpload = async (ev) => {
    const file = ev.target.files?.[0];
    if (!file || !String(file.type || "").startsWith("image/")) return;
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setCompanyEdit((f) => ({ ...f, coverUrl: dataUrl }));
      setProfile((prev) =>
        prev?.profileType === "company"
          ? { ...prev, coverImage: dataUrl, cover_image: dataUrl }
          : prev
      );
      const canPersist =
        loggedIn && viewerRole === "company" && sameAsViewer;
      if (canPersist) {
        try {
          await persistCompanyAvatarMedia(
            { ...buildCompanyPutBody(), coverImage: dataUrl },
            "Cover photo saved."
          );
        } catch (err) {
          console.error(
            "[PUT /api/users/profile]",
            err.response?.data ?? err.message ?? err
          );
          alert(
            String(
              err.response?.data?.message ??
                err.response?.data?.error ??
                err.message ??
                "Could not save image."
            )
          );
        }
      }
    } catch {
      alert("Could not read that image.");
    } finally {
      ev.target.value = "";
    }
  };

  const actionsRow =
    !sameAsViewer && loggedIn ? (
      <div className="profile-header-actions">
        <button
          type="button"
          className="outline-btn"
          onClick={() => {
            if (profileId == null || profileId === "") return;
            navigate(`/messages?userId=${encodeURIComponent(profileId)}`);
          }}
        >
          💬 Message
        </button>
        <button
          type="button"
          className={`primary-btn ${isFollowingProfile ? "primary-btn--following" : ""}`}
          onClick={toggleFollowProfile}
        >
          {isFollowingProfile ? "✓ Following" : "+ Follow"}
        </button>
        {viewerRole === "candidate" ? (
          <button
            type="button"
            className="outline-btn lc-profile-report-co"
            onClick={() => setReportCompanyOpen(true)}
          >
            Report
          </button>
        ) : null}
      </div>
    ) : loggedIn && sameAsViewer && viewerRole === "company" ? (
      <div className="profile-header-actions">
        <button type="button" className="primary-btn" onClick={openCompanyEdit}>
          ✎ Edit Profile
        </button>
      </div>
    ) : loggedIn ? (
      <div className="profile-header-actions">
        <button type="button" className="outline-btn" disabled>
          Your page
        </button>
      </div>
    ) : (
      <div className="profile-header-actions">
        <button
          type="button"
          className="outline-btn"
          onClick={() => navigate("/login")}
        >
          💬 Sign in to message
        </button>
        <button type="button" className="primary-btn" onClick={toggleFollowProfile}>
          {isFollowingProfile ? "✓ Following" : "+ Follow"}
        </button>
      </div>
    );

  const reloadCompanyReviews = async () => {
    if (
      profileNumericId == null ||
      !Number.isFinite(profileNumericId) ||
      prof?.profileType !== "company"
    ) {
      return;
    }
    try {
      const { data } = await api.get(
        `/api/companies/${profileNumericId}/reviews`
      );
      setCompanyReviewsBundle(data || null);
      setReviewsLoadError(false);
    } catch {
      setReviewsLoadError(true);
    }
  };

  const submitCompanyReview = async (e) => {
    e.preventDefault();
    if (
      !loggedIn ||
      viewerRole !== "candidate" ||
      sameAsViewer ||
      profileNumericId == null
    ) {
      return;
    }
    const title = reviewForm.title.trim();
    const comment = reviewForm.comment.trim();
    if (!title || !comment) {
      setReviewNotice("Add a title and comment for your review.");
      return;
    }
    setReviewSaving(true);
    setReviewNotice("");
    try {
      const { data } = await api.post(
        `/api/companies/${profileNumericId}/reviews`,
        {
          rating: Number(reviewForm.rating),
          title,
          comment,
          interviewExperience:
            reviewForm.interviewExperience.trim() || undefined,
        }
      );
      setReviewNotice(data?.message || "Review submitted.");
      setReviewForm({
        rating: 5,
        title: "",
        comment: "",
        interviewExperience: "",
      });
      await reloadCompanyReviews();
    } catch (err) {
      setReviewNotice(
        err.response?.data?.message ||
          err.message ||
          "Could not submit review."
      );
    } finally {
      setReviewSaving(false);
    }
  };

  const renderReviews = () => {
    const list = Array.isArray(companyReviewsBundle?.reviews)
      ? companyReviewsBundle.reviews
      : [];
    const avg =
      companyReviewsBundle?.averageRating ?? null;

    return (
      <div className="profile-tab-content lc-company-reviews-tab">
        {reviewNotice ? (
          <p className="lc-review-notice-banner" role="status">
            {reviewNotice}
          </p>
        ) : null}
        {reviewsLoading ? (
          <p className="about-text lc-profile-muted">Loading reviews…</p>
        ) : null}
        {reviewsLoadError && !reviewsLoading ? (
          <p className="about-text lc-review-err-text">
            Could not load reviews. Try again later.
          </p>
        ) : null}
        {!reviewsLoading && companyReviewsBundle && avg != null ? (
          <div className="lc-review-summary">
            <strong>{avg}</strong>
            <span className="lc-review-stars" aria-hidden>
              {"★".repeat(Math.round(avg || 0))}
              {"☆".repeat(
                Math.max(0, 5 - Math.min(5, Math.round(Number(avg) || 0)))
              )}
            </span>
            <span className="lc-profile-muted">
              {companyReviewsBundle.count ?? list.length} approved reviews
            </span>
          </div>
        ) : null}

        {list.length === 0 && !reviewsLoading && !reviewsLoadError ? (
          <p className="about-text lc-profile-muted">No approved reviews yet.</p>
        ) : null}

        <ul className="lc-review-list">
          {list.map((rv, rvi) => (
            <li
              key={rv.id ?? rv._id ?? `rv-${rvi}`}
              className="lc-review-card lc-glass-mini"
            >
              <div className="lc-review-card-head">
                <UserAvatar
                  user={{
                    fullName: rv.author?.fullName || "Reviewer",
                    profileImage: rv.author?.profileImage,
                  }}
                  size={42}
                />
                <div>
                  <h4>{rv.title || "Review"}</h4>
                  <p className="lc-review-meta">
                    {rv.author?.fullName || "Member"} ·{" "}
                    {formatRelativeTime(rv.createdAt) || ""}
                  </p>
                  <span
                    className="lc-review-stars-mini"
                    aria-label={`Rating ${rv.rating}`}
                  >
                    {"★".repeat(Number(rv.rating) || 0)}
                    {"☆".repeat(
                      Math.max(0, 5 - Number(rv.rating || 0))
                    )}
                  </span>
                </div>
              </div>
              <p className="lc-review-body">{rv.comment}</p>
              {rv.interviewExperience ? (
                <p className="lc-review-interview">
                  <strong>Interview experience:</strong> {rv.interviewExperience}
                </p>
              ) : null}
            </li>
          ))}
        </ul>

        {loggedIn && viewerRole === "candidate" && !sameAsViewer ? (
          <form
            className="lc-review-submit-form lc-glass-mini"
            onSubmit={submitCompanyReview}
          >
            <h4>Share your interview experience</h4>
            <p className="lc-profile-muted">
              Reviews publish after moderator approval — one review per company.
            </p>
            <label className="lc-review-field">
              Rating
              <select
                value={reviewForm.rating}
                disabled={reviewSaving}
                onChange={(e) =>
                  setReviewForm((f) => ({
                    ...f,
                    rating: Number(e.target.value),
                  }))
                }
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n}/5 stars
                  </option>
                ))}
              </select>
            </label>
            <label className="lc-review-field">
              Title
              <input
                type="text"
                value={reviewForm.title}
                disabled={reviewSaving}
                onChange={(e) =>
                  setReviewForm((f) => ({ ...f, title: e.target.value }))
                }
                maxLength={255}
              />
            </label>
            <label className="lc-review-field">
              Comment
              <textarea
                rows={4}
                value={reviewForm.comment}
                disabled={reviewSaving}
                onChange={(e) =>
                  setReviewForm((f) => ({ ...f, comment: e.target.value }))
                }
              />
            </label>
            <label className="lc-review-field">
              Interview details (optional)
              <textarea
                rows={2}
                value={reviewForm.interviewExperience}
                disabled={reviewSaving}
                onChange={(e) =>
                  setReviewForm((f) => ({
                    ...f,
                    interviewExperience: e.target.value,
                  }))
                }
              />
            </label>
            <button type="submit" className="primary-btn" disabled={reviewSaving}>
              {reviewSaving ? "Submitting…" : "Submit review"}
            </button>
          </form>
        ) : null}
      </div>
    );
  };

  const innerProfile = (
    <>
      <div
        className={`lc-prof-main-stack ${loggedIn ? "lc-prof-main--inapp" : ""}`}
      >
        {companyProfileNotice ? (
          <div className="lc-profile-save-banner" role="status">
            {companyProfileNotice}
          </div>
        ) : null}
        {fetchError ? (
          <div className="feed-notice" role="alert" style={{ marginBottom: 12 }}>
            <strong>Profile not found or could not load.</strong>{" "}
            {safeUiString(fetchError, "")}
            <button
              type="button"
              className="outline-btn"
              style={{ marginLeft: 10 }}
              onClick={() => void reloadProfile()}
            >
              Retry
            </button>
          </div>
        ) : null}
        <div className="profile-header-card lc-company-profile-card">
          <div
            className="profile-cover lc-company-cover-shown"
            style={
              coverBgUrl
                ? {
                    backgroundImage: `url(${coverBgUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : undefined
            }
          >
            {loggedIn && sameAsViewer && viewerRole === "company" ? (
              <label className="company-cover-upload-btn">
                Change Cover
                <input
                  type="file"
                  accept="image/*"
                  onChange={pickCompanyCoverUpload}
                />
              </label>
            ) : null}
          </div>

          <div className="profile-header-content">
            <div className="profile-header-top">
              <div className="profile-brand-block">
                <div className="profile-logo-column">
                  {logoMark}
                  {loggedIn && sameAsViewer && viewerRole === "company" ? (
                    <label className="company-avatar-upload-btn">
                      Change Photo
                      <input
                        type="file"
                        accept="image/*"
                        onChange={pickCompanyLogoUpload}
                      />
                    </label>
                  ) : null}
                </div>

                <div className="company-main-info">
                  <div className="company-name-row lc-company-name-row">
                    <h1>{companyName}</h1>
                    {isCoVerified ? <VerifiedCompanyBadge /> : null}
                    <span className="company-badge">Company</span>
                  </div>

                  <p className="company-category">
                    {industry ? (
                      industry
                    ) : loggedIn &&
                      viewerRole === "company" &&
                      sameAsViewer ? (
                      <span className="lc-profile-muted">
                        Add your industry in Edit Profile
                      </span>
                    ) : (
                      <span className="lc-profile-muted">—</span>
                    )}
                  </p>
                  <p className="company-location">
                    {location ? (
                      <>📍 {location}</>
                    ) : loggedIn &&
                      viewerRole === "company" &&
                      sameAsViewer ? (
                      <span className="lc-profile-muted">
                        Add your headquarters in Edit Profile
                      </span>
                    ) : (
                      <span className="lc-profile-muted">—</span>
                    )}
                  </p>
                </div>
              </div>

              {actionsRow}
            </div>

            <div className="company-stats-row">
              <div className="company-stat">
                <strong>{postsUi.length}</strong>
                <span>Posts</span>
              </div>

              <div className="company-stat">
                <strong>{openJobs.length}</strong>
                <span>Open Jobs</span>
              </div>

              <div className="company-stat">
                <strong>{followerApprox}</strong>
                <span>Following this page</span>
              </div>

              <div className="company-stat website-link">
                <span>↗ Website</span>
              </div>
            </div>
          </div>
        </div>

        <div className="profile-tabs-card">
          <div className="profile-tabs">
            <button
              type="button"
              className={
                activeTab === "about" ? "profile-tab active" : "profile-tab"
              }
              onClick={() => setActiveTab("about")}
            >
              About
            </button>

            <button
              type="button"
              className={
                activeTab === "posts" ? "profile-tab active" : "profile-tab"
              }
              onClick={() => setActiveTab("posts")}
            >
              Posts
            </button>

            <button
              type="button"
              className={
                activeTab === "jobs" ? "profile-tab active" : "profile-tab"
              }
              onClick={() => setActiveTab("jobs")}
            >
              Open Jobs
            </button>

            <button
              type="button"
              className={
                activeTab === "reviews" ? "profile-tab active" : "profile-tab"
              }
              onClick={() => setActiveTab("reviews")}
            >
              Reviews
            </button>
          </div>

          {activeTab === "about" && renderAbout()}
          {activeTab === "posts" && renderPosts()}
          {activeTab === "jobs" && renderJobs()}
          {activeTab === "reviews" && renderReviews()}
        </div>

        <ReportContentModal
          open={reportCompanyOpen}
          onClose={() => setReportCompanyOpen(false)}
          targetType="company"
          targetId={profileNumericId}
          title="Report this company"
          onSubmitted={() => {
            setReportCompanyOpen(false);
            setCompanyProfileNotice(
              "Thanks — moderators received your report."
            );
          }}
        />
      </div>
    </>
  );

  /** ---- Logged-out (public) layout ---- */
  if (!loggedIn) {
    return (
      <div className="profile-page profile-page--guest">
        <header className="profile-topbar">
          <div className="profile-topbar-left">
            <div
              className="brand-mark"
              role="button"
              tabIndex={0}
              onClick={() => navigate("/")}
            />

            <div className="profile-search profile-search--guest">
              <span>⌕</span>
              <input type="text" placeholder="Search jobs, companies..." readOnly />
            </div>
          </div>

          <div className="profile-topbar-right">
            <div
              className="top-nav-item"
              role="button"
              tabIndex={0}
              onClick={() => navigate("/")}
            >
              <span>⌂</span>
              <p>Home</p>
            </div>

            <div
              className="top-nav-item notif-item"
              role="button"
              tabIndex={0}
              onClick={() => navigate("/login")}
            >
              <span>🔔</span>
              <p>Notifications</p>
            </div>

            <div className="topbar-divider"></div>

            <div className="profile-user-mini">
              <UserAvatar user={null} name="Guest" size={36} />
              <div>
                <h4>Guest</h4>
              </div>
            </div>
          </div>
        </header>

        <div className="profile-layout profile-layout--guest">
          <aside className="profile-sidebar profile-sidebar--guest">
            <div className="sidebar-guest-msg">
              <p>Welcome to LebConnect</p>
              <button
                type="button"
                className="signout-btn signout-btn-primary"
                onClick={() => navigate("/login")}
              >
                Sign In
              </button>
              <button type="button" className="signout-btn" onClick={() => navigate("/register")}>
                Create account
              </button>
            </div>
          </aside>

          <main className="profile-main profile-main--guest">{innerProfile}</main>
        </div>
      </div>
    );
  }

  /** ---- Candidate shell (Dashboard / Feed / Find Jobs…) ---- */
  if (viewerRole === "candidate") {
    const spec = safeUiString(viewer?.specialization, "");
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
          onMessagesClick={() => navigate("/messages")}
          onNotificationsClick={() => navigate("/notifications")}
          subtitle={spec || "Candidate"}
        />

        <div className="layout">
          <CandidateSidebar
            user={viewer}
            activeKey="companyBrowse"
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
              navigate("/candidate-dashboard", {
                state: { tab: "applications" },
              })
            }
            onSavedJobs={() =>
              navigate("/candidate-dashboard", { state: { tab: "savedJobs" } })
            }
            onMessages={() => navigate("/messages")}
            onNotifications={() => navigate("/notifications")}
            onMyProfile={() => {
              const uid = viewer?.id ?? viewer?._id;
              if (uid) navigate(`/candidate-profile/${uid}`);
            }}
            onSignOut={signOut}
          />
          <main className="main-content lc-candidate-profile-shell">
            {innerProfile}
          </main>
          <DashboardRail />
        </div>
      </div>
    );
  }

  /** ---- Company shell ---- */
  if (viewerRole === "company") {
    const sidebarKey = sameAsViewer ? "myProfile" : "dashboard";
    return (
      <>
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
            onMessagesClick={() => navigate("/messages")}
            onNotificationsClick={() => navigate("/notifications")}
            subtitle="Company"
          />

          <div className="layout">
            <CandidateSidebar
              variant="company"
              user={viewer}
              activeKey={sidebarKey}
              notifUnread={notifUnread}
              messagesUnread={messagesUnread}
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
              onMyProfile={() =>
                viewerId && navigate(`/company-profile/${viewerId}`)
              }
              onFindJobs={() => {}}
              onApplications={() => {}}
              onSavedJobs={() => {}}
              onSignOut={signOut}
            />
            <main className="main-content lc-candidate-profile-shell">
              {innerProfile}
            </main>
            <DashboardRail />
          </div>
        </div>

        <Modal
          open={companyEditOpen}
          title="Edit company profile"
          onClose={() => {
            if (!companySaving) setCompanyEditOpen(false);
          }}
        >
          <form className="co-job-modal-form" onSubmit={submitCompanyEdit}>
            <label className="co-modal-label">
              Company name
              <input
                className="co-modal-input"
                value={companyEdit.companyName}
                onChange={(e) =>
                  setCompanyEdit((f) => ({
                    ...f,
                    companyName: e.target.value,
                  }))
                }
                required
              />
            </label>
            <div style={{ gridColumn: "1 / -1" }}>
              <CategoryPicker
                variant="company"
                idPrefix="co-prof-ind"
                category={companyEdit.industryCategory}
                custom={companyEdit.industryOther}
                categoryError={companyIndustryErrors.cat}
                customError={companyIndustryErrors.cust}
                onCategoryChange={(v) =>
                  setCompanyEdit((f) => ({ ...f, industryCategory: v }))
                }
                onCustomChange={(v) =>
                  setCompanyEdit((f) => ({ ...f, industryOther: v }))
                }
              />
            </div>
            <label className="co-modal-label">
              Location
              <input
                className="co-modal-input"
                value={companyEdit.location}
                onChange={(e) =>
                  setCompanyEdit((f) => ({
                    ...f,
                    location: e.target.value,
                  }))
                }
              />
            </label>
            <label className="co-modal-label">
              Website
              <input
                className="co-modal-input"
                value={companyEdit.website}
                onChange={(e) =>
                  setCompanyEdit((f) => ({
                    ...f,
                    website: e.target.value,
                  }))
                }
              />
            </label>
            <label className="co-modal-label">
              Company size
              <input
                className="co-modal-input"
                value={companyEdit.companySize}
                onChange={(e) =>
                  setCompanyEdit((f) => ({
                    ...f,
                    companySize: e.target.value,
                  }))
                }
              />
            </label>
            <label className="co-modal-label">
              Bio
              <textarea
                className="co-modal-input co-modal-textarea"
                value={companyEdit.bio}
                onChange={(e) =>
                  setCompanyEdit((f) => ({ ...f, bio: e.target.value }))
                }
              />
            </label>
            <label className="co-modal-label">
              Logo (file or URL)
              <input
                type="file"
                accept="image/*"
                onChange={pickCompanyLogoUpload}
              />
              <input
                className="co-modal-input"
                type="url"
                placeholder="https://…"
                value={
                  companyEdit.logoUrl.startsWith("data:")
                    ? ""
                    : companyEdit.logoUrl
                }
                onChange={(e) =>
                  setCompanyEdit((f) => ({ ...f, logoUrl: e.target.value }))
                }
              />
            </label>
            <label className="co-modal-label">
              Cover (file or URL)
              <input
                type="file"
                accept="image/*"
                onChange={pickCompanyCoverUpload}
              />
              <input
                className="co-modal-input"
                type="url"
                placeholder="https://…"
                value={
                  companyEdit.coverUrl.startsWith("data:")
                    ? ""
                    : companyEdit.coverUrl
                }
                onChange={(e) =>
                  setCompanyEdit((f) => ({ ...f, coverUrl: e.target.value }))
                }
              />
            </label>
            <div className="co-modal-actions">
              <button
                type="button"
                className="apply-btn ghost"
                disabled={companySaving}
                onClick={() => setCompanyEditOpen(false)}
              >
                Cancel
              </button>
              <button type="submit" className="apply-btn" disabled={companySaving}>
                {companySaving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </Modal>
      </>
    );
  }

  /** ---- Admin shell ---- */
  if (viewerRole === "admin") {
    const adminName =
      viewer?.fullName || viewer?.companyName || viewer?.email || "Admin";

    return (
      <div className="admin-page">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <div
              className="brand-mark"
              role="button"
              tabIndex={0}
              onClick={goRoleHome}
              onKeyDown={(e) => e.key === "Enter" && goRoleHome()}
            >
              <div className="brand-center"></div>
            </div>

            <div className="admin-global-search">
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

          <div className="admin-topbar-right">
            <div
              className="admin-topnav-item"
              role="button"
              tabIndex={0}
              onClick={goRoleHome}
            >
              <span>⌂</span>
              <p>Home</p>
            </div>

            <div
              className="admin-topnav-item lc-msg-nav-active"
              role="button"
              tabIndex={0}
              onClick={() => navigate("/messages")}
            >
              <span>✉</span>
              <p>Messaging</p>
              {messagesUnread > 0 ? (
                <div className="admin-notif-badge admin-msg-badge">{messagesUnread}</div>
              ) : null}
            </div>

            <div
              className="admin-topnav-item admin-notif-nav"
              role="button"
              tabIndex={0}
              onClick={() => navigate("/notifications")}
            >
              <span>🔔</span>
              <p>Notifications</p>
              <div className="admin-notif-badge">{notifUnread}</div>
            </div>

            <div className="admin-divider"></div>

            <div className="admin-top-user">
              <UserAvatar user={viewer} name={adminName} size={40} />
              <div>
                <h4>{adminName}</h4>
                <p>Administrator</p>
              </div>
            </div>
          </div>
        </header>

        <div className="admin-layout">
          <aside className="admin-sidebar">
            <div className="admin-sidebar-profile">
              <div className="admin-user-circle large">AD</div>
              <div>
                <h3>{adminName}</h3>
                <p>System Administrator</p>
              </div>
            </div>

            <div className="admin-sidebar-links">
              <button
                type="button"
                className="admin-side-link"
                onClick={() => navigate("/admin-dashboard")}
              >
                <span>⌘</span>
                Dashboard
              </button>

              <button
                type="button"
                className="admin-side-link"
                onClick={() => navigate(FEED_PATH)}
              >
                <span>◫</span>
                Feed
              </button>

              <button
                type="button"
                className="admin-side-link"
                onClick={() => navigate("/messages")}
              >
                <span>✉</span>
                Messages
                {messagesUnread > 0 ? (
                  <b style={{ marginLeft: 8 }}>{messagesUnread}</b>
                ) : null}
              </button>

              <button
                type="button"
                className="admin-side-link"
                onClick={() => navigate("/notifications")}
              >
                <span>🔔</span>
                Notifications
                <b style={{ marginLeft: 8 }}>{notifUnread}</b>
              </button>

              <button
                type="button"
                className="admin-side-link"
                onClick={() => navigate("/admin-dashboard")}
                title="User management lives on the admin dashboard"
              >
                <span>◌</span>
                Users
              </button>

              <button
                type="button"
                className="admin-side-link"
                onClick={() => navigate("/admin-dashboard")}
              >
                <span>💼</span>
                Job Posts
              </button>

              <button
                type="button"
                className="admin-side-link"
                onClick={() => navigate("/admin-dashboard")}
              >
                <span>⚑</span>
                Complaints
              </button>

            </div>

            <div className="admin-sidebar-signout">
              <button type="button" className="admin-side-link" onClick={signOut}>
                <span>↲</span>
                Sign Out
              </button>
            </div>
          </aside>

          <main className="admin-main-content">{innerProfile}</main>
        </div>
      </div>
    );
  }

  /** Other roles: treat like guest chrome with minimal topbar — still show profile */
  return (
    <div className="profile-page profile-page--guest">{innerProfile}</div>
  );
}

export default ProfilePage;
