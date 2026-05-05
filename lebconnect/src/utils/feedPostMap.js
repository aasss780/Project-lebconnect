import { formatRelativeTime, initialsFromName } from "./format";
import { getProfileImage, isDisplayableMediaUrl } from "./profileMedia";

/** Logo class rotation for feed cards (shared with Dashboard). */
export const FEED_LOGO_CLASSES = ["tb-logo", "pm-logo"];

/** Never pass objects/arrays through to React text nodes (API glitches / bad JSON). */
export function safeDisplayString(v, fallback = "") {
  if (v == null) return fallback;
  if (typeof v === "string") {
    const t = v.trim();
    return t.length ? t : fallback;
  }
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return fallback;
}

export function idsEqual(a, b) {
  if (a === null || a === undefined || b === null || b === undefined) return false;
  if (a === "" || b === "") return false;
  return String(a) === String(b);
}

/** Align with backend viewerSameFieldBucket / authorSameFieldBucket (normalized fields preferred). */
export function normalizeFieldKey(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function authorNormalizedFieldBucket(a) {
  if (!a) return "";
  const role = String(a.role || "").toLowerCase();
  if (role === "candidate") {
    const n = a.normalizedSpecialization ?? a.normalized_specialization;
    if (n != null && String(n).trim() !== "") {
      return String(n).trim().toLowerCase();
    }
    return normalizeFieldKey(a.specialization);
  }
  if (role === "company") {
    const n = a.normalizedIndustry ?? a.normalized_industry;
    if (n != null && String(n).trim() !== "") {
      return String(n).trim().toLowerCase();
    }
    return normalizeFieldKey(a.industry);
  }
  return "";
}

export function viewerNormalizedFieldBucket(u) {
  if (!u) return "";
  const role = String(u.role || "").toLowerCase();
  if (role === "candidate") {
    const n = u.normalizedSpecialization ?? u.normalized_specialization;
    if (n != null && String(n).trim() !== "") {
      return String(n).trim().toLowerCase();
    }
    return normalizeFieldKey(u.specialization);
  }
  if (role === "company") {
    const n = u.normalizedIndustry ?? u.normalized_industry;
    if (n != null && String(n).trim() !== "") {
      return String(n).trim().toLowerCase();
    }
    return normalizeFieldKey(u.industry);
  }
  return "";
}

export function mapComment(c) {
  if (!c || typeof c !== "object") return null;
  const u = c.user && typeof c.user === "object" ? c.user : {};
  const whoRaw =
    u.companyName || u.company_name || u.fullName || u.full_name || "Member";
  const who = safeDisplayString(whoRaw, "Member");
  const avatarRaw = getProfileImage(u);
  const textRaw = c.text != null ? c.text : "";
  return {
    id: c._id ?? c.id,
    text:
      typeof textRaw === "string"
        ? textRaw
        : textRaw != null
          ? safeDisplayString(String(textRaw), "")
          : "",
    who,
    time: formatRelativeTime(c.createdAt),
    userId: u.id ?? u._id,
    role: typeof u.role === "string" ? u.role : "",
    avatar: isDisplayableMediaUrl(avatarRaw) ? avatarRaw : null,
  };
}

/**
 * @param {Record<string, unknown>} p
 * @param {number} idx
 * @param {string|number|null|undefined} currentUserId
 */
export function mapApiPost(p, idx, currentUserId) {
  if (!p || typeof p !== "object") return null;
  const a = p.author && typeof p.author === "object" ? p.author : {};
  const nameRaw = a.companyName || a.company_name || a.fullName || a.full_name || "Member";
  const name = safeDisplayString(nameRaw, "Member");
  const label = a.role === "company" ? "Company" : "Candidate";
  const subtitle = [
    safeDisplayString(a.industry || a.specialization, ""),
    safeDisplayString(a.location, ""),
  ]
    .filter(Boolean)
    .join(" · ");
  const liked =
    Array.isArray(p.likes) &&
    p.likes.some((x) => idsEqual(currentUserId, x.id ?? x._id));

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
      ? safeDisplayString(a.industry || a.companyName || a.company_name, "") ||
        "Organization"
      : safeDisplayString(a.specialization || a.email, "") ||
        subtitle ||
        "Professional";

  const contentStr =
    typeof p.content === "string"
      ? p.content
      : p.content != null
        ? safeDisplayString(String(p.content), "")
        : "";

  const verifiedRaw = a.isVerified ?? a.is_verified;
  const authorIsVerified =
    verifiedRaw === true ||
    verifiedRaw === 1 ||
    verifiedRaw === "1" ||
    String(verifiedRaw).toLowerCase() === "true";

  return {
    company: name,
    label,
    authorRole,
    subtitle: subtitle || "LebConnect member",
    badgeSubtitle,
    time: `${formatRelativeTime(p.createdAt)} · 🌐`,
    text1: contentStr,
    text2: "",
    hashtags: "",
    image,
    logo: initialsFromName(name).slice(0, 2),
    logoClass: FEED_LOGO_CLASSES[idx % FEED_LOGO_CLASSES.length],
    postId: p.id ?? p._id,
    likesCount: Array.isArray(p.likes) ? p.likes.length : 0,
    liked,
    commentsCount: Array.isArray(p.comments) ? p.comments.length : 0,
    comments: Array.isArray(p.comments)
      ? p.comments.map(mapComment).filter(Boolean)
      : [],
    shareCount: Number(p.shareCount ?? 0),
    authorId,
    authorProfileImage,
    postType: String(p.postType ?? p.post_type ?? "standard").toLowerCase(),
    jobId: p.jobId ?? p.job_id ?? null,
    linkedJobTitle: safeDisplayString(p.linkedJobTitle ?? p.linked_job_title, "") || null,
    linkedJobLocation: safeDisplayString(p.linkedJobLocation ?? p.linked_job_location, "") || null,
    linkedJobType: safeDisplayString(p.linkedJobType ?? p.linked_job_type, "") || null,
    linkedJobSalary: safeDisplayString(p.linkedJobSalary ?? p.linked_job_salary, "") || null,
    authorNormalizedBucket: authorNormalizedFieldBucket(a),
    authorIsVerified,
  };
}
