import { useMemo } from "react";
import { analyzePasswordStrength } from "../utils/passwordStrength";

/**
 * Compact strength meter for register flows (candidate + company).
 */
export default function PasswordStrengthMeter({ password }) {
  const s = useMemo(() => analyzePasswordStrength(password ?? ""), [password]);

  if (!password) return null;

  return (
    <div
      className="password-strength"
      role="status"
      aria-live="polite"
      style={{ "--pw-strength-accent": s.color }}
    >
      <div className="password-strength-head">
        <span className="password-strength-label">{s.label}</span>
      </div>
      <div className="password-strength-bar" aria-hidden="true">
        <div className="password-strength-fill" style={{ width: `${s.barPct}%` }} />
      </div>
      <ul className="password-checklist">
        <li className={`password-check-item ${s.checks.length ? "valid" : ""}`}>
          At least 8 characters
        </li>
        <li className={`password-check-item ${s.checks.uppercase ? "valid" : ""}`}>
          Uppercase letter
        </li>
        <li className={`password-check-item ${s.checks.lowercase ? "valid" : ""}`}>
          Lowercase letter
        </li>
        <li className={`password-check-item ${s.checks.number ? "valid" : ""}`}>
          Number
        </li>
        <li className={`password-check-item ${s.checks.special ? "valid" : ""}`}>
          Special character
        </li>
      </ul>
    </div>
  );
}
