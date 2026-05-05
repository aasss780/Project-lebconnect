"use strict";

/**
 * Rule-based CV keyword scan for multiple industries (university-project style).
 * Keep industry skills aligned with `jobMatchIndustries.json`.
 */

const catalog = require("./jobMatchIndustries.json");
const { detectFieldFromText } = require("./jobMatchSkillDictionary");

const CV_EXTRA_ALIASES = {
  js: "JavaScript",
  reactjs: "React",
  nodejs: "Node.js",
  node: "Node.js",
  mysql: "MySQL",
  html5: "HTML",
  css3: "CSS",
  "ui ux": "UI/UX",
  bookkeeping: "Accounting",
  "financial reporting": "Reporting",
  hr: "Human Resources",
};

function norm(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const ALIAS_NORM_TO_CANON = {};
for (const [alias, canon] of Object.entries(catalog.aliases || {})) {
  ALIAS_NORM_TO_CANON[norm(alias)] = canon;
}
for (const [alias, canon] of Object.entries(CV_EXTRA_ALIASES)) {
  ALIAS_NORM_TO_CANON[norm(alias)] = canon;
}

const SKILL_LOOKUP = new Map();
for (const [industryKey, def] of Object.entries(catalog.industries)) {
  for (const sk of def.skills || []) {
    const key = norm(sk);
    if (!key) continue;
    const prev = SKILL_LOOKUP.get(key);
    if (prev) {
      if (!prev.industries.includes(industryKey)) prev.industries.push(industryKey);
    } else {
      SKILL_LOOKUP.set(key, { display: sk, industries: [industryKey] });
    }
  }
}

function skillCanonicalFromCvText(rawToken) {
  const t = String(rawToken || "").trim();
  if (!t) return "";
  const n = norm(t);
  const fromAlias = ALIAS_NORM_TO_CANON[n];
  if (fromAlias) return fromAlias;
  const hit = SKILL_LOOKUP.get(n);
  if (hit) return hit.display;
  return t;
}

function mentionsDictionarySkill(lower, displayName) {
  const sn = norm(displayName);
  if (!sn || sn.length < 2) return false;
  if (sn.includes(" ")) return lower.includes(sn);
  if (sn === "node.js" || sn === "nodejs") {
    return (
      lower.includes("node.js") ||
      lower.includes("nodejs") ||
      (/\bnode\b/.test(lower) && !lower.includes("node_modules"))
    );
  }
  if (sn.length <= 4 || /[.#/]/.test(displayName)) {
    return new RegExp(`\\b${escapeRe(sn)}\\b`, "i").test(lower);
  }
  return lower.includes(sn);
}

function collectDetectedSkills(lower) {
  const out = [];
  const seen = new Set();
  for (const def of Object.values(catalog.industries)) {
    for (const sk of def.skills || []) {
      if (mentionsDictionarySkill(lower, sk)) {
        const canon = skillCanonicalFromCvText(sk);
        const key = norm(canon);
        if (!seen.has(key)) {
          seen.add(key);
          out.push(canon);
        }
      }
    }
  }
  return out;
}

function profileSkillStrings(user) {
  const arr = Array.isArray(user?.skills) ? user.skills : [];
  return arr
    .map((s) => (typeof s === "string" ? s.trim() : String((s && s.title) || (s && s.name) || "").trim()))
    .filter(Boolean);
}

function profileExperienceBlob(user) {
  const ex = user?.experience;
  if (Array.isArray(ex)) {
    try {
      return norm(JSON.stringify(ex));
    } catch {
      return "";
    }
  }
  return norm(String(ex || ""));
}

function buildProfileAugmentText(user) {
  if (!user) return "";
  const parts = [
    String(user.specialization || ""),
    String(user.bio || ""),
    String(user.candidateCvText || user.candidate_cv_text || ""),
    profileSkillStrings(user).join(" "),
    profileExperienceBlob(user),
  ];
  return norm(parts.join("\n"));
}

function industryScoresFromText(blobNorm) {
  const scores = [];
  for (const [key, def] of Object.entries(catalog.industries)) {
    let score = 0;
    for (const kw of def.keywords || []) {
      const kn = norm(kw);
      if (kn.length < 2) continue;
      if (blobNorm.includes(kn)) score += kn.length >= 8 ? 4 : 3;
    }
    const labelN = norm(def.label);
    if (labelN && blobNorm.includes(labelN)) score += 5;
    for (const sk of def.skills || []) {
      const sn = norm(sk);
      if (sn.length > 2 && blobNorm.includes(sn)) score += 2;
    }
    scores.push({ key, label: def.label, score });
  }
  scores.sort((a, b) => b.score - a.score);
  return scores;
}

function fieldConfidenceFromScore(score) {
  return Math.max(0, Math.min(100, Math.round(Number(score || 0) * 6)));
}

function missingImportantKeywords(primaryKey, lower, detectedNormSet) {
  if (!primaryKey || primaryKey === "general") return [];
  const def = catalog.industries[primaryKey];
  if (!def) return [];
  const out = [];
  for (const sk of def.skills || []) {
    const n = norm(sk);
    if (n.length < 2) continue;
    if (mentionsDictionarySkill(lower, sk)) continue;
    if (detectedNormSet.has(n)) continue;
    if (out.length >= 10) break;
    out.push(sk);
  }
  return out;
}

function recommendedForField(primaryKey, detectedNormSet, lower) {
  const keys =
    primaryKey && primaryKey !== "general" && catalog.industries[primaryKey]
      ? [primaryKey]
      : Object.keys(catalog.industries);
  const out = [];
  const seen = new Set();
  for (const fk of keys) {
    const def = catalog.industries[fk];
    if (!def) continue;
    for (const sk of def.skills || []) {
      const n = norm(sk);
      if (seen.has(n)) continue;
      if (detectedNormSet.has(n)) continue;
      if (lower.includes(n)) continue;
      seen.add(n);
      out.push(sk);
      if (out.length >= 8) return out;
    }
  }
  return out;
}

function detectMissingSections(fullText, user, detectedSkills) {
  const lower = norm(fullText);
  const labels = [];

  if (!/\b[\w.%+-]+@[\w.-]+\.[a-z]{2,}\b/i.test(fullText)) {
    labels.push("Email address");
  }
  if (!/\b(\+?\d[\d\s().-]{7,})\b/.test(String(fullText))) {
    labels.push("Phone number");
  }

  const hasSkillsHeading =
    /\bskills\b/.test(lower) ||
    /\btechnical skills\b/.test(lower) ||
    /\bcore competencies\b/.test(lower) ||
    (Array.isArray(detectedSkills) && detectedSkills.length >= 3);
  const profileSkills = profileSkillStrings(user);
  if (!hasSkillsHeading && profileSkills.length < 2) {
    labels.push("Skills section");
  }

  const hasExpHeading =
    /\b(work experience|employment|professional experience|career history)\b/.test(lower) ||
    /\bexperience\b/.test(lower);
  const hasExpSignals =
    /\b(\d+)\s*(year|years|yr|yrs)\b/i.test(fullText) ||
    /\b(20\d{2}|19\d{2})\s*[–—-]\s*(20\d{2}|present|now|current)\b/i.test(fullText);
  const expBlob = profileExperienceBlob(user);
  if (!hasExpHeading && !hasExpSignals && expBlob.length < 20) {
    labels.push("Work experience");
  }

  const hasEdu =
    /\b(education|academic|qualifications|university|degree)\b/.test(lower) ||
    /\b(bachelor|bsc|b\.?a\.?|master|msc|mba|phd|diploma)\b/i.test(fullText);
  if (!hasEdu) labels.push("Education");

  const hasProj =
    /\b(projects?|portfolio|github\.com|gitlab)\b/.test(lower) ||
    /\b(case studies|selected work)\b/.test(lower);
  if (!hasProj) labels.push("Projects or portfolio");

  const hasCert =
    /\b(certifications?|certificates?|licensed|license|accredited|pmp|aws certified|google certified)\b/i.test(
      fullText
    );
  if (!hasCert) labels.push("Certifications");

  return labels;
}

function buildStrengthsWeaknesses({
  primaryLabel,
  primaryKey,
  fieldConf,
  detectedSkills,
  missingSections,
  missingIndustryKw,
  lower,
}) {
  const strengths = [];
  const weakAreas = [];

  if (primaryKey !== "general" && fieldConf >= 25) {
    strengths.push(`Your CV shows strong ${primaryLabel} keywords.`);
  } else if (primaryKey !== "general") {
    strengths.push(`Your CV suggests a ${primaryLabel} focus.`);
  }

  if (detectedSkills.length) {
    const top = detectedSkills.slice(0, 4).join(", ");
    strengths.push(`Your CV mentions ${top}${detectedSkills.length > 4 ? ", and more" : ""}.`);
  }

  if (/\b(bachelor|bsc|master|msc|mba|phd|university|college)\b/i.test(lower)) {
    strengths.push("Education or qualifications are visible in the text.");
  }
  if (/\b(20\d{2}|19\d{2})\b/.test(lower) && /\b(present|current|now)\b/.test(lower)) {
    strengths.push("A dated work timeline is suggested in the CV.");
  }

  if (missingSections.includes("Work experience")) {
    weakAreas.push("Your CV does not clearly show work experience.");
  }
  if (missingSections.includes("Skills section")) {
    weakAreas.push("Skills are not grouped in an easy-to-scan section.");
  }
  if (primaryKey !== "general" && missingIndustryKw.length >= 4) {
    weakAreas.push(`Your CV could surface more ${primaryLabel} keywords recruiters expect.`);
  }
  if (!detectedSkills.length && primaryKey === "general") {
    weakAreas.push("Industry-specific keywords are sparse — tie your wording to your target field.");
  }

  return { strengths, weakAreas };
}

function buildSuggestions(missingSections, missingIndustryKw, extractionLimited) {
  const out = [];
  if (extractionLimited) {
    out.push(
      "Upload a text-based PDF so the scanner can read the full document. Until then, results mix profile data with any recovered text."
    );
  }
  if (missingSections.includes("Email address")) {
    out.push("Add a professional email in the header or contact block.");
  }
  if (missingSections.includes("Phone number")) {
    out.push("Add a phone number with country code for local recruiters.");
  }
  if (missingSections.includes("Skills section")) {
    out.push("Add a labelled skills section with tools and methods you use regularly.");
  }
  if (missingSections.includes("Work experience")) {
    out.push("Add dated roles with outcomes (numbers where possible).");
  }
  if (missingSections.includes("Education")) {
    out.push("List degrees, schools, and graduation years.");
  }
  if (missingSections.includes("Projects or portfolio")) {
    out.push("Add 2–3 projects, portfolio links, or case studies relevant to your field.");
  }
  if (missingSections.includes("Certifications")) {
    out.push("List certifications or licences that back up your expertise.");
  }
  for (const kw of missingIndustryKw.slice(0, 4)) {
    out.push(`Consider adding the keyword “${kw}” if it applies to your background.`);
  }
  return [...new Set(out)].slice(0, 14);
}

/**
 * @param {string} mergedText raw-ish text (CV + profile augment)
 * @param {object} opts
 */
function runCvKeywordAnalysis(mergedText, opts = {}) {
  const { extractionLimited = false, message = "", fileName = "", profileUser = null } = opts;

  const lower = norm(mergedText);
  const best = detectFieldFromText(lower, "");
  const primaryKey = best.key;
  const primaryLabel = best.label;
  const fieldConfidence = fieldConfidenceFromScore(best.score);

  const industryRank = industryScoresFromText(lower);
  const detectedIndustries = industryRank
    .filter((r) => r.score > 0)
    .slice(0, 4)
    .map((r) => r.label);

  let detectedSkills = collectDetectedSkills(lower);
  const profSkills = profileSkillStrings(profileUser);
  const seen = new Set(detectedSkills.map((s) => norm(s)));
  for (const ps of profSkills) {
    const n = norm(ps);
    if (n.length < 2 || seen.has(n)) continue;
    if (lower.includes(n) || lower.includes(norm(skillCanonicalFromCvText(ps)))) {
      const label = skillCanonicalFromCvText(ps);
      if (!seen.has(norm(label))) {
        seen.add(norm(label));
        detectedSkills.push(label);
      }
    }
  }

  const detectedNormSet = new Set(detectedSkills.map((s) => norm(s)));
  const missingIndustryKw = missingImportantKeywords(primaryKey, lower, detectedNormSet);
  const recommendedKeywords = recommendedForField(primaryKey, detectedNormSet, lower);

  const missingSections = detectMissingSections(mergedText, profileUser, detectedSkills);

  const { strengths, weakAreas } = buildStrengthsWeaknesses({
    primaryLabel,
    primaryKey,
    fieldConf: fieldConfidence,
    detectedSkills,
    missingSections,
    missingIndustryKw,
    lower,
  });

  const improvementSuggestions = buildSuggestions(
    missingSections,
    missingIndustryKw,
    extractionLimited
  );

  const preview = String(mergedText || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 800);

  return {
    extractedTextPreview: preview,
    detectedSkills,
    detectedIndustries,
    primaryField: primaryLabel,
    fieldConfidence,
    missingImportantKeywords: missingIndustryKw,
    strengths,
    weakAreas,
    missingSections,
    improvementSuggestions,
    recommendedKeywords,
    extractionLimited: Boolean(extractionLimited),
    message: message || undefined,
    fileHint: typeof fileName === "string" ? fileName.trim() : "",
    possibleField: primaryLabel,
  };
}

module.exports = {
  runCvKeywordAnalysis,
  buildProfileAugmentText,
};
