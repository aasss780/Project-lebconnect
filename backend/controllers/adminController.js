const { query } = require("../config/db");
const { createNotification } = require("../utils/notificationHelper");
const { USER_PUBLIC_COLUMNS } = require("../constants/userColumns");
const { mapUser, mapJobJoined } = require("../utils/mappers");
const { hydratePosts } = require("./postController");
const { mapApplication, APP_JOIN } = require("./applicationController");

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

const JOB_JOIN = `
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

async function getStats(req, res) {
  try {
    const allUsers = await query(`SELECT COUNT(*) AS c FROM users`);
    const c1 = await query(`SELECT COUNT(*) AS c FROM users WHERE role = 'candidate'`);
    const c2 = await query(`SELECT COUNT(*) AS c FROM users WHERE role = 'company'`);
    const ad = await query(`SELECT COUNT(*) AS c FROM users WHERE role = 'admin'`);
    const j = await query(`SELECT COUNT(*) AS c FROM jobs`);
    const ja = await query(`SELECT COUNT(*) AS c FROM jobs WHERE status = 'active'`);
    const app = await query(`SELECT COUNT(*) AS c FROM applications`);
    const co = await query(`SELECT COUNT(*) AS c FROM complaints WHERE status = 'open'`);
    const coAll = await query(`SELECT COUNT(*) AS c FROM complaints`);
    let postsCount = 0;
    try {
      const pc = await query(`SELECT COUNT(*) AS c FROM posts`);
      postsCount = Number(pc[0]?.c || 0);
    } catch {
      postsCount = 0;
    }

    res.json({
      totalUsers: Number(allUsers[0].c),
      candidates: Number(c1[0].c),
      companies: Number(c2[0].c),
      admins: Number(ad[0].c),
      jobs: Number(j[0].c),
      activeJobs: Number(ja[0].c),
      applications: Number(app[0].c),
      complaintsOpen: Number(co[0].c),
      complaintsTotal: Number(coAll[0].c),
      posts: postsCount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load stats", error: err.message });
  }
}

async function listUsers(req, res) {
  try {
    const rows = await query(
      `SELECT ${USER_PUBLIC_COLUMNS} FROM users ORDER BY created_at DESC`
    );
    res.json(rows.map(mapUser));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to list users", error: err.message });
  }
}

async function getAdminUserDetail(req, res) {
  try {
    const uid = Number(req.params.id);
    if (!Number.isFinite(uid)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const users = await query(
      `SELECT ${USER_PUBLIC_COLUMNS} FROM users WHERE id = ?`,
      [uid]
    );
    const user = users[0];
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const postRows = await query(
      `${POST_AUTHOR_JOIN} WHERE p.author_id = ? ORDER BY p.created_at DESC`,
      [uid]
    );
    const posts = await hydratePosts(postRows);
    const baseUser = {
      ...mapUser(user),
      posts,
    };

    if (user.role === "candidate") {
      const appRows = await query(`${APP_JOIN} WHERE a.candidate_id = ? ORDER BY a.created_at DESC`, [
        uid,
      ]);
      return res.json({
        profileType: "candidate",
        user: baseUser,
        applications: appRows.map((r) => mapApplication(r, { omitCvBody: true })),
      });
    }

    if (user.role === "company") {
      const jobRows = await query(`${JOB_JOIN} WHERE j.company_id = ? ORDER BY j.created_at DESC`, [
        uid,
      ]);
      return res.json({
        profileType: "company",
        user: baseUser,
        jobs: jobRows.map(mapJobJoined),
      });
    }

    return res.json({
      profileType: "admin",
      user: baseUser,
      applications: [],
      jobs: [],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load user", error: err.message });
  }
}

async function getAdminJobById(req, res) {
  try {
    const jid = Number(req.params.id);
    if (!Number.isFinite(jid)) {
      return res.status(400).json({ message: "Invalid job id" });
    }
    const rows = await query(`${JOB_JOIN} WHERE j.id = ?`, [jid]);
    if (!rows.length) {
      return res.status(404).json({ message: "Job not found" });
    }
    res.json(mapJobJoined(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load job", error: err.message });
  }
}

async function closeAdminJob(req, res) {
  try {
    const jid = Number(req.params.id);
    if (!Number.isFinite(jid)) {
      return res.status(400).json({ message: "Invalid job id" });
    }
    const result = await query(`UPDATE jobs SET status = 'closed' WHERE id = ?`, [jid]);
    if (!result.affectedRows) {
      return res.status(404).json({ message: "Job not found" });
    }
    const rows = await query(`${JOB_JOIN} WHERE j.id = ?`, [jid]);
    res.json({ message: "Job closed", job: mapJobJoined(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to close job", error: err.message });
  }
}

async function deleteUser(req, res) {
  try {
    const uid = Number(req.params.id);
    const users = await query(`SELECT id, role FROM users WHERE id = ?`, [uid]);
    const target = users[0];
    if (!target) {
      return res.status(404).json({ message: "User not found" });
    }
    if (target.role === "admin") {
      return res.status(403).json({ message: "Cannot delete admin accounts" });
    }

    await query(`DELETE FROM users WHERE id = ?`, [uid]);
    res.json({ message: "User deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete user", error: err.message });
  }
}

async function listAllJobs(req, res) {
  try {
    const rows = await query(`${JOB_JOIN} ORDER BY j.created_at DESC`);
    res.json(rows.map(mapJobJoined));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to list jobs", error: err.message });
  }
}

async function deleteJob(req, res) {
  try {
    const jid = Number(req.params.id);
    const result = await query(`DELETE FROM jobs WHERE id = ?`, [jid]);
    if (!result.affectedRows) {
      return res.status(404).json({ message: "Job not found" });
    }
    res.json({ message: "Job deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete job", error: err.message });
  }
}

const COMPLAINT_JOIN = `
  SELECT c.*,
         u.full_name AS u_full_name,
         u.company_name AS u_company_name,
         u.email AS u_email,
         u.role AS u_role,
         a.full_name AS a_full_name,
         a.company_name AS a_company_name,
         a.email AS a_email,
         a.role AS a_role
  FROM complaints c
  JOIN users u ON u.id = c.user_id
  LEFT JOIN users a ON a.id = c.against_user_id
`;

function mapComplaint(row) {
  return {
    _id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    user: {
      fullName: row.u_full_name,
      companyName: row.u_company_name,
      email: row.u_email,
      role: row.u_role,
    },
    against: row.against_user_id
      ? {
          fullName: row.a_full_name,
          companyName: row.a_company_name,
          email: row.a_email,
          role: row.a_role,
        }
      : null,
  };
}

async function listAdminComplaints(req, res) {
  try {
    const rows = await query(`${COMPLAINT_JOIN} ORDER BY c.created_at DESC`);
    res.json(rows.map(mapComplaint));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to list complaints", error: err.message });
  }
}

async function updateAdminComplaintStatus(req, res) {
  try {
    const { status } = req.body;
    if (!["open", "reviewing", "resolved"].includes(status)) {
      return res.status(400).json({
        message: "status must be open, reviewing, or resolved",
      });
    }

    const cid = Number(req.params.id);
    const result = await query(`UPDATE complaints SET status = ? WHERE id = ?`, [status, cid]);
    if (!result.affectedRows) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    const rows = await query(`${COMPLAINT_JOIN} WHERE c.id = ?`, [cid]);
    res.json({ message: "Complaint updated", complaint: mapComplaint(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update complaint", error: err.message });
  }
}

async function verifyUser(req, res) {
  try {
    const uid = Number(req.params.id);
    const rows = await query(`SELECT id, role, company_name, full_name FROM users WHERE id = ?`, [
      uid,
    ]);
    if (!rows[0]) return res.status(404).json({ message: "User not found" });
    await query(`UPDATE users SET is_verified = 1 WHERE id = ?`, [uid]);
    try {
      await createNotification(uid, {
        title: "Account verified",
        message: "Your LebConnect profile now shows a verified badge.",
        type: "verification",
      });
    } catch {
      await createNotification(uid, {
        title: "Account verified",
        message: "Your LebConnect profile now shows a verified badge.",
        type: "system",
      });
    }
    res.json({ message: "User verified", id: uid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to verify user", error: err.message });
  }
}

async function unverifyUser(req, res) {
  try {
    const uid = Number(req.params.id);
    const result = await query(`UPDATE users SET is_verified = 0 WHERE id = ?`, [uid]);
    if (!result.affectedRows) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Verification removed", id: uid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to unverify", error: err.message });
  }
}

const REPORT_JOIN = `
  SELECT r.*,
         u.full_name AS rep_full_name,
         u.company_name AS rep_company_name,
         u.email AS rep_email,
         u.role AS rep_role
  FROM reports r
  JOIN users u ON u.id = r.reporter_id
`;

function mapReport(row) {
  return {
    id: row.id,
    targetType: row.target_type,
    targetId: row.target_id,
    reason: row.reason,
    status: row.status,
    createdAt: row.created_at,
    reporter: {
      fullName: row.rep_full_name,
      companyName: row.rep_company_name,
      email: row.rep_email,
      role: row.rep_role,
    },
  };
}

async function listReports(req, res) {
  try {
    const rows = await query(`${REPORT_JOIN} ORDER BY r.created_at DESC`);
    res.json(rows.map(mapReport));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to list reports", error: err.message });
  }
}

async function updateReportStatus(req, res) {
  try {
    const status = String(req.body.status || "");
    if (!["open", "reviewing", "resolved"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    const rid = Number(req.params.id);
    const result = await query(`UPDATE reports SET status = ? WHERE id = ?`, [status, rid]);
    if (!result.affectedRows) return res.status(404).json({ message: "Not found" });
    const rows = await query(`${REPORT_JOIN} WHERE r.id = ?`, [rid]);
    const r = rows[0];
    if (status === "resolved" && r) {
      try {
        await createNotification(r.reporter_id, {
          title: "Report resolved",
          message: "Moderators reviewed your report — thank you for helping keep LebConnect safe.",
          type: "report",
        });
      } catch {
        await createNotification(r.reporter_id, {
          title: "Report resolved",
          message: "Moderators reviewed your report.",
          type: "system",
        });
      }
    }
    res.json({ report: mapReport(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update report", error: err.message });
  }
}

const COMPANY_REVIEW_JOIN = `
  SELECT r.*,
         c.company_name,
         u.full_name AS author_name,
         u.email AS author_email
  FROM company_reviews r
  JOIN users c ON c.id = r.company_id
  JOIN users u ON u.id = r.user_id
`;

async function listCompanyReviewsAdmin(req, res) {
  try {
    const rows = await query(`${COMPANY_REVIEW_JOIN} ORDER BY r.created_at DESC`);
    res.json(
      rows.map((row) => ({
        id: row.id,
        companyId: row.company_id,
        companyName: row.company_name,
        userId: row.user_id,
        authorName: row.author_name,
        authorEmail: row.author_email,
        rating: row.rating,
        title: row.title,
        comment: row.comment,
        interviewExperience: row.interview_experience,
        status: row.status,
        createdAt: row.created_at,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to list company reviews", error: err.message });
  }
}

async function updateCompanyReviewStatus(req, res) {
  try {
    const status = String(req.body.status || "").toLowerCase();
    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    const id = Number(req.params.id);
    const result = await query(`UPDATE company_reviews SET status = ? WHERE id = ?`, [status, id]);
    if (!result.affectedRows) return res.status(404).json({ message: "Not found" });
    const rows = await query(
      `${COMPANY_REVIEW_JOIN} WHERE r.id = ?`,
      [id]
    );
    const row = rows[0];
    if (row && (status === "approved" || status === "rejected")) {
      const msg =
        status === "approved"
          ? `Your review of ${row.company_name} was approved and is live.`
          : `Your review of ${row.company_name} did not meet guidelines.`;
      try {
        await createNotification(row.user_id, {
          title: status === "approved" ? "Review published" : "Review rejected",
          message: msg,
          type: "system",
        });
      } catch {
        /* ignore */
      }
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update review", error: err.message });
  }
}

async function listSiteReviewsAdmin(_req, res) {
  try {
    const rows = await query(
      `SELECT id, user_id, name, rating, comment, created_at
       FROM site_reviews
       ORDER BY created_at DESC`
    );
    res.json(
      rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        name: row.name,
        rating: Number(row.rating),
        comment: row.comment,
        createdAt: row.created_at,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to list site reviews", error: err.message });
  }
}

async function deleteSiteReviewAdmin(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "Invalid review id" });
    }
    const result = await query(`DELETE FROM site_reviews WHERE id = ?`, [id]);
    if (!result.affectedRows) {
      return res.status(404).json({ message: "Site review not found" });
    }
    res.json({ message: "Site review deleted", id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete site review", error: err.message });
  }
}

module.exports = {
  getStats,
  listUsers,
  getAdminUserDetail,
  deleteUser,
  listAllJobs,
  getAdminJobById,
  closeAdminJob,
  deleteJob,
  listAdminComplaints,
  updateAdminComplaintStatus,
  verifyUser,
  unverifyUser,
  listReports,
  updateReportStatus,
  listCompanyReviewsAdmin,
  updateCompanyReviewStatus,
  listSiteReviewsAdmin,
  deleteSiteReviewAdmin,
};
