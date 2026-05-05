const { query } = require("../config/db");
const { createNotification } = require("../utils/notificationHelper");

const MAX_CV_BYTES = 25 * 1024 * 1024;

const APP_JOIN = `
  SELECT a.*,
         cand.full_name AS candidate_full_name,
         cand.email AS candidate_email,
         cand.specialization AS candidate_specialization,
         cand.profile_image AS candidate_profile_image,
         cand.location AS candidate_location,
         j.title AS job_title,
         j.location AS job_location,
         j.type AS job_type,
         j.status AS job_status,
         j.salary AS job_salary,
         comp.company_name AS company_name,
         comp.logo AS company_logo,
         comp.email AS company_email,
         comp.industry AS company_industry
  FROM applications a
  JOIN users cand ON cand.id = a.candidate_id
  JOIN jobs j ON j.id = a.job_id
  JOIN users comp ON comp.id = a.company_id
`;

function mapApplication(row, options = {}) {
  const omitCvBody = Boolean(options.omitCvBody);
  return {
    _id: row.id,
    id: row.id,
    status: row.status,
    stage: row.stage || "applied",
    viewedAt: row.viewed_at || null,
    interviewDate: row.interview_date || null,
    interviewLocation: row.interview_location || null,
    interviewMode: row.interview_mode || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    message: row.message || "",
    cvFileName: row.cv_file_name || null,
    cv: omitCvBody ? null : row.cv || null,
    candidate: {
      _id: row.candidate_id,
      id: row.candidate_id,
      fullName: row.candidate_full_name,
      email: row.candidate_email,
      specialization: row.candidate_specialization,
      profileImage: row.candidate_profile_image,
      location: row.candidate_location,
    },
    job: {
      _id: row.job_id,
      title: row.job_title,
      location: row.job_location,
      type: row.job_type,
      status: row.job_status,
      salary: row.job_salary,
    },
    company: {
      _id: row.company_id,
      companyName: row.company_name,
      logo: row.company_logo,
      email: row.company_email,
      industry: row.company_industry,
    },
  };
}

async function fetchApplicationById(id) {
  const rows = await query(`${APP_JOIN} WHERE a.id = ?`, [id]);
  return rows[0];
}

async function applyToJob(req, res) {
  try {
    const jobIdNum = Number(req.body.jobId);
    if (!req.body.jobId || !Number.isFinite(jobIdNum)) {
      return res.status(400).json({ message: "jobId is required" });
    }

    const cvRaw = req.body.cv;
    const cv = typeof cvRaw === "string" ? cvRaw.trim() : "";
    if (!cv) {
      return res.status(400).json({ message: "CV is required — upload your file." });
    }
    const cvBytes = Buffer.byteLength(cv, "utf8");
    if (cvBytes > MAX_CV_BYTES) {
      return res.status(413).json({
        message: `CV is too large (${Math.round(cvBytes / (1024 * 1024))} MB). Maximum is 25 MB.`,
      });
    }

    const cvFileName =
      typeof req.body.cvFileName === "string" && req.body.cvFileName.trim()
        ? req.body.cvFileName.trim().slice(0, 255)
        : null;
    const message =
      typeof req.body.message === "string"
        ? req.body.message.trim().slice(0, 8000)
        : "";

    const jobs = await query(`SELECT * FROM jobs WHERE id = ?`, [jobIdNum]);
    const job = jobs[0];
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }
    if (job.status !== "active") {
      return res.status(400).json({ message: "This job is not accepting applications" });
    }

    try {
      const ins = await query(
        `INSERT INTO applications (candidate_id, job_id, company_id, status, stage, cv, cv_file_name, message)
         VALUES (?, ?, ?, 'pending', 'applied', ?, ?, ?)`,
        [req.user.id, jobIdNum, job.company_id, cv, cvFileName, message || null]
      );

      await query(
        `UPDATE jobs SET applicants_count = applicants_count + 1 WHERE id = ?`,
        [jobIdNum]
      );

      const populated = await fetchApplicationById(ins.insertId);

      await createNotification(job.company_id, {
        title: "New application",
        message: `${req.user.fullName || "A candidate"} applied for ${job.title}`,
        type: "application",
      });

      res.status(201).json({
        message: "Application submitted",
        application: mapApplication(populated),
      });
    } catch (e) {
      if (e.errno === 1062 || e.code === "ER_DUP_ENTRY") {
        return res.status(400).json({ message: "You have already applied to this job" });
      }
      throw e;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to apply", error: err.message });
  }
}

async function listMyApplications(req, res) {
  try {
    const rows = await query(`${APP_JOIN} WHERE a.candidate_id = ? ORDER BY a.created_at DESC`, [
      req.user.id,
    ]);
    res.json(rows.map((r) => mapApplication(r, { omitCvBody: true })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load applications", error: err.message });
  }
}

/** Candidate-only: one application with CV body (for “View CV” on dashboard). */
async function getMyApplicationById(req, res) {
  try {
    const aid = Number(req.params.id);
    if (!Number.isFinite(aid)) {
      return res.status(400).json({ message: "Invalid application id" });
    }
    const rows = await query(`${APP_JOIN} WHERE a.id = ? AND a.candidate_id = ?`, [
      aid,
      req.user.id,
    ]);
    if (!rows.length) {
      return res.status(404).json({ message: "Application not found" });
    }
    res.json(mapApplication(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load application", error: err.message });
  }
}

async function listApplicationsForJob(req, res) {
  try {
    const jid = Number(req.params.jobId);
    const jobs = await query(`SELECT company_id FROM jobs WHERE id = ?`, [jid]);
    if (!jobs.length) {
      return res.status(404).json({ message: "Job not found" });
    }
    if (jobs[0].company_id !== req.user.id) {
      return res.status(403).json({ message: "You can only view applicants for your jobs" });
    }

    const rows = await query(`${APP_JOIN} WHERE a.job_id = ? ORDER BY a.created_at DESC`, [
      jid,
    ]);
    res.json(rows.map(mapApplication));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load applicants", error: err.message });
  }
}

async function updateApplicationStatus(req, res) {
  try {
    const { status } = req.body;
    if (!["accepted", "rejected", "pending"].includes(status)) {
      return res.status(400).json({
        message: "status must be pending, accepted, or rejected",
      });
    }

    const aid = Number(req.params.id);
    const apps = await query(`${APP_JOIN} WHERE a.id = ?`, [aid]);
    const row = apps[0];
    if (!row) {
      return res.status(404).json({ message: "Application not found" });
    }

    if (row.company_id !== req.user.id) {
      return res.status(403).json({ message: "Only the employer can update status" });
    }

    const stageOut = status === "accepted" ? "accepted" : status === "rejected" ? "rejected" : "applied";
    await query(`UPDATE applications SET status = ?, stage = ? WHERE id = ?`, [
      status,
      stageOut,
      aid,
    ]);

    if (status === "accepted" || status === "rejected") {
      const msg =
        status === "accepted"
          ? `Your application for "${row.job_title}" was accepted.`
          : `Your application for "${row.job_title}" was rejected.`;

      await createNotification(row.candidate_id, {
        title: status === "accepted" ? "Application accepted" : "Application rejected",
        message: msg,
        type: "application",
      });
    }

    const updated = await fetchApplicationById(aid);
    res.json({ message: "Application status updated", application: mapApplication(updated) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update application", error: err.message });
  }
}

const STAGES = [
  "applied",
  "viewed",
  "shortlisted",
  "interview",
  "accepted",
  "rejected",
];

async function markApplicationViewed(req, res) {
  try {
    const aid = Number(req.params.id);
    const apps = await query(`${APP_JOIN} WHERE a.id = ?`, [aid]);
    const row = apps[0];
    if (!row) return res.status(404).json({ message: "Application not found" });
    if (row.company_id !== req.user.id) {
      return res.status(403).json({ message: "Only the employer can mark viewed" });
    }
    const nextStage =
      !row.stage || row.stage === "applied" ? "viewed" : row.stage;
    const firstView = !row.viewed_at;
    await query(
      `UPDATE applications SET viewed_at = COALESCE(viewed_at, NOW()), stage = ? WHERE id = ?`,
      [nextStage, aid]
    );
    const updated = await fetchApplicationById(aid);
    if (firstView) {
      await createNotification(row.candidate_id, {
        title: "Application viewed",
        message: `Your application for "${row.job_title}" was opened by the company.`,
        type: "application",
      });
    }
    res.json({ application: mapApplication(updated, { omitCvBody: true }) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update application", error: err.message });
  }
}

async function updateApplicationStage(req, res) {
  try {
    const stageRaw = String(req.body.stage || "").toLowerCase().trim();
    if (!STAGES.includes(stageRaw)) {
      return res.status(400).json({
        message: `stage must be one of: ${STAGES.join(", ")}`,
      });
    }

    const aid = Number(req.params.id);
    const apps = await query(`${APP_JOIN} WHERE a.id = ?`, [aid]);
    const row = apps[0];
    if (!row) return res.status(404).json({ message: "Application not found" });
    if (row.company_id !== req.user.id) {
      return res.status(403).json({ message: "Only the employer can update stage" });
    }

    let status = row.status;
    if (stageRaw === "accepted") status = "accepted";
    else if (stageRaw === "rejected") status = "rejected";
    else status = "pending";

    let sql = `UPDATE applications SET stage = ?, status = ?`;
    const vals = [stageRaw, status];
    if (stageRaw !== "applied") {
      sql += `, viewed_at = COALESCE(viewed_at, NOW())`;
    }
    sql += ` WHERE id = ?`;
    vals.push(aid);
    await query(sql, vals);

    const labels = {
      viewed: "Viewed",
      shortlisted: "Shortlisted",
      interview: "Interview",
      accepted: "Accepted",
      rejected: "Rejected",
    };
    if (labels[stageRaw]) {
      await createNotification(row.candidate_id, {
        title: "Application update",
        message: `Your application for "${row.job_title}" is now: ${labels[stageRaw]}.`,
        type: "application",
      });
    }

    const updated = await fetchApplicationById(aid);
    res.json({ application: mapApplication(updated) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update stage", error: err.message });
  }
}

module.exports = {
  applyToJob,
  listMyApplications,
  getMyApplicationById,
  listApplicationsForJob,
  updateApplicationStatus,
  markApplicationViewed,
  updateApplicationStage,
  mapApplication,
  APP_JOIN,
};
