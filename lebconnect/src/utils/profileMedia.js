/** Normalize profile / cover image fields from API + localStorage (camelCase + snake_case). */

function normalizeMediaString(v) {
  if (v == null) return "";
  if (typeof v !== "string") return "";
  return v.trim();
}

/** True when safe to put in <img src> / url() background (never random placeholders). */
export function isDisplayableMediaUrl(s) {
  const t = normalizeMediaString(s);
  if (!t) return false;
  if (/^https?:\/\//i.test(t)) return true;
  if (t.startsWith("/")) return true;
  if (/^data:image\//i.test(t)) return true;
  return false;
}

/**
 * Avatar URL for a user object; supports camelCase + snake_case.
 * Companies: profile_image is primary when set (covers "Change Photo" saves), then logo.
 */
export function getProfileImage(user) {
  if (!user || typeof user !== "object") return "";
  const pi = normalizeMediaString(user.profileImage ?? user.profile_image);
  const logo = normalizeMediaString(user.logo);
  const role = String(user.role || "").toLowerCase();
  if (role === "company") return pi || logo;
  return pi || logo;
}

export function getCoverImage(user) {
  if (!user || typeof user !== "object") return "";
  return normalizeMediaString(user.coverImage ?? user.cover_image);
}
