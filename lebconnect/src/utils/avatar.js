import { initialsFromName } from "./format";
import { getProfileImage, isDisplayableMediaUrl } from "./profileMedia";
import { safeUiString } from "./uiString";

/** Display label for navbar / avatar (never random photos). */
export function displayNameFromUser(user) {
  if (!user || typeof user !== "object") return "Member";
  const chain =
    user.fullName ??
    user.full_name ??
    user.companyName ??
    user.company_name ??
    user.email;
  const s = safeUiString(chain, "");
  return s || "Member";
}

/** Prefer explicit image URL from user profile or company logo. */
export function avatarUrlFromUser(user) {
  const s = getProfileImage(user);
  return isDisplayableMediaUrl(s) ? s : null;
}

export { getInitials } from "./profileMedia";
export { initialsFromName };
