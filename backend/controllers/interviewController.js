const { query } = require("../config/db");
const { createNotification } = require("../utils/notificationHelper");
const { APP_JOIN } = require("./applicationController");

function combineScheduledAt(body) {
  let scheduledAt = String(body.scheduledAt ?? "").trim();
  const datePart = String(body.date ?? "").trim();
  const timePart = String(body.time ?? "").trim();
  if (!scheduledAt && datePart && timePart) {
    const t =
      timePart.length === 5
        ? `${timePart}:00`
        : timePart.length === 8
          ? timePart
          : `${timePart}:00`;
    scheduledAt = `${datePart} ${t}`;
  }
  return scheduledAt;
}

async function createInterview(req, res) {
  try {
    const applicationId = Number(req.body.applicationId);
    const scheduledAt = combineScheduledAt(req.body);
    const mode = ["online", "office"].includes(String(req.body.mode || "").toLowerCase())
      ? String(req.body.mode).toLowerCase()
      : "online";
    const locationOrLink = String(req.body.locationOrLink ?? "").trim() || null;
    const message = String(req.body.message ?? "").trim().slice(0, 2000) || null;

    if (!Number.isFinite(applicationId) || !scheduledAt) {
      return res.status(400).json({
        message: "applicationId and scheduled time are required (use scheduledAt or date + time).",
      });
    }

    const apps = await query(`${APP_JOIN} WHERE a.id = ?`, [applicationId]);
    const row = apps[0];
    if (!row) return res.status(404).json({ message: "Application not found" });
    if (row.company_id !== req.user.id) {
      return res.status(403).json({ message: "Only the employer can schedule" });
    }

    const ins = await query(
      `INSERT INTO interviews (application_id, candidate_id, company_id, job_id, scheduled_at, mode, location_or_link, message, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')`,
      [
        applicationId,
        row.candidate_id,
        row.company_id,
        row.job_id,
        scheduledAt,
        mode,
        locationOrLink,
        message,
      ]
    );

    await query(
      `UPDATE applications SET stage = 'interview', interview_date = ?, interview_mode = ?, interview_location = ?, viewed_at = COALESCE(viewed_at, NOW()), status = 'pending'
       WHERE id = ?`,
      [scheduledAt, mode, locationOrLink, applicationId]
    );

    const companyName = row.company_name || "A company";
    const jobTitle = row.job_title || "your role";

    try {
      await createNotification(row.candidate_id, {
        title: "Interview Scheduled",
        message: `${companyName} scheduled an interview for ${jobTitle}.`,
        type: "interview",
      });
    } catch {
      await createNotification(row.candidate_id, {
        title: "Interview Scheduled",
        message: `${companyName} scheduled an interview for ${jobTitle}`,
        type: "system",
      });
    }

    const intRows = await query(`SELECT * FROM interviews WHERE id = ?`, [ins.insertId]);
    res.status(201).json({ interview: mapInterviewRow(intRows[0], row) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to schedule interview", error: err.message });
  }
}

function mapInterviewRow(ir, appRow) {
  return {
    id: ir.id,
    applicationId: ir.application_id,
    candidateId: ir.candidate_id,
    companyId: ir.company_id,
    jobId: ir.job_id,
    scheduledAt: ir.scheduled_at,
    mode: ir.mode,
    locationOrLink: ir.location_or_link,
    message: ir.message,
    status: ir.status,
    createdAt: ir.created_at,
    jobTitle: appRow?.job_title,
    companyName: appRow?.company_name,
  };
}

async function listMyInterviews(req, res) {
  try {
    const rows = await query(
      `SELECT i.*, j.title AS job_title, u.company_name
       FROM interviews i
       JOIN jobs j ON j.id = i.job_id
       JOIN users u ON u.id = i.company_id
       WHERE i.candidate_id = ? AND i.status = 'scheduled'
       ORDER BY i.scheduled_at ASC`,
      [req.user.id]
    );
    res.json(
      rows.map((r) =>
        mapInterviewRow(r, { job_title: r.job_title, company_name: r.company_name })
      )
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load interviews", error: err.message });
  }
}

async function listCompanyInterviews(req, res) {
  try {
    const rows = await query(
      `SELECT i.*, j.title AS job_title, c.full_name AS candidate_name
       FROM interviews i
       JOIN jobs j ON j.id = i.job_id
       JOIN users c ON c.id = i.candidate_id
       WHERE i.company_id = ?
       ORDER BY i.scheduled_at DESC`,
      [req.user.id]
    );
    res.json(
      rows.map((r) => ({
        ...mapInterviewRow(r, { job_title: r.job_title }),
        candidateName: r.candidate_name,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load interviews", error: err.message });
  }
}

/** @returns {Promise<{ ok: true } | { error: { status: number, message: string } }>} */
async function runCandidateInterviewCancel(req, interviewId) {
  const id = Number(interviewId);
  if (!Number.isFinite(id)) {
    return { error: { status: 400, message: "Invalid interview id" } };
  }
  const rows = await query(
    `SELECT i.*, j.title AS job_title
     FROM interviews i
     JOIN jobs j ON j.id = i.job_id
     WHERE i.id = ?`,
    [id]
  );
  const ir = rows[0];
  if (!ir) return { error: { status: 404, message: "Not found" } };
  if (ir.candidate_id !== req.user.id) {
    return { error: { status: 403, message: "Forbidden" } };
  }
  if (String(ir.status).toLowerCase() !== "scheduled") {
    return {
      error: { status: 400, message: "Only scheduled interviews can be cancelled" },
    };
  }
  const when = ir.scheduled_at ? new Date(ir.scheduled_at) : null;
  if (
    when &&
    !Number.isNaN(when.getTime()) &&
    when.getTime() <= Date.now()
  ) {
    return { error: { status: 400, message: "Past interviews cannot be cancelled" } };
  }

  await query(`UPDATE interviews SET status = ? WHERE id = ?`, ["cancelled", id]);

  const candidateName =
    String(req.user.fullName || req.user.companyName || "Candidate").trim() ||
    "Candidate";
  const jobTitle = ir.job_title || "the role";
  const notifPayload = {
    title: "Interview Cancelled",
    message: `${candidateName} cancelled the interview for ${jobTitle}`,
    type: "interview",
  };

  try {
    await createNotification(ir.company_id, notifPayload);
  } catch {
    try {
      await createNotification(ir.company_id, { ...notifPayload, type: "system" });
    } catch {
      /* non-fatal */
    }
  }

  return { ok: true };
}

async function cancelInterviewByCandidate(req, res) {
  try {
    const r = await runCandidateInterviewCancel(req, req.params.id);
    if (r.error)
      return res.status(r.error.status).json({ message: r.error.message });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to cancel interview", error: err.message });
  }
}

async function updateInterviewStatus(req, res) {
  try {
    const role = String(req.user.role || "").toLowerCase();
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "Invalid interview id" });
    }
    const status = String(req.body.status || "").toLowerCase();
    if (!["scheduled", "cancelled", "completed"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const rows = await query(`SELECT * FROM interviews WHERE id = ?`, [id]);
    const ir = rows[0];
    if (!ir) return res.status(404).json({ message: "Not found" });

    if (role === "candidate") {
      if (status !== "cancelled") {
        return res.status(403).json({
          message: "You can only cancel interviews",
        });
      }
      const r = await runCandidateInterviewCancel(req, id);
      if (r.error)
        return res.status(r.error.status).json({ message: r.error.message });
      return res.json({ ok: true });
    }

    if (role === "company") {
      if (ir.company_id !== req.user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      await query(`UPDATE interviews SET status = ? WHERE id = ?`, [status, id]);
      await createNotification(ir.candidate_id, {
        title: "Interview update",
        message: `Your interview (ID ${id}) is now marked ${status}.`,
        type: "interview",
      }).catch(() => {});
      return res.json({ ok: true });
    }

    return res.status(403).json({ message: "Forbidden" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update", error: err.message });
  }
}

module.exports = {
  createInterview,
  listMyInterviews,
  listCompanyInterviews,
  cancelInterviewByCandidate,
  updateInterviewStatus,
};
