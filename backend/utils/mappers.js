function parseJson(val, fallback = null) {
  if (val == null) return fallback;
  if (typeof val === "object") return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

/** Normalize LONGTEXT/VARCHAR image cells (MySQL may return Buffer). */
function sqlTextCell(val) {
  if (val == null) return null;
  try {
    if (typeof Buffer !== "undefined" && Buffer.isBuffer(val)) {
      const s = val.toString("utf8").trim();
      return s === "" ? null : s;
    }
  } catch {
    /* ignore */
  }
  if (typeof val !== "string") {
    const s = String(val).trim();
    return s === "" ? null : s;
  }
  const t = val.trim();
  return t === "" ? null : t;
}

function mapUser(row) {
  if (!row) return null;
  const id = row.id;
  const base = {
    _id: id,
    id,
    email: row.email,
    role: row.role,
    fullName: row.full_name,
    specialization: row.specialization,
    normalizedSpecialization: row.normalized_specialization ?? null,
    location: row.location,
    bio: row.bio,
    skills: parseJson(row.skills, []),
    education: parseJson(row.education, []),
    experience: parseJson(row.experience, []),
    profileImage: sqlTextCell(row.profile_image),
    companyName: row.company_name,
    industry: row.industry,
    normalizedIndustry: row.normalized_industry ?? null,
    companySize: row.company_size,
    website: row.website,
    logo: sqlTextCell(row.logo),
    coverImage: sqlTextCell(row.cover_image),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  return base;
}

function mapUserPublic(row) {
  const u = mapUser(row);
  if (u) delete u.email;
  return u;
}

function mapCompanyEmbed(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    companyName: row.company_name,
    industry: row.industry,
    location: row.location,
    logo: row.logo,
    email: row.email,
    website: row.website,
  };
}

function mapJob(row, companyRow) {
  if (!row) return null;
  const job = {
    _id: row.id,
    id: row.id,
    title: row.title,
    description: row.description,
    location: row.location,
    type: row.type,
    salary: row.salary,
    requirements: parseJson(row.requirements, []),
    status: row.status,
    applicantsCount: row.applicants_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    company: companyRow ? mapCompanyEmbed(companyRow) : row.company_id,
  };
  return job;
}

/** Row from JOIN jobs + users (company) — see job list queries */
function mapJobJoined(row) {
  if (!row) return null;
  const jobRow = {
    id: row.id,
    title: row.title,
    description: row.description,
    location: row.location,
    type: row.type,
    salary: row.salary,
    requirements: row.requirements,
    status: row.status,
    applicants_count: row.applicants_count,
    created_at: row.created_at,
    updated_at: row.updated_at,
    company_id: row.company_id,
  };
  const companyRow = {
    id: row.company_user_id,
    email: row.company_email,
    company_name: row.company_name,
    industry: row.company_industry,
    location: row.company_location,
    logo: row.company_logo,
  };
  return mapJob(jobRow, companyRow);
}

module.exports = {
  parseJson,
  sqlTextCell,
  mapUser,
  mapUserPublic,
  mapCompanyEmbed,
  mapJob,
  mapJobJoined,
};
