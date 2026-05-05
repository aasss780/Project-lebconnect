const { query } = require("../config/db");
const { createNotification } = require("../utils/notificationHelper");

async function listMine(req, res) {
  try {
    const rows = await query(
      `SELECT id, user_id, name, keyword, location, type, field, salary, sort, alert_enabled, created_at
       FROM saved_searches WHERE user_id = ? ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        keyword: r.keyword || "",
        location: r.location || "",
        type: r.type || "",
        field: r.field || "",
        salary: r.salary || "",
        sort: r.sort || "",
        alertEnabled: Boolean(r.alert_enabled),
        createdAt: r.created_at,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load saved searches", error: err.message });
  }
}

async function createSaved(req, res) {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ message: "name is required" });
    const keyword = String(req.body.keyword ?? "").trim().slice(0, 512);
    const location = String(req.body.location ?? "").trim().slice(0, 255);
    const type = String(req.body.type ?? "").trim().slice(0, 128);
    const field = String(req.body.field ?? "").trim().slice(0, 255);
    const salary = String(req.body.salary ?? "").trim().slice(0, 255);
    const sortRaw = String(req.body.sort ?? "").trim().toLowerCase();
    const sort = sortRaw === "bestmatch" || sortRaw === "best_match" ? "bestMatch" : sortRaw === "recent" ? "recent" : null;
    const alertEnabled = Boolean(req.body.alertEnabled ?? req.body.alert_enabled);

    const dup = await query(`SELECT id FROM saved_searches WHERE user_id = ? AND name = ? LIMIT 1`, [
      req.user.id,
      name,
    ]);
    if (dup.length) {
      return res.status(409).json({ message: "You already have a saved search with this name." });
    }

    const ins = await query(
      `INSERT INTO saved_searches (user_id, name, keyword, location, type, field, salary, sort, alert_enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        name,
        keyword || null,
        location || null,
        type || null,
        field || null,
        salary || null,
        sort || null,
        alertEnabled ? 1 : 0,
      ]
    );
    const rows = await query(`SELECT * FROM saved_searches WHERE id = ?`, [ins.insertId]);
    const r = rows[0];
    res.status(201).json({
      id: r.id,
      name: r.name,
      keyword: r.keyword || "",
      location: r.location || "",
      type: r.type || "",
      field: r.field || "",
      salary: r.salary || "",
      sort: r.sort || "",
      alertEnabled: Boolean(r.alert_enabled),
      createdAt: r.created_at,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to save search", error: err.message });
  }
}

async function deleteSaved(req, res) {
  try {
    const id = Number(req.params.id);
    const r = await query(`DELETE FROM saved_searches WHERE id = ? AND user_id = ?`, [
      id,
      req.user.id,
    ]);
    if (!r.affectedRows) return res.status(404).json({ message: "Not found" });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete", error: err.message });
  }
}

/**
 * @param {object} job — mapJobJoined shape
 */
async function notifyMatchingSavedSearches(job) {
  try {
    const rows = await query(`SELECT * FROM saved_searches WHERE COALESCE(alert_enabled, 0) = 1`, []);
    const title = (job.title || "").toLowerCase();
    const desc = (job.description || "").toLowerCase();
    const blob = `${title} ${desc}`;

    for (const s of rows) {
      const kw = String(s.keyword || "").trim().toLowerCase();
      if (kw && !blob.includes(kw)) continue;

      const loc = String(s.location || "").trim().toLowerCase();
      if (loc) {
        const jl = String(job.location || "").trim().toLowerCase();
        if (!jl.includes(loc)) continue;
      }

      const typ = String(s.type || "").trim().toLowerCase();
      if (typ) {
        const jt = String(job.type || "").trim().toLowerCase();
        if (!jt.includes(typ)) continue;
      }

      await createNotification(s.user_id, {
        title: "Job alert",
        message: `New job matches "${s.name}": ${job.title || "New role"}`,
        type: "job_alert",
      });
    }
  } catch (e) {
    console.warn("[notifyMatchingSavedSearches]", e.message || e);
  }
}

module.exports = {
  listMine,
  createSaved,
  deleteSaved,
  notifyMatchingSavedSearches,
};
