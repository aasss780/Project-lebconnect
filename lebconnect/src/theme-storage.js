/** @typedef {'light' | 'dark'} LebTheme */

export const THEME_STORAGE_KEY = "lebconnect-theme";

/** @returns {LebTheme} */
export function getStoredTheme() {
  try {
    const t = localStorage.getItem(THEME_STORAGE_KEY);
    if (t === "dark" || t === "light") return t;
  } catch {
    /* private mode */
  }
  return "light";
}

/** @param {LebTheme} theme */
export function applyThemeClass(theme) {
  const t = theme === "dark" ? "dark" : "light";
  const root = document.documentElement;
  root.classList.remove("theme-light", "theme-dark");
  root.classList.add(t === "dark" ? "theme-dark" : "theme-light");
}

/** @param {LebTheme} theme */
export function setStoredTheme(theme) {
  const t = theme === "dark" ? "dark" : "light";
  try {
    localStorage.setItem(THEME_STORAGE_KEY, t);
  } catch {
    /* ignore */
  }
  applyThemeClass(t);
}
