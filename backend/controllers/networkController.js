const { query } = require("../config/db");
const { mapJobJoined } = require("../utils/mappers");
const {
  normalizeSpecialization,
  normalizeIndustry,
} = require("../utils/categoryNormalize");

const JOB_SELECT_JOIN = `
  SELECT j.*,
         u.id AS company_user_id,
         u.email AS company_email,
         u.company_name,
         u.industry AS company_industry,
         u.location AS company_location,
         u.logo AS company_logo,
         u.is_verified AS company_is_verified,
         u.normalized_industry AS company_normalized_industry
  FROM jobs j
  JOIN users u ON u.id = j.company_id
`;

/** Same-field discovery for dashboard widgets — bounded result sets */
async function getSameFieldNetwork(req, res) {
  try {
    const role = String(req.user.role || "").toLowerCase();

    let people = [];
    let companies = [];
    let jobs = [];
    let postsPreview = [];

    if (role === "candidate") {
      const bucket =
        req.user.normalizedSpecialization ||
        normalizeSpecialization(req.user.specialization || "");
      if (bucket) {
        const like = `%${bucket}%`;
        people = await query(
          `SELECT id, full_name, specialization, location, profile_image, normalized_specialization
           FROM users
           WHERE role = 'candidate'
             AND id <> ?
             AND (normalized_specialization = ? OR normalized_specialization LIKE ? OR specialization LIKE ?)
           ORDER BY created_at DESC
           LIMIT 12`,
          [req.user.id, bucket, like, `%${req.user.specialization || ""}%`]
        ).catch(() => []);

        companies = await query(
          `SELECT id, company_name, industry, location, logo, normalized_industry, is_verified
           FROM users
           WHERE role = 'company'
             AND (normalized_industry = ? OR industry LIKE ?)
           ORDER BY created_at DESC
           LIMIT 12`,
          [bucket, `%${bucket}%`]
        ).catch(() => []);

        const jobRows = await query(
          `${JOB_SELECT_JOIN}
           WHERE j.status = 'active'
             AND (
               j.title LIKE ?
               OR j.description LIKE ?
               OR EXISTS (
                 SELECT 1 FROM users uc
                 WHERE uc.id = j.company_id
                   AND (uc.normalized_industry = ? OR uc.industry LIKE ?)
               )
             )
           ORDER BY j.created_at DESC
           LIMIT 15`,
          [`%${bucket}%`, `%${bucket}%`, bucket, `%${bucket}%`]
        ).catch(() => []);
        jobs = jobRows.map(mapJobJoined);

        postsPreview = await query(
          `SELECT p.id
           FROM posts p
           JOIN users u ON u.id = p.author_id
           WHERE u.role = 'company'
             AND (u.normalized_industry = ? OR u.industry LIKE ?)
           ORDER BY p.created_at DESC
           LIMIT 6`,
          [bucket, `%${bucket}%`]
        ).catch(() => []);
      }
    } else if (role === "company") {
      const bucket =
        req.user.normalizedIndustry || normalizeIndustry(req.user.industry || "");
      if (bucket) {
        companies = await query(
          `SELECT id, company_name, industry, location, logo, is_verified
           FROM users
           WHERE role = 'company'
             AND id <> ?
             AND (normalized_industry = ? OR industry LIKE ?)
           ORDER BY created_at DESC
           LIMIT 12`,
          [req.user.id, bucket, `%${bucket}%`]
        ).catch(() => []);

        people = await query(
          `SELECT id, full_name, specialization, location, profile_image
           FROM users
           WHERE role = 'candidate'
             AND (
               normalized_specialization = ?
               OR specialization LIKE ?
             )
           ORDER BY created_at DESC
           LIMIT 12`,
          [bucket, `%${bucket}%`]
        ).catch(() => []);

        const jobRows = await query(
          `${JOB_SELECT_JOIN}
           WHERE j.status = 'active'
             AND j.company_id IN (
               SELECT id FROM users WHERE role = 'company' AND (normalized_industry = ? OR industry LIKE ?)
             )
           ORDER BY j.created_at DESC
           LIMIT 15`,
          [bucket, `%${bucket}%`]
        ).catch(() => []);
        jobs = jobRows.map(mapJobJoined);
      }
    }

    res.json({
      people: (people || []).map((r) => ({
        id: r.id,
        fullName: r.full_name,
        specialization: r.specialization,
        location: r.location,
        profileImage: r.profile_image,
      })),
      companies: (companies || []).map((r) => ({
        id: r.id,
        companyName: r.company_name,
        industry: r.industry,
        location: r.location,
        logo: r.logo,
        isVerified: Boolean(r.is_verified),
      })),
      jobs,
      postsInFieldCount: postsPreview?.length ?? 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Network load failed", error: err.message });
  }
}

module.exports = { getSameFieldNetwork };
