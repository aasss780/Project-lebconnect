/**
 * UI-only password strength (register forms). Does not replace server rules.
 *
 * @param {string} password
 * @returns {{
 *   score: number;
 *   label: string;
 *   color: string;
 *   barPct: number;
 *   checks: { length: boolean; uppercase: boolean; lowercase: boolean; number: boolean; special: boolean };
 * }}
 */
export function analyzePasswordStrength(password) {
  const pw = typeof password === "string" ? password : "";

  const checks = {
    length: pw.length >= 8,
    uppercase: /[A-Z]/.test(pw),
    lowercase: /[a-z]/.test(pw),
    number: /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };

  const hasLetters = /[A-Za-z]/.test(pw);
  const hasNumbers = /[0-9]/.test(pw);

  const isStrong =
    pw.length >= 10 &&
    checks.uppercase &&
    checks.lowercase &&
    checks.number &&
    checks.special;

  const isMedium = pw.length >= 8 && hasLetters && hasNumbers;

  if (pw.length === 0) {
    return {
      score: -1,
      label: "",
      color: "transparent",
      barPct: 0,
      checks,
    };
  }

  let score;
  let label;
  let color;
  let barPct;

  if (isStrong) {
    score = 2;
    label = "Strong";
    color = "#16a34a";
    barPct = 100;
  } else if (isMedium) {
    score = 1;
    label = "Medium";
    color = "#d97706";
    barPct = 66;
  } else {
    score = 0;
    label = "Weak";
    color = "#dc2626";
    barPct = 33;
  }

  return { score, label, color, barPct, checks };
}
