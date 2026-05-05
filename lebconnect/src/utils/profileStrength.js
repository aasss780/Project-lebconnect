/**
 * @typedef {{ key: string, label: string, ok: boolean, weight: number, points: number }} StrengthItem
 * @typedef {{ pct: number, checklist: string[], done: number, total: number, items: StrengthItem[], pointsEarned: number, pointsPossible: number }} StrengthResult
 */

const tTrim = (v) =>
  typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();

/**
 * @param {Record<string, unknown>|null} u candidate user object
 * @returns {StrengthResult}
 */
export function candidateProfileStrength(user) {
  if (!user) {
    return {
      pct: 0,
      checklist: [],
      done: 0,
      total: 9,
      items: [],
      pointsEarned: 0,
      pointsPossible: 100,
    };
  }

  const hasPhoto = Boolean(tTrim(user.profileImage || user.profile_image));
  const hasCover = Boolean(tTrim(user.coverImage || user.cover_image));
  const hasSpec = Boolean(tTrim(user.specialization));
  const hasLoc = Boolean(tTrim(user.location));
  const hasBio = tTrim(user.bio).length > 12;
  const skills = Array.isArray(user.skills) ? user.skills : [];
  const hasSkills = skills.length > 0;
  const edu = Array.isArray(user.education) ? user.education : [];
  const hasEdu = edu.length > 0;
  const exp = Array.isArray(user.experience) ? user.experience : [];
  const hasExp = exp.length > 0;
  const hasCv =
    Boolean(tTrim(user.candidateCvFileName || user.candidate_cv_file_name)) ||
    Boolean(tTrim(user.candidateCv || user.candidate_cv));

  /** @type {StrengthItem[]} */
  const items = [
    { key: "photo", label: "Add profile photo", ok: hasPhoto, weight: 10, points: 0 },
    { key: "cover", label: "Add cover photo", ok: hasCover, weight: 5, points: 0 },
    {
      key: "spec",
      label: "Set specialization",
      ok: hasSpec,
      weight: 10,
      points: 0,
    },
    { key: "loc", label: "Add location", ok: hasLoc, weight: 10, points: 0 },
    {
      key: "bio",
      label: "Write a short bio",
      ok: hasBio,
      weight: 15,
      points: 0,
    },
    {
      key: "skills",
      label: "List your skills",
      ok: hasSkills,
      weight: 15,
      points: 0,
    },
    {
      key: "edu",
      label: "Add education",
      ok: hasEdu,
      weight: 10,
      points: 0,
    },
    {
      key: "exp",
      label: "Add experience",
      ok: hasExp,
      weight: 10,
      points: 0,
    },
    {
      key: "cv",
      label: "Upload your CV",
      ok: hasCv,
      weight: 15,
      points: 0,
    },
  ];

  let pointsEarned = 0;
  for (const it of items) {
    it.points = it.ok ? it.weight : 0;
    if (it.ok) pointsEarned += it.weight;
  }

  const pointsPossible = items.reduce((a, x) => a + x.weight, 0);
  const pct =
    pointsPossible > 0
      ? Math.round((pointsEarned / pointsPossible) * 100)
      : 0;
  const checklist = items.filter((it) => !it.ok).map((it) => it.label);
  const done = items.filter((it) => it.ok).length;

  return { pct, checklist, done, total: items.length, items, pointsEarned, pointsPossible };
}

/**
 * Company profile completeness (weights sum to 100)
 * @param {Record<string, unknown>|null} user
 * @param {{ hasActiveJob?: boolean }} extras
 */
export function companyProfileStrength(user, extras = {}) {
  if (!user) {
    return {
      pct: 0,
      checklist: [],
      done: 0,
      total: 9,
      items: [],
      pointsEarned: 0,
      pointsPossible: 100,
    };
  }

  const logoOk = Boolean(
    tTrim(user.logo || user.profileImage || user.profile_image)
  );
  const coverOk = Boolean(tTrim(user.coverImage || user.cover_image));
  const nameOk = Boolean(tTrim(user.companyName || user.company_name));
  const industryOk = Boolean(tTrim(user.industry));
  const locOk = Boolean(tTrim(user.location));
  const bioOk = tTrim(user.bio).length > 12;
  const webOk = Boolean(tTrim(user.website));
  const sizeOk = Boolean(tTrim(user.companySize || user.company_size));
  const jobOk = Boolean(extras.hasActiveJob);

  /** @type {StrengthItem[]} */
  const items = [
    { key: "logo", label: "Add company logo", ok: logoOk, weight: 10, points: 0 },
    { key: "cover", label: "Add cover photo", ok: coverOk, weight: 5, points: 0 },
    {
      key: "name",
      label: "Confirm company name",
      ok: nameOk,
      weight: 10,
      points: 0,
    },
    {
      key: "ind",
      label: "Set industry",
      ok: industryOk,
      weight: 10,
      points: 0,
    },
    { key: "loc", label: "Add headquarters / location", ok: locOk, weight: 10, points: 0 },
    {
      key: "bio",
      label: "Tell your story / about",
      ok: bioOk,
      weight: 15,
      points: 0,
    },
    { key: "web", label: "Add website URL", ok: webOk, weight: 10, points: 0 },
    {
      key: "size",
      label: "Set company size",
      ok: sizeOk,
      weight: 10,
      points: 0,
    },
    {
      key: "job",
      label: "Publish at least one active job",
      ok: jobOk,
      weight: 20,
      points: 0,
    },
  ];

  let pointsEarned = 0;
  for (const it of items) {
    it.points = it.ok ? it.weight : 0;
    if (it.ok) pointsEarned += it.weight;
  }

  const pointsPossible = items.reduce((a, x) => a + x.weight, 0);
  const pct =
    pointsPossible > 0
      ? Math.round((pointsEarned / pointsPossible) * 100)
      : 0;
  const checklist = items.filter((it) => !it.ok).map((it) => it.label);
  const done = items.filter((it) => it.ok).length;

  return { pct, checklist, done, total: items.length, items, pointsEarned, pointsPossible };
}
