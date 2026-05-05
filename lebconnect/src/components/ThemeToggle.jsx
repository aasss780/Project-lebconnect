import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import {
  applyThemeClass,
  getStoredTheme,
  setStoredTheme,
  THEME_STORAGE_KEY,
} from "../theme-storage";
import "./ThemeToggle.css";

const ICON = { strokeWidth: 2, size: 20 };

/**
 * Light/dark toggle — same persistence as AppTopbar (`lebconnect-theme`, html classes).
 * @param {{ className?: string; solid?: boolean }} props
 */
export default function ThemeToggle({ className = "", solid = false }) {
  const [mode, setMode] = useState(() => getStoredTheme());

  useEffect(() => {
    applyThemeClass(getStoredTheme());
  }, []);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== THEME_STORAGE_KEY || e.newValue == null) return;
      if (e.newValue === "dark" || e.newValue === "light") {
        applyThemeClass(e.newValue);
        setMode(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <button
      type="button"
      className={`lc-theme-toggle lc-btn-hit${solid ? " lc-theme-toggle--solid" : ""}${
        className ? ` ${className}` : ""
      }`}
      title={mode === "dark" ? "Light mode" : "Dark mode"}
      aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => {
        const next = mode === "dark" ? "light" : "dark";
        setStoredTheme(next);
        setMode(next);
      }}
    >
      {mode === "dark" ? <Sun {...ICON} aria-hidden /> : <Moon {...ICON} aria-hidden />}
    </button>
  );
}
