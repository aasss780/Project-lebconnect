const { query } = require("../config/db");
const { USER_PUBLIC_COLUMNS } = require("../constants/userColumns");
const {
  mapUser,
  mapJobJoined,
  parseJson,
  sqlTextCell,
  userForClientSession,
} = require("../utils/mappers");
const { extractPdfTextFromBase64, extensionFromFileName } = require("../utils/cvExtract");
const {
  normalizeSpecialization,
  normalizeIndustry,
} = require("../utils/categoryNormalize");
const {
  resolveCandidateSpecialization,
  resolveCompanyIndustry,
} = require("../utils/categoryValidation");
const { hydratePosts } = require("./postController");
const {
  createNotification,
  displayActorName,
} = require("../utils/notificationHelper");

const JOB_SELECT_JOIN = `
  SELECT j.*,
         u.id AS company_user_id,
         u.email AS company_email,
         u.company_name,
         u.industry AS company_industry,
         u.location AS company_location,
         u.logo AS company_logo,
         u.is_verified AS company_is_verified
  FROM jobs j
  JOIN users u ON u.id = j.company_id
`;

const POST_AUTHOR_JOIN = `
  SELECT p.*,
         u.id AS author_uid,
         u.email AS author_email,
         u.role AS author_role,
         u.full_name AS author_full_name,
         u.company_name AS author_company_name,
         u.specialization AS author_specialization,
         u.normalized_specialization AS author_normalized_specialization,
         u.industry AS author_industry,
         u.normalized_industry AS author_normalized_industry,
         u.location AS author_location,
         u.logo AS author_logo,
         u.profile_image AS author_profile_image,
         j.title AS linked_job_title,
         j.location AS linked_job_location,
         j.type AS linked_job_type,
         j.salary AS linked_job_salary
  FROM posts p
  JOIN users u ON u.id = p.author_id
  LEFT JOIN jobs j ON j.id = p.job_id
`;

async function getPublicProfile(req, res) {
  try {
    const uid = Number(req.params.id);
    const users = await query(
      `SELECT ${USER_PUBLIC_COLUMNS} FROM users WHERE id = ?`,
      [uid]
    );
    const user = users[0];
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const postRows = await query(`${POST_AUTHOR_JOIN} WHERE p.author_id = ? ORDER BY p.created_at DESC`, [
      uid,
    ]);
    const posts = await hydratePosts(postRows);

    if (user.role === "candidate") {
      const pic = sqlTextCell(user.profile_image);
      const cov = sqlTextCell(user.cover_image);
      return res.json({
        profileType: "candidate",
        id: user.id,
        role: user.role,
        fullName: user.full_name,
        specialization: user.specialization,
        location: user.location,
        bio: user.bio,
        skills: parseJson(user.skills, []),
        education: parseJson(user.education, []),
        experience: parseJson(user.experience, []),
        candidateCv: sqlTextCell(user.candidate_cv),
        candidateCvFileName: user.candidate_cv_file_name ?? null,
        candidateCvText: sqlTextCell(user.candidate_cv_text),
        profileImage: pic,
        coverImage: cov,
        profile_image: pic,
        cover_image: cov,
        isVerified: Boolean(user.is_verified),
        posts,
      });
    }

    if (user.role === "company") {
      const openJobsRows = await query(
        `${JOB_SELECT_JOIN} WHERE j.company_id = ? AND j.status = 'active' ORDER BY j.created_at DESC`,
        [uid]
      );
      const lg = sqlTextCell(user.logo);
      const cov = sqlTextCell(user.cover_image);
      const profPic = sqlTextCell(user.profile_image);

      return res.json({
        profileType: "company",
        id: user.id,
        role: user.role,
        companyName: user.company_name,
        industry: user.industry,
        location: user.location,
        companySize: user.company_size,
        website: user.website,
        bio: user.bio,
        logo: lg,
        profileImage: profPic || lg,
        coverImage: cov,
        profile_image: profPic || lg,
        cover_image: cov,
        isVerified: Boolean(user.is_verified),
        openJobs: openJobsRows.map(mapJobJoined),
        posts,
      });
    }

    return res.status(403).json({ message: "Profile not publicly available" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load profile", error: err.message });
  }
}

/** Accept camelCase from clients; alias snake_case and common JSON strings. */
function normalizeProfileBody(raw) {
  if (!raw || typeof raw !== "object") return {};
  const src = raw;
  const body = { ...src };
  const aliasPick = [
    ["profile_image", "profileImage"],
    ["cover_image", "coverImage"],
    ["full_name", "fullName"],
    ["company_name", "companyName"],
    ["company_size", "companySize"],
  ];
  for (const [snake, camel] of aliasPick) {
    if (body[camel] === undefined && src[snake] !== undefined) {
      body[camel] = src[snake];
    }
  }
  const cvAliases = [
    ["candidate_cv", "candidateCv"],
    ["candidate_cv_file_name", "candidateCvFileName"],
    ["candidate_cv_text", "candidateCvText"],
  ];
  for (const [snake, camel] of cvAliases) {
    if (body[camel] === undefined && src[snake] !== undefined) {
      body[camel] = src[snake];
    }
  }
  function coerceMaybeArray(key) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) return;
    const v = body[key];
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) return;
    if (typeof v !== "string") return;
    const t = v.trim();
    if (!t) {
      body[key] = [];
      return;
    }
    try {
      const p = JSON.parse(t);
      body[key] = Array.isArray(p) ? p : [String(t)];
    } catch {
      body[key] = t.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
    }
  }
  coerceMaybeArray("skills");
  coerceMaybeArray("education");
  coerceMaybeArray("experience");
  if (body.candidateCv === "") body.candidateCv = null;
  for (const k of ["profileImage", "coverImage", "logo"]) {
    if (body[k] === null || body[k] === "") delete body[k];
  }
  return body;
}

async function updateMyProfile(req, res) {
  try {
    const body = normalizeProfileBody(req.body);
    const updates = [];
    const vals = [];

    let resolvedSpec = false;
    let resolvedIndustry = false;

    const roleRow = await query(`SELECT role FROM users WHERE id = ?`, [req.user.id]);
    const dbRole = roleRow[0]?.role || req.user.role;

    if (dbRole === "company") {
      if (
        typeof body.logo === "string" &&
        body.logo.trim() &&
        body.profileImage === undefined &&
        body.profile_image === undefined
      ) {
        body.profileImage = body.logo;
      }
      if (
        typeof body.profileImage === "string" &&
        body.profileImage.trim() &&
        body.logo === undefined
      ) {
        body.logo = body.profileImage;
      }
    }

    if (dbRole === "candidate" && body.specializationCategory !== undefined) {
      const r = resolveCandidateSpecialization(
        body.specializationCategory,
        body.specializationOther ?? ""
      );
      if (r.error) {
        return res.status(400).json({ message: r.error });
      }
      updates.push("specialization = ?");
      vals.push(r.specialization);
      updates.push("normalized_specialization = ?");
      vals.push(r.normalized || null);
      resolvedSpec = true;
    }

    if (dbRole === "company" && body.industryCategory !== undefined) {
      const r = resolveCompanyIndustry(body.industryCategory, body.industryOther ?? "");
      if (r.error) {
        return res.status(400).json({ message: r.error });
      }
      updates.push("industry = ?");
      vals.push(r.industry);
      updates.push("normalized_industry = ?");
      vals.push(r.normalized || null);
      resolvedIndustry = true;
    }

    const map = {
      fullName: "full_name",
      specialization: "specialization",
      location: "location",
      bio: "bio",
      profileImage: "profile_image",
      companyName: "company_name",
      industry: "industry",
      companySize: "company_size",
      website: "website",
      logo: "logo",
      coverImage: "cover_image",
    };

    const imagePatchKeys = new Set(["profileImage", "coverImage", "logo"]);

    for (const [camel, col] of Object.entries(map)) {
      if (resolvedSpec && camel === "specialization") continue;
      if (resolvedIndustry && camel === "industry") continue;
      if (body[camel] === undefined) continue;
      if (imagePatchKeys.has(camel)) {
        const v = body[camel];
        if (v === null || v === "") continue;
      }
      updates.push(`${col} = ?`);
      vals.push(body[camel]);
    }

    if (body.skills !== undefined) {
      updates.push("skills = ?");
      vals.push(JSON.stringify(Array.isArray(body.skills) ? body.skills : []));
    }
    if (body.education !== undefined) {
      updates.push("education = ?");
      vals.push(JSON.stringify(Array.isArray(body.education) ? body.education : []));
    }
    if (body.experience !== undefined) {
      updates.push("experience = ?");
      vals.push(JSON.stringify(Array.isArray(body.experience) ? body.experience : []));
    }

    if (!resolvedSpec && body.specialization !== undefined) {
      updates.push("normalized_specialization = ?");
      vals.push(normalizeSpecialization(body.specialization) || null);
    }
    if (!resolvedIndustry && body.industry !== undefined) {
      updates.push("normalized_industry = ?");
      vals.push(normalizeIndustry(body.industry) || null);
    }

    if (
      dbRole === "candidate" &&
      Object.prototype.hasOwnProperty.call(body, "candidateCv")
    ) {
      const cvPayload = body.candidateCv;
      if (cvPayload === null || cvPayload === "") {
        updates.push("candidate_cv = ?", "candidate_cv_file_name = ?", "candidate_cv_text = ?");
        vals.push(null, null, null);
      } else if (typeof cvPayload === "string" && cvPayload.trim()) {
        let fileName =
          typeof body.candidateCvFileName === "string"
            ? body.candidateCvFileName.trim().slice(0, 255)
            : "cv-upload";
        if (!fileName) fileName = "cv-upload";
        let cvText =
          typeof body.candidateCvText === "string" ? String(body.candidateCvText).trim() : "";

        const ext = extensionFromFileName(fileName);
        if (ext === "pdf" && !cvText) {
          const extracted = await extractPdfTextFromBase64(cvPayload);
          cvText = extracted.text ? extracted.text.trim() : "";
          if (
            extracted.error &&
            (!cvText || cvText.length < 12)
          ) {
            console.error("[updateMyProfile] PDF extraction failed:", extracted.error);
          }
        }

        updates.push(
          "candidate_cv = ?",
          "candidate_cv_file_name = ?",
          "candidate_cv_text = ?"
        );
        vals.push(cvPayload.trim(), fileName, cvText || null);
      }
    } else if (
      dbRole === "candidate" &&
      body.candidateCvText !== undefined &&
      body.candidateCv === undefined
    ) {
      const cvTextOnly =
        body.candidateCvText === null || body.candidateCvText === ""
          ? null
          : String(body.candidateCvText).trim() || null;
      updates.push("candidate_cv_text = ?");
      vals.push(cvTextOnly);
    }

    if (updates.length) {
      vals.push(req.user.id);
      await query(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, vals);
    }

    const rows = await query(`SELECT ${USER_PUBLIC_COLUMNS} FROM users WHERE id = ?`, [
      req.user.id,
    ]);

    const row = rows[0];
    const u = mapUser(row);
    const safe = userForClientSession({
      ...u,
      profileImage: u.profileImage ?? null,
      coverImage: u.coverImage ?? null,
      logo: u.logo ?? null,
      profile_image: u.profileImage ?? null,
      cover_image: u.coverImage ?? null,
    });
    res.json({
      message: "Profile updated",
      user: safe,
    });
  } catch (err) {
    console.error("[updateMyProfile]", err);
    const sqlMsg =
      typeof err.sqlMessage === "string" ? err.sqlMessage : String(err.message || err);
    const code = err.code ? String(err.code) : "";
    const lower = sqlMsg.toLowerCase();

    let status = 500;
    let message = sqlMsg || "Update failed";

    if (
      code === "ER_NET_PACKET_TOO_LARGE" ||
      lower.includes("max_allowed_packet") ||
      lower.includes("got a packet bigger than")
    ) {
      status = 413;
      message =
        "Image file is too large for the database. Try a smaller photo or raise MySQL max_allowed_packet.";
    }

    res.status(status).json({
      message,
      error: sqlMsg.slice(0, 800),
    });
  }
}

async function listCompanies(req, res) {
  try {
    const rows = await query(
      `SELECT id, company_name, industry, location, logo, email, website, company_size, bio, is_verified, created_at
       FROM users WHERE role = 'company' ORDER BY created_at DESC`
    );
    res.json(
      rows.map((r) => ({
        _id: r.id,
        id: r.id,
        companyName: r.company_name,
        industry: r.industry,
        location: r.location,
        logo: r.logo,
        email: r.email,
        website: r.website,
        companySize: r.company_size,
        bio: r.bio,
        isVerified: Boolean(r.is_verified),
        createdAt: r.created_at,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to list companies", error: err.message });
  }
}

async function listCandidates(req, res) {
  try {
    const rows = await query(
      `SELECT id, full_name, specialization, location, profile_image, email, bio, skills, created_at
       FROM users WHERE role = 'candidate' ORDER BY created_at DESC`
    );
    res.json(
      rows.map((r) => ({
        _id: r.id,
        id: r.id,
        fullName: r.full_name,
        specialization: r.specialization,
        location: r.location,
        profileImage: r.profile_image,
        email: r.email,
        bio: r.bio,
        skills: parseJson(r.skills, []),
        createdAt: r.created_at,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to list candidates", error: err.message });
  }
}

async function getTopCompanies(req, res) {
  try {
    const limit = Math.min(Number(req.query.limit) || 8, 50);
    const rows = await query(
      `SELECT u.id,
              u.company_name,
              u.industry,
              u.location,
              u.logo,
              COUNT(CASE WHEN j.status = 'active' THEN 1 END) AS open_roles_count
       FROM users u
       LEFT JOIN jobs j ON j.company_id = u.id
       WHERE u.role = 'company'
       GROUP BY u.id, u.company_name, u.industry, u.location, u.logo
       ORDER BY open_roles_count DESC
       LIMIT ${limit}`
    );

    res.json(
      rows.map((r) => ({
        _id: r.id,
        id: r.id,
        companyName: r.company_name,
        industry: r.industry,
        location: r.location,
        logo: r.logo,
        openRolesCount: Number(r.open_roles_count),
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load top companies", error: err.message });
  }
}

async function listMyFollowing(req, res) {
  try {
    const rows = await query(
      `SELECT following_id FROM follows WHERE follower_id = ? ORDER BY created_at DESC`,
      [req.user.id]
    );
    const followingUserIds = rows.map((r) => r.following_id);
    res.json({ followingUserIds });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load following", error: err.message });
  }
}

async function getFollowStatus(req, res) {
  try {
    const targetId = Number(req.params.id);
    if (!Number.isFinite(targetId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }
    const rows = await query(
      `SELECT 1 AS ok FROM follows WHERE follower_id = ? AND following_id = ? LIMIT 1`,
      [req.user.id, targetId]
    );
    res.json({ following: rows.length > 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load follow status", error: err.message });
  }
}

async function followUser(req, res) {
  try {
    const followingId = Number(req.params.id);
    if (!Number.isFinite(followingId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }
    if (followingId === req.user.id) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }
    const targets = await query(`SELECT id FROM users WHERE id = ?`, [followingId]);
    if (!targets.length) {
      return res.status(404).json({ message: "User not found" });
    }
    try {
      await query(`INSERT INTO follows (follower_id, following_id) VALUES (?, ?)`, [
        req.user.id,
        followingId,
      ]);
      const name = displayActorName(req.user);
      await createNotification(followingId, {
        title: "New Follower",
        message: `${name} started following you`,
        type: "follow",
      });
    } catch (e) {
      if (e.errno === 1062 || e.code === "ER_DUP_ENTRY") {
        return res.json({ ok: true, following: true, alreadyFollowing: true });
      }
      throw e;
    }
    res.status(201).json({ ok: true, following: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to follow user", error: err.message });
  }
}

async function unfollowUser(req, res) {
  try {
    const followingId = Number(req.params.id);
    if (!Number.isFinite(followingId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }
    await query(`DELETE FROM follows WHERE follower_id = ? AND following_id = ?`, [
      req.user.id,
      followingId,
    ]);
    res.json({ ok: true, following: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to unfollow user", error: err.message });
  }
}

/** Public-ish: resolve default platform admin for “message support” deep links. */
async function getSupportAdminUser(req, res) {
  try {
    const rows = await query(
      `SELECT id, email, full_name, company_name, role
       FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1`
    );
    if (!rows.length) {
      return res.status(404).json({ message: "No admin user configured" });
    }
    const u = rows[0];
    res.json({
      id: u.id,
      email: u.email,
      fullName: u.full_name || "LebConnect Support",
      companyName: u.company_name || null,
      role: u.role,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to resolve admin user", error: err.message });
  }
}

async function getHomeStats(req, res) {
  try {
    const js = await query(`SELECT COUNT(*) AS c FROM users WHERE role = 'candidate'`);
    const cs = await query(`SELECT COUNT(*) AS c FROM users WHERE role = 'company'`);
    const jp = await query(`SELECT COUNT(*) AS c FROM jobs`);
    const decided = await query(
      `SELECT COUNT(*) AS c FROM applications WHERE status IN ('accepted','rejected')`
    );
    const accepted = await query(`SELECT COUNT(*) AS c FROM applications WHERE status = 'accepted'`);

    const d = Number(decided[0].c);
    const a = Number(accepted[0].c);
    const placementRate = d > 0 ? Math.round((a / d) * 100) : 94;

    res.json({
      jobSeekers: Number(js[0].c),
      companies: Number(cs[0].c),
      jobsPosted: Number(jp[0].c),
      placementRate,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load stats", error: err.message });
  }
}

module.exports = {
  getSupportAdminUser,
  getPublicProfile,
  updateMyProfile,
  listCompanies,
  listCandidates,
  getTopCompanies,
  getHomeStats,
  listMyFollowing,
  getFollowStatus,
  followUser,
  unfollowUser,
};
