import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import api from "../api/axios";
import { formatRelativeTime, initialsFromName } from "../utils/format";
import UserAvatar from "../components/UserAvatar";
import CandidateSidebar from "../components/CandidateSidebar";
import {
  dashboardPath,
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
  getProfileImage,
  isDisplayableMediaUrl,
} from "../utils/profileMedia";
import "./CandidateProfilePage.css";

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
  posts: [],
};

function mapPostForUi(p, idx) {
  const a = p.author || {};
  const name = a.fullName || a.companyName || "Member";
  const url = getProfileImage(a);
  const avatarUrl = isDisplayableMediaUrl(url) ? url : null;
  const img =
    p.image && String(p.image).trim() ? String(p.image).trim() : null;
  return {
    name,
    avatarUrl,
    time: `${formatRelativeTime(p.createdAt)} · 🌐`,
    text: p.content || "",
    image: img,
    postId: p.id ?? p._id,
    idx,
  };
}

function CandidateProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const viewerBase = useAuthUser();
  const viewerId = viewerBase?.id ?? viewerBase?._id;
  const profileId = id || viewerId;

  const [activeTab, setActiveTab] = useState("about");
  const [profile, setProfile] = useState(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const [notifUnread, setNotifUnread] = useState(0);
  const [messagesUnread, setMessagesUnread] = useState(0);
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

  const reloadProfile = async () => {
    try {
      if (!profileId) return;
      const { data } = await api.get(`/api/users/profile/${profileId}`);
      setProfile(data);
      setUsedFallback(false);
    } catch {
      setProfile({ ...EMPTY_CANDIDATE_PROFILE });
      setUsedFallback(true);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setProfile(null);
    setUsedFallback(false);
    if (!profileId) {
      setProfile({ ...EMPTY_CANDIDATE_PROFILE });
      setUsedFallback(true);
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      try {
        const { data } = await api.get(`/api/users/profile/${profileId}`);
        if (!cancelled) {
          setProfile(data);
          setUsedFallback(false);
        }
      } catch {
        if (!cancelled) {
          setProfile({ ...EMPTY_CANDIDATE_PROFILE });
          setUsedFallback(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  useEffect(() => {
    if (!isLoggedIn()) return;
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

  const viewerOwnProfile =
    viewerId && profileId && String(viewerId) === String(profileId);

  const viewer = useMemo(() => {
    if (!viewerBase) return null;
    if (!viewerOwnProfile || !profile || profile.profileType !== "candidate") {
      return viewerBase;
    }
    const role = profile.role || viewerBase.role || "candidate";
    const mergedProf = { ...profile, role };
    const pImg = getProfileImage(mergedProf);
    const cImg = getCoverImage(profile);
    const out = { ...viewerBase };
    if (isDisplayableMediaUrl(pImg)) {
      out.profileImage = pImg;
      out.profile_image = pImg;
    }
    if (isDisplayableMediaUrl(cImg)) {
      out.coverImage = cImg;
      out.cover_image = cImg;
    }
    return out;
  }, [viewerBase, viewerOwnProfile, profile]);

  if (profile === null) {
    return (
      <div className="candidate-profile-page">
        <p style={{ padding: 24 }}>Loading…</p>
      </div>
    );
  }

  if (profile.profileType === "company") {
    return <Navigate to={`/company-profile/${profileId}`} replace />;
  }

  const prof =
    profile.profileType === "candidate" ? profile : EMPTY_CANDIDATE_PROFILE;

  const fullName = (prof.fullName || "").trim() || "Member";
  const specialization = (prof.specialization || "").trim();
  const location = (prof.location || "").trim();
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
    location,
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
    profileId != null && profileId !== "" && followedSet.has(String(profileId));

  const toggleFollowCandidate = async () => {
    if (profileId == null || profileId === "") return;
    const sid = String(profileId);
    const has = followedSet.has(sid);
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

  const openEditModal = () => {
    setStatusMsg("");
    setStatusKind("");
    setSpecFieldErrors({ cat: "", cust: "" });
    setEditForm({
      fullName: fullName || "",
      specializationCategory: specializationPick.category,
      specializationOther: specializationPick.custom,
      location: location || "",
      bio: prof.bio || "",
      skills: (skills || [])
        .map((s) => (typeof s === "string" ? s : String(s?.title || s?.name || "").trim()))
        .filter(Boolean)
        .join(", "),
      education: educationText,
      experience: experienceText,
      profileImage: profilePic || "",
      coverImage: coverRaw || "",
    });
    setIsEditOpen(true);
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
    value
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

  const postsRaw = Array.isArray(prof.posts) ? prof.posts : [];
  const postsUi =
    postsRaw.length > 0 ? postsRaw.map((p, i) => mapPostForUi(p, i)) : [];

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
              {location ||
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
              ) : experience.length ? (
                `${experience.length} role(s)`
              ) : !usedFallback ? (
                <span className="lc-profile-muted">No experience added yet.</span>
              ) : (
                <span className="lc-profile-muted">—</span>
              )}
            </p>
          </div>
        </div>
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
      {experience.length === 0 ? (
        <p className="candidate-about-text">No experience added yet.</p>
      ) : (
        experience.map((ex, i) => (
          <div className="experience-card" key={i}>
            <div className="experience-logo">
              {initialsFromName(ex.company || ex.title || "?")}
            </div>
            <div>
              <h4>{ex.title || "Role"}</h4>
              <p>{ex.company || "—"}</p>
              <span>
                {[ex.start, ex.end].filter(Boolean).join(" - ") || ""}
                {ex.location ? ` · ${ex.location}` : ""}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const handlePostLike = async (postId) => {
    if (!postId) return;
    if (!viewer) {
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
    if (!viewer) {
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
    if (!viewer) {
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

  const renderPosts = () => (
    <div className="candidate-tab-content">
      {!postsUi.length ? (
        <p className="candidate-about-text lc-profile-empty-msg">No posts yet.</p>
      ) : null}
      {postsUi.map((row) => (
        <div className="candidate-post-card" key={row.postId ?? `p-${row.idx}`}>
          <div className="candidate-post-header">
            <div className="candidate-post-user">
              <UserAvatar name={row.name} src={row.avatarUrl} size={44} />
              <div>
                <h4>{row.name}</h4>
                <p>{row.time}</p>
              </div>
            </div>
            <button type="button" className="candidate-dots-btn" disabled>
              ⋮
            </button>
          </div>

          <p className="candidate-post-text">{row.text}</p>

          {row.image ? (
            <img className="candidate-post-image" src={row.image} alt="" />
          ) : null}

          <div className="candidate-post-actions">
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

  const viewerLabel =
    viewer?.fullName || viewer?.companyName || viewer?.email || "Member";

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

  return (
    <div className="candidate-profile-page">
      <header className="candidate-profile-topbar">
        <div className="candidate-topbar-left">
          <div
            className="candidate-brand-mark"
            role="button"
            tabIndex={0}
            onClick={goRoleHome}
          />

          <div className="candidate-search">
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

        <div className="candidate-topbar-right">
          <div
            className="candidate-top-nav-item"
            role="button"
            tabIndex={0}
            onClick={goRoleHome}
          >
            <span>⌂</span>
            <p>Home</p>
          </div>

          {viewer ? (
            <div
              className="candidate-top-nav-item candidate-msg-item"
              role="button"
              tabIndex={0}
              onClick={() => navigate("/messages")}
            >
              <span>✉</span>
              <p>Messaging</p>
              {messagesUnread > 0 ? (
                <div className="candidate-msg-badge">{messagesUnread}</div>
              ) : null}
            </div>
          ) : null}

          <div
            className="candidate-top-nav-item candidate-notif-item"
            role="button"
            tabIndex={0}
            onClick={() =>
              viewer ? navigate("/notifications") : navigate("/login")
            }
          >
            <span>🔔</span>
            <p>Notifications</p>
            <div className="candidate-notif-badge">
              {viewer ? notifUnread : 0}
            </div>
          </div>

          <div className="candidate-topbar-divider"></div>

          <div className="candidate-user-mini">
            <UserAvatar user={viewer} size={40} />
            <div>
              <h4>{viewer ? viewerLabel : "Guest"}</h4>
            </div>
          </div>
        </div>
      </header>

      <div className="candidate-profile-layout">
        <CandidateSidebar
          user={viewer || prof}
          activeKey="myProfile"
          notifUnread={notifUnread}
          messagesUnread={messagesUnread}
          onDashboard={() => navigate("/candidate-dashboard")}
          onFeed={() => navigate("/dashboard")}
          onFindJobs={() => navigate("/candidate-dashboard")}
          onApplications={() => navigate("/candidate-dashboard")}
          onSavedJobs={() => navigate("/candidate-dashboard")}
          onMessages={() => (viewer ? navigate("/messages") : navigate("/login"))}
          onNotifications={() =>
            viewer ? navigate("/notifications") : navigate("/login")
          }
          onMyProfile={goMyProfile}
          onSignOut={signOut}
        />

        <main className="candidate-profile-main">
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

                    <p className="candidate-role">{specialization}</p>
                    <p className="candidate-location">📍 {location}</p>
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
                  <button type="button" className="candidate-circle-btn" disabled>
                    ⋮
                  </button>
                </div>
              </div>

              <div className="candidate-stats-row">
                <div className="candidate-stat">
                  <strong>{postsUi.length}</strong>
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

                <div className="candidate-stat candidate-portfolio-link">
                  <span>↗ Portfolio</span>
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
            </div>

            {activeTab === "about" && renderAbout()}
            {activeTab === "experience" && renderExperience()}
            {activeTab === "posts" && renderPosts()}
          </div>
        </main>
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
    </div>
  );
}

export default CandidateProfilePage;
