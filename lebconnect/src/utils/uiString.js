/**
 * Values safe to render as React text (never plain objects).
 * Corrupted JSON in localStorage/API sometimes leaves fields as `{}`/`[]`.
 */
export function safeUiString(v, fallback = "") {
  if (v == null || v === "") return fallback;
  if (typeof v === "string") {
    const t = v.trim();
    return t.length ? t : fallback;
  }
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return fallback;
}
