const { query } = require("../config/db");

async function createReport(req, res) {
  try {
    const targetType = String(req.body.targetType || "").toLowerCase();
    const targetId = Number(req.body.targetId);
    const reason = String(req.body.reason || "").trim();
    if (!["post", "user", "job", "company"].includes(targetType)) {
      return res.status(400).json({ message: "targetType must be post, user, job, or company" });
    }
    if (!Number.isFinite(targetId) || !reason) {
      return res.status(400).json({ message: "targetId and reason required" });
    }

    const ins = await query(
      `INSERT INTO reports (reporter_id, target_type, target_id, reason, status)
       VALUES (?, ?, ?, ?, 'open')`,
      [req.user.id, targetType, targetId, reason.slice(0, 8000)]
    );
    res.status(201).json({ id: ins.insertId, message: "Report submitted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to submit report", error: err.message });
  }
}

module.exports = { createReport };
