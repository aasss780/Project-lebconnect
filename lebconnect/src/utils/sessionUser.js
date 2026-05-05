import { getCoverImage, getProfileImage, isDisplayableMediaUrl } from "./profileMedia";

/**
 * Normalize JWT / localStorage user snapshots so avatar + cover survive
 * camelCase/snake_case mixing and stay in sync (especially company logo vs profile_image).
 */
export function normalizeStoredUser(raw) {
  if (!raw || typeof raw !== "object") return raw;
  const out = { ...raw };
  const role = String(out.role || "").toLowerCase();

  const canonProf = getProfileImage(out);
  const canonCov = getCoverImage(out);

  if (isDisplayableMediaUrl(canonProf)) {
    const v = canonProf.trim();
    out.profileImage = v;
    out.profile_image = v;
    if (role === "company") {
      out.logo = v;
    }
  } else {
    out.profileImage = null;
    out.profile_image = null;
    if (role === "company") {
      out.logo = null;
    }
  }

  if (isDisplayableMediaUrl(canonCov)) {
    const v = canonCov.trim();
    out.coverImage = v;
    out.cover_image = v;
  } else {
    out.coverImage = null;
    out.cover_image = null;
  }

  if (out.candidateCv != null) {
    delete out.candidateCv;
  }
  if (out.candidate_cv != null) {
    delete out.candidate_cv;
  }
  if (out.candidateCvText != null) {
    delete out.candidateCvText;
  }
  if (out.candidate_cv_text != null) {
    delete out.candidate_cv_text;
  }

  return out;
}

/** Merge partial API user payloads into session user, then canonicalize media fields. */
export function mergeSessionUsers(prev, next) {
  if (!next || typeof next !== "object") {
    return prev ? normalizeStoredUser(prev) : null;
  }
  return normalizeStoredUser({ ...(prev || {}), ...next });
}
