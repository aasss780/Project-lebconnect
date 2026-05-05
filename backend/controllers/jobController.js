const { query } = require("../config/db");
const { mapJobJoined } = require("../utils/mappers");
const { normalizeIndustry } = require("../utils/categoryNormalize");
const { industryDisplayLooksValid } = require("../utils/categoryValidation");
const {
  notifyMatchingSavedSearches,
} = require("./savedSearchController");

const { calculateJobMatch } = require("../utils/calculateJobMatch");

function mapJobJoinedWithViewer(req, row) {
  const job = mapJobJoined(row);
  if (!job) return job;
  if (req.user && String(req.user.role || "").toLowerCase() === "candidate") {
    try {
      return { ...job, candidateMatch: calculateJobMatch(req.user, job) };
    } catch (err) {
      console.error("[mapJobJoinedWithViewer]", err);
      return job;
    }
  }
  return job;
}

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

async function createJob(req, res) {
  try {
    const { title, description, location, type, salary, requirements } = req.body;
    if (!title || !description) {
      return res.status(400).json({ message: "title and description are required" });
    }

    const companyRows = await query(`SELECT industry FROM users WHERE id = ?`, [
      req.user.id,
    ]);
    const profileIndustry = companyRows[0]?.industry;
    if (!industryDisplayLooksValid(profileIndustry)) {
      return res.status(400).json({
        message:
          "Set a valid industry on your company profile (including a detailed value if you choose Other) before posting jobs.",
      });
    }

    const reqJson = JSON.stringify(Array.isArray(requirements) ? requirements : []);
    const result = await query(
      `INSERT INTO jobs (company_id, title, description, location, type, salary, requirements, status, applicants_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 0)`,
      [
        req.user.id,
        title,
        description,
        location || "",
        type || "",
        salary || "",
        reqJson,
      ]
    );

    const rows = await query(`${JOB_SELECT_JOIN} WHERE j.id = ?`, [result.insertId]);
    const mapped = mapJobJoined(rows[0]);
    await notifyMatchingSavedSearches(mapped);

    const uRows = await query(`SELECT industry FROM users WHERE id = ?`, [req.user.id]);
    const bucket = normalizeIndustry(uRows[0]?.industry);
    await query(`UPDATE users SET normalized_industry = ? WHERE id = ?`, [
      bucket || null,
      req.user.id,
    ]);

    res.status(201).json({ message: "Job created", job: mapped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create job", error: err.message });
  }
}

async function listMyJobs(req, res) {
  try {
    const rows = await query(
      `${JOB_SELECT_JOIN} WHERE j.company_id = ? ORDER BY j.created_at DESC`,
      [req.user.id]
    );
    res.json(rows.map(mapJobJoined));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to list your jobs", error: err.message });
  }
}

async function listJobs(req, res) {
  try {
    const {
      keyword,
      location,
      type,
      company,
      status,
      limit,
      skip,
      sort,
    } = req.query;

    const params = [];
    let sql = JOB_SELECT_JOIN + ` WHERE 1=1`;

    if (status) {
      sql += ` AND j.status = ?`;
      params.push(status);
    } else {
      sql += ` AND j.status = 'active'`;
    }

    if (keyword) {
      sql += ` AND (j.title LIKE ? OR j.description LIKE ?)`;
      const k = `%${keyword}%`;
      params.push(k, k);
    }

    if (location) {
      sql += ` AND j.location LIKE ?`;
      params.push(`%${location}%`);
    }

    if (type) {
      sql += ` AND j.type LIKE ?`;
      params.push(`%${type}%`);
    }

    if (company) {
      const cid = Number(company);
      const companyParams = [];
      let clause = `(u.company_name LIKE ?`;
      companyParams.push(`%${company}%`);
      if (Number.isFinite(cid)) {
        clause += ` OR j.company_id = ?`;
        companyParams.push(cid);
      }
      clause += `)`;
      sql += ` AND ${clause}`;
      params.push(...companyParams);
    }

    sql += sort === "oldest" ? ` ORDER BY j.created_at ASC` : ` ORDER BY j.created_at DESC`;

    const lim = Math.min(Number(limit) || 100, 200);
    const sk = Number(skip) || 0;
    sql += ` LIMIT ${lim} OFFSET ${sk}`;

    const rows = await query(sql, params);
    res.json(rows.map((r) => mapJobJoinedWithViewer(req, r)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to list jobs", error: err.message });
  }
}

async function getLatestJobs(req, res) {
  try {
    const limit = Math.min(Number(req.query.limit) || 12, 50);
    const rows = await query(
      `${JOB_SELECT_JOIN}
       WHERE j.status = 'active'
       ORDER BY j.created_at DESC
       LIMIT ${limit}`
    );
    res.json(rows.map((r) => mapJobJoinedWithViewer(req, r)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load jobs", error: err.message });
  }
}

async function getJobById(req, res) {
  try {
    const jid = Number(req.params.id);
    const rows = await query(`${JOB_SELECT_JOIN} WHERE j.id = ?`, [jid]);
    if (!rows.length) {
      return res.status(404).json({ message: "Job not found" });
    }
    res.json(mapJobJoinedWithViewer(req, rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load job", error: err.message });
  }
}

async function updateJob(req, res) {
  try {
    const jid = Number(req.params.id);
    const jobs = await query(`SELECT * FROM jobs WHERE id = ?`, [jid]);
    const job = jobs[0];
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }
    if (job.company_id !== req.user.id) {
      return res.status(403).json({ message: "You can only edit your own jobs" });
    }

    const allowed = ["title", "description", "location", "type", "salary", "requirements"];
    const updates = [];
    const vals = [];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        if (key === "requirements") {
          updates.push("requirements = ?");
          vals.push(JSON.stringify(Array.isArray(req.body[key]) ? req.body[key] : []));
        } else {
          updates.push(`${key} = ?`);
          vals.push(req.body[key]);
        }
      }
    }

    if (updates.length) {
      vals.push(jid);
      await query(`UPDATE jobs SET ${updates.join(", ")} WHERE id = ?`, vals);
    }

    const rows = await query(`${JOB_SELECT_JOIN} WHERE j.id = ?`, [jid]);
    const uRows = await query(`SELECT industry FROM users WHERE id = ?`, [req.user.id]);
    const bucket = normalizeIndustry(uRows[0]?.industry);
    await query(`UPDATE users SET normalized_industry = ? WHERE id = ?`, [
      bucket || null,
      req.user.id,
    ]);

    res.json({ message: "Job updated", job: mapJobJoined(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update job", error: err.message });
  }
}

async function deleteJob(req, res) {
  try {
    const jid = Number(req.params.id);
    const jobs = await query(`SELECT * FROM jobs WHERE id = ?`, [jid]);
    const job = jobs[0];
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }
    if (job.company_id !== req.user.id) {
      return res.status(403).json({ message: "You can only delete your own jobs" });
    }

    const linkedPosts = await query(`SELECT id FROM posts WHERE job_id = ?`, [jid]);
    const postIds = linkedPosts.map((p) => Number(p.id)).filter(Number.isFinite);
    if (postIds.length) {
      const ph = postIds.map(() => "?").join(",");
      await query(`DELETE FROM comments WHERE post_id IN (${ph})`, postIds);
      await query(`DELETE FROM post_likes WHERE post_id IN (${ph})`, postIds);
      await query(
        `DELETE FROM reports WHERE target_type = 'post' AND target_id IN (${ph})`,
        postIds
      );
      await query(`DELETE FROM posts WHERE id IN (${ph})`, postIds);
    }

    await query(`DELETE FROM jobs WHERE id = ?`, [jid]);
    res.json({ message: "Job and related posts deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete job", error: err.message });
  }
}

async function closeJob(req, res) {
  try {
    const jid = Number(req.params.id);
    const jobs = await query(`SELECT * FROM jobs WHERE id = ?`, [jid]);
    const job = jobs[0];
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }
    if (job.company_id !== req.user.id) {
      return res.status(403).json({ message: "You can only close your own jobs" });
    }

    await query(`UPDATE jobs SET status = 'closed' WHERE id = ?`, [jid]);
    const rows = await query(`${JOB_SELECT_JOIN} WHERE j.id = ?`, [jid]);
    res.json({ message: "Job closed", job: mapJobJoined(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to close job", error: err.message });
  }
}

async function saveJob(req, res) {
  try {
    const jid = Number(req.params.id);
    const jobs = await query(`SELECT id FROM jobs WHERE id = ?`, [jid]);
    if (!jobs.length) {
      return res.status(404).json({ message: "Job not found" });
    }

    await query(
      `INSERT IGNORE INTO saved_jobs (user_id, job_id) VALUES (?, ?)`,
      [req.user.id, jid]
    );
    res.json({ message: "Job saved" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to save job", error: err.message });
  }
}

async function unsaveJob(req, res) {
  try {
    const jid = Number(req.params.id);
    await query(`DELETE FROM saved_jobs WHERE user_id = ? AND job_id = ?`, [
      req.user.id,
      jid,
    ]);
    res.json({ message: "Job removed from saved" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to unsave job", error: err.message });
  }
}

async function getMySavedJobs(req, res) {
  try {
    const rows = await query(
      `${JOB_SELECT_JOIN}
       INNER JOIN saved_jobs sj ON sj.job_id = j.id AND sj.user_id = ?
       ORDER BY sj.created_at DESC`,
      [req.user.id]
    );
    res.json(rows.map((r) => mapJobJoinedWithViewer(req, r)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load saved jobs", error: err.message });
  }
}

module.exports = {
  createJob,
  listJobs,
  listMyJobs,
  getLatestJobs,
  getJobById,
  updateJob,
  deleteJob,
  closeJob,
  saveJob,
  unsaveJob,
  getMySavedJobs,
};
