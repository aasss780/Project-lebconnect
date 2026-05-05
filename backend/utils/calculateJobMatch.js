"use strict";

/** Keep in sync with `lebconnect/src/utils/jobMatchScore.js` (same rubric + explain fields). */

const {
  buildCandidateEvidenceNormSet,
  detectCandidateField,
  detectJobField,
  isSkillRelevantToJobField,
  skillCanonicalDisplay,
  skillNormForMatch,
  suggestMissingDictionarySkills,
} = require("./jobMatchSkillDictionary");

function norm(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function prettySkillToken(w) {
  const t = String(w || "").trim();
  if (!t) return "";
  if (t.length <= 1) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function reqsToStrings(job) {
  const raw = job.requirements;
  if (Array.isArray(raw)) {
    return raw.map((x) => norm(String(x))).filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) return p.map((x) => norm(String(x))).filter(Boolean);
    } catch {
      /* ignore */
    }
    return raw
      .split(/[\n;,]+/)
      .map((x) => norm(x))
      .filter(Boolean);
  }
  return [];
}

function haystack(job) {
  const comp = job.company || {};
  const reqBits = reqsToStrings(job).join(" ");
  return norm(
    `${job.title || ""} ${job.description || ""} ${reqBits} ${job.location || ""} ${job.type || ""} ${comp.industry || ""} ${comp.companyName || ""} ${comp.location || ""}`
  );
}

function mergeCvAnalysisSkills(candidate) {
  const extra = Array.isArray(candidate.cvAnalysisDetectedSkills)
    ? candidate.cvAnalysisDetectedSkills.map((x) => String(x).trim()).filter(Boolean)
    : [];
  const baseArr = Array.isArray(candidate.skills) ? [...candidate.skills] : [];
  const seen = new Set(
    baseArr.map((s) =>
      norm(typeof s === "string" ? s : String((s && s.title) || (s && s.name) || ""))
    )
  );
  for (const x of extra) {
    const n = norm(x);
    if (n.length < 2 || seen.has(n)) continue;
    seen.add(n);
    baseArr.push(x);
  }
  return { ...candidate, skills: baseArr };
}

function candidateSpecNorm(c) {
  return (
    norm(c.normalizedSpecialization || c.normalized_specialization) ||
    norm(c.specialization)
  );
}

function specDisplayRaw(c) {
  const a = String(c.specialization || "").trim();
  if (a) return a;
  const b = String(c.normalizedSpecialization || c.normalized_specialization || "").trim();
  if (b) return b.replace(/[-_]/g, " ");
  return "";
}

function buildProfileMissing(candidate, skillsArr, spec, cvText, ul, hasAnySkill) {
  const missing = [];
  const hasSpec = spec && spec.length > 1;
  const hasSkills =
    typeof hasAnySkill === "boolean"
      ? hasAnySkill
      : skillsArr.some((s) => s && s.length > 1);
  const hasCv = cvText.length > 40;
  const hasLoc = ul && ul.length > 1;
  if (!hasSpec) missing.push("Add field / specialization");
  if (!hasSkills) missing.push("Add skills");
  if (!hasCv) missing.push("Upload CV");
  if (!hasLoc) missing.push("Add location");
  return missing;
}

function profileMissingToItems(profileMissing) {
  const out = [];
  for (const m of Array.isArray(profileMissing) ? profileMissing : []) {
    const s = String(m || "");
    if (/specialization|^Add field/i.test(s)) out.push("Field");
    else if (/skill/i.test(s)) out.push("Skills");
    else if (/CV|Upload CV/i.test(s)) out.push("CV");
    else if (/location/i.test(s)) out.push("Location");
  }
  return [...new Set(out)];
}

function hasRichExperience(candidate, expStrNorm) {
  if (Array.isArray(candidate && candidate.experience) && candidate.experience.length > 0) return true;
  return String(expStrNorm || "").length > 45;
}

function buildMatchExplanation({
  score,
  jobField,
  fieldMatchText,
  matchedSkills,
  missingSkills,
  locationMatchText,
  cvSnippets,
  cvKwHits,
  jobTypeMatchText,
  profileMissing,
  insufficientData,
  candidate,
  expStr,
}) {
  const fieldDisplay =
    jobField && jobField.key !== "general" && jobField.label
      ? String(jobField.label).trim()
      : fieldMatchText && String(fieldMatchText).trim()
        ? String(fieldMatchText).trim()
        : null;

  const skills = [...(matchedSkills || [])]
    .map((x) => String(x ?? "").trim())
    .filter(Boolean);

  const loc = locationMatchText ? String(locationMatchText).trim() : "";

  const cvKeywords = [];
  const seenKw = new Set();
  const pushKw = (x) => {
    const s = String(x ?? "").trim();
    if (!s) return;
    const k = norm(s);
    if (seenKw.has(k)) return;
    seenKw.add(k);
    cvKeywords.push(s);
  };
  for (const x of cvKwHits || []) pushKw(x);
  for (const x of cvSnippets || []) pushKw(x);
  cvKeywords.splice(8);

  const jt = jobTypeMatchText ? String(jobTypeMatchText).trim() : "";

  const missingSkillList = [...(missingSkills || [])]
    .map((x) => String(x ?? "").trim())
    .filter(Boolean);

  let profileItems = profileMissingToItems(profileMissing);
  if (!hasRichExperience(candidate, expStr) && !insufficientData) {
    profileItems = [...profileItems, "Experience"];
  }
  profileItems = [...new Set(profileItems)];

  const tips = [];
  const pm = Array.isArray(profileMissing) ? profileMissing.map((x) => String(x || "")) : [];
  if (pm.some((p) => /Upload CV|CV/i.test(p))) {
    tips.push("Upload your CV to improve match accuracy.");
  }
  if (pm.some((p) => /location/i.test(p))) {
    tips.push("Add your location to improve location matching.");
  }
  if (pm.some((p) => /skill/i.test(p))) {
    tips.push("Add skills to your profile to improve results.");
  }
  if (insufficientData) {
    tips.push("Complete your profile for a more reliable match score.");
  }
  if (!hasRichExperience(candidate, expStr) && !insufficientData) {
    tips.push("Add more experience details to improve accuracy.");
  }

  let summary = "Limited overlap — add skills, CV text, and location where this role matters.";
  if (insufficientData && score <= 45) {
    summary = "We need more profile data to score this match confidently.";
  } else if (score >= 75) {
    if (fieldDisplay && skills.length)
      summary = "Strong match — your field and skills line up well with this role.";
    else if (skills.length >= 3) summary = "Strong match — several of your skills appear in this posting.";
    else if (fieldDisplay) summary = "Strong match — your background fits the role area.";
    else summary = "Strong match based on overlap between your profile and this job.";
  } else if (score >= 55) {
    if (fieldDisplay && skills.length)
      summary = "Good match — this job fits your field and several of your skills.";
    else if (skills.length) summary = "Good match — your skills overlap with what this job asks for.";
    else if (fieldDisplay || loc || cvKeywords.length)
      summary = "Good match for your profile in a few important areas.";
    else summary = "Good match for your profile.";
  } else if (score >= 40) {
    summary = "Fair match — some details overlap; filling out your profile may raise the score.";
  }

  return {
    score,
    summary,
    matched: {
      field: fieldDisplay || null,
      skills,
      location: loc || null,
      cvKeywords,
      jobType: jt || null,
    },
    missing: {
      skills: missingSkillList,
      profileItems,
    },
    tips: [...new Set(tips)],
  };
}

function calculateJobMatch(candidate, job) {
  const emptyExplain = {
    score: 0,
    summary: "Sign in as a candidate to see match detail.",
    matched: { field: null, skills: [], location: null, cvKeywords: [], jobType: null },
    missing: { skills: [], profileItems: [] },
    tips: [],
  };
  const empty = {
    matchScore: 0,
    score: 0,
    matchReasons: [],
    reasons: [],
    matchedSkills: [],
    missingSkills: [],
    profileMissing: [],
    insufficientData: true,
    fieldMatchText: null,
    locationMatchText: null,
    jobTypeMatchText: null,
    cvSnippets: [],
    matchExplanation: emptyExplain,
  };

  if (!candidate || String(candidate.role || "").toLowerCase() !== "candidate" || !job) {
    return {
      ...empty,
      profileMissing: ["Sign in as a candidate to see match detail."],
      matchExplanation: {
        ...emptyExplain,
        summary: "Sign in as a candidate to see how jobs match your profile.",
      },
    };
  }

  const hay = haystack(job);
  const cvExtraOnly = Array.isArray(candidate.cvAnalysisDetectedSkills)
    ? candidate.cvAnalysisDetectedSkills.map((x) => String(x).trim()).filter(Boolean)
    : [];
  const candidateForMatch = mergeCvAnalysisSkills(candidate);

  const jobField = detectJobField(job, hay);
  const candidateField = detectCandidateField(candidateForMatch);
  const evidenceNormSet = buildCandidateEvidenceNormSet(candidateForMatch);

  const spec = candidateSpecNorm(candidate);
  const specLabel = specDisplayRaw(candidate);
  const cvText = norm(candidate.candidateCvText || candidate.candidate_cv_text || "");
  const bio = norm(candidate.bio || "");
  const expStr = norm(
    Array.isArray(candidate.experience)
      ? JSON.stringify(candidate.experience)
      : String(candidate.experience || "")
  );
  const blob = `${cvText} ${bio} ${expStr}`;

  const skillsDisplay = Array.isArray(candidateForMatch.skills)
    ? candidateForMatch.skills
        .map((s) =>
          typeof s === "string"
            ? s.trim()
            : String((s && s.title) || (s && s.name) || "").trim()
        )
        .filter(Boolean)
    : [];
  const skillsArr = skillsDisplay.map((s) => norm(s));
  const hasAnySkill = skillsArr.some((s) => s && s.length > 1);

  const hasCore =
    !!(spec && spec.length > 1) ||
    hasAnySkill ||
    cvText.length > 40 ||
    bio.length > 40;

  const ul = norm(candidate.location || "");
  const jl = norm(job.location || "");
  const jt = norm(job.type || "");
  const prefRaw =
    String(candidate.preferredJobType || candidate.preferred_job_type || "").trim() ||
    String(candidate.jobTypePreference || candidate.job_type_preference || "").trim();
  const pref = norm(prefRaw);
  const jobTypeRaw = String(job.type || "").trim();

  const comp = job.company || {};
  const ind = norm(comp.industry || "");

  const matchedSkills = [];
  for (let i = 0; i < skillsDisplay.length; i++) {
    const raw = skillsDisplay[i];
    const s = skillsArr[i];
    if (!s || s.length < 2) continue;
    const nCanon = skillNormForMatch(raw);
    const hit = hay.includes(s) || hay.includes(nCanon);
    if (!hit) continue;
    const canon = skillCanonicalDisplay(raw);
    const label = norm(canon) !== norm(raw) ? canon : raw;
    if (!matchedSkills.includes(label)) matchedSkills.push(label);
  }

  let score = 0;
  const narrative = [];

  let fieldPts = 0;
  let fieldMatchText = null;
  if (spec && hay.includes(spec)) {
    fieldPts += 18;
    fieldMatchText = specLabel || prettySkillToken(spec);
    narrative.push("Your field aligns with wording in this job.");
  } else if (spec) {
    const parts = spec.split(/[^a-z0-9]+/).filter((x) => x.length > 2);
    const matchedParts = parts.filter((p) => hay.includes(p));
    if (matchedParts.length > 0) {
      fieldPts += Math.min(18, 6 * matchedParts.length);
      fieldMatchText = matchedParts.map((p) => prettySkillToken(p)).join(", ");
      narrative.push("Your specialization overlaps with keywords in the posting.");
    }
  }
  if (ind && spec && (ind.includes(spec) || spec.includes(ind))) {
    fieldPts += 12;
    if (!fieldMatchText) fieldMatchText = specLabel || prettySkillToken(spec);
    narrative.push("Company industry matches your broad field.");
  } else if (ind && spec) {
    const indWords = ind.split(/\s+/).filter((w) => w.length > 3);
    if (indWords.some((w) => spec.includes(w) || w.includes(spec))) {
      fieldPts += 8;
      if (!fieldMatchText) fieldMatchText = specLabel || prettySkillToken(spec);
      narrative.push("Your profile relates to this company's sector.");
    }
  }

  if (
    jobField.key !== "general" &&
    candidateField.key !== "general" &&
    jobField.key === candidateField.key &&
    jobField.score > 0 &&
    candidateField.score > 0
  ) {
    fieldPts += Math.min(10, 5 + Math.min(5, Math.floor(jobField.score / 5)));
    fieldMatchText = fieldMatchText || jobField.label;
    narrative.push(`Role family aligns with your background (${jobField.label}).`);
  }

  fieldPts = Math.min(30, fieldPts);
  score += fieldPts;

  const reqList = reqsToStrings(job);
  const reqJoined = reqList.join(" ");
  const reqWords = [...new Set(reqJoined.split(/\s+/).filter((w) => w.length > 3))];
  const titleWords = norm(job.title || "")
    .split(/\s+/)
    .filter((w) => w.length > 3);
  const descWords = [
    ...new Set(
      norm(job.description || "")
        .split(/\s+/)
        .filter((w) => w.length > 4)
    ),
  ];
  const vocabForCv = [...new Set([...reqWords, ...titleWords.slice(0, 12), ...descWords.slice(0, 24)])];

  let skPts = 0;
  let skillHits = 0;

  const relevantSkillIndices = skillsDisplay
    .map((_, i) => i)
    .filter((i) => isSkillRelevantToJobField(skillsDisplay[i], jobField.key));

  const skillDenominatorIndices =
    relevantSkillIndices.length > 0
      ? relevantSkillIndices
      : skillsDisplay.map((_, i) => i);

  for (const i of skillDenominatorIndices) {
    const raw = skillsDisplay[i];
    const s = skillsArr[i];
    if (!s || s.length < 2) continue;
    const nCanon = skillNormForMatch(raw);
    if (hay.includes(s) || hay.includes(nCanon)) skillHits += 1;
  }

  const denomCount = skillDenominatorIndices.filter((i) => {
    const s = skillsArr[i];
    return s && s.length > 1;
  }).length;

  if (denomCount > 0) {
    skPts = Math.min(30, Math.round((skillHits / denomCount) * 30));
    if (skillHits > 0 && matchedSkills.length) {
      const shown = matchedSkills.slice(0, 4);
      narrative.push(
        `Skills match (${shown.join(", ")}${matchedSkills.length > shown.length ? ", …" : ""}) against the role.`
      );
    }
  }

  const cvKwHits = cvExtraOnly.filter((raw) => {
    const n = skillNormForMatch(raw);
    return hay.includes(norm(raw)) || hay.includes(n);
  });
  if (cvKwHits.length) {
    const shown = cvKwHits.slice(0, 5).join(", ");
    narrative.push(
      `CV Keyword Analysis overlap with this posting (${shown}${cvKwHits.length > 5 ? ", …" : ""}).`
    );
  }

  const dictMissing = suggestMissingDictionarySkills(hay, jobField.key, evidenceNormSet);
  const missingSkills = dictMissing;

  score += skPts;

  let cvPts = 0;
  const cvSnippets = [];
  const pushSnippet = (w) => {
    const p = prettySkillToken(w);
    if (p && !cvSnippets.includes(p) && cvText.includes(w)) cvSnippets.push(p);
  };

  if (cvText.length > 30 && reqWords.length > 3) {
    let cHits = 0;
    for (const w of reqWords.slice(0, 40)) {
      if (blob.includes(w)) cHits += 1;
      if (cvText.includes(w) && w.length >= 4) pushSnippet(w);
    }
    cvSnippets.splice(6);
    const denom = Math.max(6, Math.min(reqWords.length, 20));
    cvPts = Math.min(15, Math.round((cHits / denom) * 15));
    if (cvPts >= 5) {
      narrative.push("Your CV or profile echoes several stated requirements.");
    }
  } else if (bio.length > 40 && reqWords.length > 3) {
    let cHits = 0;
    for (const w of reqWords.slice(0, 25)) {
      if (bio.includes(w)) cHits += 1;
    }
    cvPts = Math.min(10, Math.round((cHits / Math.max(5, reqWords.length)) * 10));
    if (cvPts >= 4) narrative.push("Your bio overlaps with requirement themes.");
  }

  if (cvText.length > 20 && cvSnippets.length < 6) {
    for (const w of vocabForCv) {
      if (w.length < 5) continue;
      if (cvText.includes(w)) pushSnippet(w);
      if (cvSnippets.length >= 6) break;
    }
  }

  score += cvPts;

  let locPts = 0;
  let locationMatchText = null;
  if (ul && jl && (jl.includes(ul) || ul.includes(jl))) {
    locPts = 15;
    locationMatchText = String(candidate.location || "").trim() || jl;
    narrative.push(`Location aligns with your profile (${locationMatchText}).`.trim());
  } else if (ul && jl) {
    const city = ul.split(/,/)[0].trim();
    if (city.length > 2 && jl.includes(norm(city))) {
      locPts = 12;
      locationMatchText = String(candidate.location || "").trim() || city;
      narrative.push(`City overlaps with where this role is based (${city}).`);
    }
  }
  score += locPts;

  let typePts = 0;
  let jobTypeMatchText = null;
  if (pref && jt && (jt.includes(pref) || pref.includes(jt))) {
    typePts += 6;
    jobTypeMatchText = prefRaw && jobTypeRaw ? `${jobTypeRaw} · matches ${prefRaw}` : jobTypeRaw || prefRaw;
    narrative.push("Job type aligns with your stated preference.");
  }
  let twHits = 0;
  for (const w of titleWords.slice(0, 8)) {
    if (blob.includes(w)) twHits += 1;
  }
  typePts += Math.min(4, twHits * 2);
  typePts = Math.min(10, typePts);
  if (twHits > 0 && typePts > 0 && !jobTypeMatchText) {
    const terms = titleWords.filter((w) => blob.includes(w)).slice(0, 5).map(prettySkillToken);
    if (terms.length) jobTypeMatchText = `Role title overlap: ${terms.join(", ")}`;
    narrative.push("Your CV/profile reflects language from the role title.");
  }
  score += typePts;

  score = Math.max(0, Math.min(100, Math.round(score)));

  let insufficientData = false;
  const profileGaps = buildProfileMissing(candidate, skillsArr, spec, cvText, ul, hasAnySkill);
  if (!hasCore) {
    insufficientData = true;
    narrative.unshift("Complete your profile to improve match accuracy.");
    score = Math.min(score, 45);
    narrative.push("Not enough profile data for a high-confidence match.");
  }

  const uniqNarrative = [...new Set(narrative)].slice(0, 12);

  const factualReasons = [];
  if (jobField.key !== "general") {
    factualReasons.push(`Field matches: ${jobField.label}`);
  } else if (fieldMatchText) {
    factualReasons.push(`Field matches: ${fieldMatchText}`);
  }
  if (matchedSkills.length) factualReasons.push(`Skills matched: ${matchedSkills.join(", ")}`);
  if (cvKwHits.length) {
    factualReasons.push(`CV keywords matched: ${cvKwHits.join(", ")}`);
  }
  if (locationMatchText) factualReasons.push(`Location matches: ${locationMatchText}`);
  if (cvSnippets.length) factualReasons.push(`CV mentions: ${cvSnippets.join(", ")}`);
  if (jobTypeMatchText) factualReasons.push(`Job type: ${jobTypeMatchText}`);
  if (missingSkills.length) factualReasons.push(`Missing skills: ${missingSkills.join(", ")}`);

  const matchExplanation = buildMatchExplanation({
    score,
    jobField,
    fieldMatchText,
    matchedSkills,
    missingSkills,
    locationMatchText,
    cvSnippets,
    cvKwHits,
    jobTypeMatchText,
    profileMissing: profileGaps,
    insufficientData,
    candidate,
    expStr,
  });

  return {
    matchScore: score,
    score,
    matchReasons: uniqNarrative,
    reasons: factualReasons.length ? factualReasons : uniqNarrative,
    matchedSkills,
    missingSkills,
    profileMissing: insufficientData ? profileGaps : [],
    insufficientData,
    fieldMatchText,
    locationMatchText,
    jobTypeMatchText,
    cvSnippets,
    matchExplanation,
  };
}

module.exports = { calculateJobMatch };
