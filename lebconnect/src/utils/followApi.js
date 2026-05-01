import api from "../api/axios";
import {
  loadFollowSet,
  saveFollowSet,
  toggleFollowInStorage,
} from "./feedStorage";

/** @returns {Promise<Set<string>>} */
export async function fetchFollowingUserIdsSet() {
  try {
    const { data } = await api.get("/api/users/following");
    const raw = data?.followingUserIds ?? data?.following ?? [];
    const arr = Array.isArray(raw) ? raw : [];
    return new Set(arr.map((x) => String(x)));
  } catch {
    return new Set();
  }
}

/**
 * Reload following list from API into local cache + React state (logged-in).
 * @param {(s: Set<string>) => void} setFollowedSet
 */
export async function hydrateFollowing(setFollowedSet) {
  const s = await fetchFollowingUserIdsSet();
  saveFollowSet(s);
  setFollowedSet(s);
}

/**
 * Follow/unfollow via API then sync Sets. Returns updated Set or null if invalid id.
 * @returns {Promise<Set<string>|null>}
 */
export async function toggleFollowViaApi(targetUserId, currentlyFollowing) {
  const id = Number(targetUserId);
  if (!Number.isFinite(id)) return null;
  if (currentlyFollowing) {
    await api.delete(`/api/users/${id}/follow`);
  } else {
    await api.post(`/api/users/${id}/follow`, {});
  }
  const next = await fetchFollowingUserIdsSet();
  saveFollowSet(next);
  return next;
}

export { loadFollowSet, toggleFollowInStorage };
