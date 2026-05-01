const FOLLOW_KEY = "followedUsers";
/** @deprecated migrated to FOLLOW_KEY */
const FOLLOW_KEY_LEGACY = "lebconnect_followed_user_ids";

const FOLLOW_UPDATED = "lebconnect:followUpdated";

const COMMENT_KEY = "lebconnect_feed_comment_extras_v1";

/** Notify same-tab listeners; `storage` only fires cross-tab */
function notifyFollowListeners() {
  try {
    window.dispatchEvent(new CustomEvent(FOLLOW_UPDATED));
  } catch {
    /* ignore */
  }
}

/** @returns {Set<string>} */
export function loadFollowSet() {
  try {
    const rawPrimary = localStorage.getItem(FOLLOW_KEY);
    if (rawPrimary != null && rawPrimary !== "") {
      const arr = JSON.parse(rawPrimary);
      const set = new Set((Array.isArray(arr) ? arr : []).map(String));
      return set;
    }
    const legacy = localStorage.getItem(FOLLOW_KEY_LEGACY);
    if (legacy != null && legacy !== "") {
      const arr = JSON.parse(legacy);
      const set = new Set((Array.isArray(arr) ? arr : []).map(String));
      saveFollowSet(set);
      localStorage.removeItem(FOLLOW_KEY_LEGACY);
      return set;
    }
    return new Set();
  } catch {
    return new Set();
  }
}

/** Persist current follow set (`followedUsers` array of string ids). */
export function saveFollowSet(set) {
  const arr = [...set].map(String);
  try {
    localStorage.setItem(FOLLOW_KEY, JSON.stringify(arr));
  } finally {
    notifyFollowListeners();
  }
}

/**
 * Subscribe to local follow list changes (same tab + other tabs).
 * @param {(set: Set<string>) => void} callback receives fresh set
 * @returns {() => void} unsubscribe
 */
export function subscribeFollowChanges(callback) {
  const wrapped = (e) => {
    if (e.type === "storage") {
      const k = e.key;
      if (k != null && k !== FOLLOW_KEY && k !== FOLLOW_KEY_LEGACY) return;
    }
    callback(loadFollowSet());
  };
  window.addEventListener(FOLLOW_UPDATED, wrapped);
  window.addEventListener("storage", wrapped);
  return () => {
    window.removeEventListener(FOLLOW_UPDATED, wrapped);
    window.removeEventListener("storage", wrapped);
  };
}

/** Toggle id in storage; ignores null/undefined/"". Returns the new Set. */
export function toggleFollowInStorage(authorId) {
  const set = loadFollowSet();
  if (
    authorId === null ||
    authorId === undefined ||
    String(authorId) === ""
  ) {
    return set;
  }
  const next = new Set(set);
  const id = String(authorId);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  saveFollowSet(next);
  return next;
}

export function commentExtrasKey(postId, commentId) {
  return `${String(postId)}::${String(commentId)}`;
}

/** @returns {Record<string, { likes: number, dislikes: number, vote: null|'like'|'dislike', replies: Array<{id: string, text: string, time: string, userId?: *, name: string, avatar?: string|null}> }>} */
export function loadCommentExtrasFlat() {
  try {
    const raw = localStorage.getItem(COMMENT_KEY);
    const o = raw ? JSON.parse(raw) : {};
    return typeof o === "object" && o !== null ? o : {};
  } catch {
    return {};
  }
}

export function saveCommentExtrasFlat(obj) {
  localStorage.setItem(COMMENT_KEY, JSON.stringify(obj));
}

const LOCAL_MESSAGES_KEY = "lebconnect_local_outbox_messages";

export function appendLocalOutboundMessage(receiverId, text) {
  let list = [];
  try {
    const raw = localStorage.getItem(LOCAL_MESSAGES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    list = Array.isArray(parsed) ? parsed : [];
  } catch {
    list = [];
  }
  list.push({
    receiverId: String(receiverId),
    text: String(text).trim(),
    at: new Date().toISOString(),
  });
  localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify(list));
}
