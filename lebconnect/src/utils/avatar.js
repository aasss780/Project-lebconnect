import { initialsFromName } from "./format";
import { getProfileImage, isDisplayableMediaUrl } from "./profileMedia";

/** Display label for navbar / avatar (never random photos). */
export function displayNameFromUser(user) {
  if (!user || typeof user !== "object") return "Member";
  return (
    user.fullName ||
    user.companyName ||
    user.email ||
    "Member"
  );
}

/** Prefer explicit image URL from user profile or company logo. */
export function avatarUrlFromUser(user) {
  const s = getProfileImage(user);
  return isDisplayableMediaUrl(s) ? s : null;
}

export { initialsFromName };
