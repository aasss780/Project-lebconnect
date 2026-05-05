import catalog from "./jobMatchIndustries.json";

function norm(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** @type {Record<string, string>} */
const ALIAS_NORM_TO_CANON = {};
for (const [alias, canon] of Object.entries(catalog.aliases || {})) {
  ALIAS_NORM_TO_CANON[norm(alias)] = canon;
}

/** skill norm -> { display, industries: string[] } */
const SKILL_LOOKUP = new Map();

function registerSkill(industryKey, displayName) {
  const key = norm(displayName);
  if (!key) return;
  const prev = SKILL_LOOKUP.get(key);
  if (prev) {
    if (!prev.industries.includes(industryKey)) prev.industries.push(industryKey);
  } else {
    SKILL_LOOKUP.set(key, { display: displayName, industries: [industryKey] });
  }
}

for (const [industryKey, def] of Object.entries(catalog.industries)) {
  for (const sk of def.skills || []) {
    registerSkill(industryKey, sk);
  }
}

/**
 * Map raw user/job text to canonical dictionary label when possible.
 * @param {string} raw
 */
export function skillCanonicalDisplay(raw) {
  const t = String(raw || "").trim();
  if (!t) return "";
  const n = norm(t);
  const fromAlias = ALIAS_NORM_TO_CANON[n];
  if (fromAlias) return fromAlias;
  const hit = SKILL_LOOKUP.get(n);
  if (hit) return hit.display;
  return t;
}

/**
 * Normalized form used for haystack / set lookups (canonical when known).
 * @param {string} raw
 */
export function skillNormForMatch(raw) {
  const canon = skillCanonicalDisplay(raw);
  return norm(canon);
}

/**
 * Industries a canonical dictionary skill belongs to.
 * @param {string} canonicalDisplay
 */
export function industriesForDictionarySkill(canonicalDisplay) {
  const hit = SKILL_LOOKUP.get(norm(canonicalDisplay));
  return hit ? [...hit.industries] : [];
}

/**
 * Best-matching industry/field from normalized blob (job or candidate text).
 * @param {string} blobNorm
 * @param {string} [companyIndustryNorm] normalized company.industry if any
 */
export function detectFieldFromText(blobNorm, companyIndustryNorm = "") {
  const combined = `${blobNorm} ${companyIndustryNorm}`.trim();
  let best = { key: "general", label: "General", score: 0 };

  for (const [key, def] of Object.entries(catalog.industries)) {
    let score = 0;
    for (const kw of def.keywords || []) {
      const kn = norm(kw);
      if (kn.length < 2) continue;
      if (combined.includes(kn)) score += kn.length >= 8 ? 4 : 3;
    }
    const labelN = norm(def.label);
    if (labelN && combined.includes(labelN)) score += 5;
    for (const sk of def.skills || []) {
      const sn = norm(sk);
      if (sn.length > 2 && combined.includes(sn)) score += 2;
    }
    if (score > best.score) {
      best = { key, label: def.label, score };
    }
  }
  return best;
}

/**
 * @param {Record<string, unknown>} candidate
 */
export function detectCandidateField(candidate) {
  const spec = norm(
    candidate.normalizedSpecialization ||
      candidate.normalized_specialization ||
      candidate.specialization ||
      ""
  );
  const bio = norm(String(candidate.bio || "")).slice(0, 400);
  const skills = Array.isArray(candidate.skills)
    ? candidate.skills
        .map((s) => (typeof s === "string" ? s : String(s?.title || s?.name || "")))
        .join(" ")
    : "";
  const blob = `${spec} ${skills} ${bio}`.trim();
  return detectFieldFromText(blob);
}

/**
 * @param {Record<string, unknown>} job
 * @param {string} jobHayNorm from haystack(job)
 */
export function detectJobField(job, jobHayNorm) {
  const comp = job.company || {};
  const ind = norm(comp.industry || "");
  return detectFieldFromText(jobHayNorm, ind);
}

/**
 * Normalized skill tokens from candidate (dictionary + custom).
 * @param {Record<string, unknown>} candidate
 */
export function candidateSkillNorms(candidate) {
  const set = new Set();
  const displayList = Array.isArray(candidate.skills)
    ? candidate.skills.map((s) =>
        typeof s === "string" ? s.trim() : String(s?.title || s?.name || "").trim()
      )
    : [];
  for (const raw of displayList) {
    if (!raw) continue;
    set.add(norm(raw));
    set.add(skillNormForMatch(raw));
  }
  return set;
}

/**
 * Skills + CV/bio tokens so dictionary “missing” skills aren’t flagged when mentioned in prose.
 * @param {Record<string, unknown>} candidate
 */
export function buildCandidateEvidenceNormSet(candidate) {
  const set = candidateSkillNorms(candidate);
  const cv = norm(candidate.candidateCvText || candidate.candidate_cv_text || "");
  const bio = norm(candidate.bio || "");
  const blob = `${cv} ${bio}`;
  for (const w of blob.split(/\s+/)) {
    if (w.length > 3) set.add(w);
  }
  return set;
}

/**
 * When job field is known, count dictionary skills for that field; custom skills always count.
 * @param {string} rawSkillDisplay
 * @param {string} jobFieldKey
 */
export function isSkillRelevantToJobField(rawSkillDisplay, jobFieldKey) {
  if (!jobFieldKey || jobFieldKey === "general") return true;
  const canon = skillCanonicalDisplay(rawSkillDisplay);
  const inds = industriesForDictionarySkill(canon);
  if (!inds.length) return true;
  return inds.includes(jobFieldKey);
}

/**
 * Dictionary-based missing skills: must appear in job haystack, not already reflected in candidate.
 * @param {string} jobHayNorm
 * @param {string} jobFieldKey
 * @param {Set<string>} candidateNormSet includes cv+bio blob norms + skill norms
 */
export function suggestMissingDictionarySkills(jobHayNorm, jobFieldKey, candidateNormSet) {
  const out = [];
  const seen = new Set();

  const trySkill = (displayName) => {
    const sn = norm(displayName);
    if (sn.length < 2) return;
    if (!jobHayNorm.includes(sn)) return;
    if (candidateNormSet.has(sn)) return;
    if (seen.has(sn)) return;
    seen.add(sn);
    out.push(displayName);
  };

  const fieldOrder =
    jobFieldKey && jobFieldKey !== "general" && catalog.industries[jobFieldKey]
      ? [jobFieldKey]
      : Object.keys(catalog.industries);

  for (const fk of fieldOrder) {
    const def = catalog.industries[fk];
    if (!def) continue;
    for (const sk of def.skills || []) {
      trySkill(sk);
      if (out.length >= 14) return out;
    }
  }

  return out;
}

export function industryLabelForKey(key) {
  return catalog.industries[key]?.label || "General";
}

export function allIndustryKeys() {
  return Object.keys(catalog.industries);
}
