const { query } = require("../config/db");
const { sqlTextCell } = require("../utils/mappers");

function mapProject(row) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description || "",
    link: row.link || "",
    image: sqlTextCell(row.image),
    technologies: row.technologies || "",
    createdAt: row.created_at,
  };
}

async function listByUser(req, res) {
  try {
    const uid = Number(req.params.userId);
    const rows = await query(
      `SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC`,
      [uid]
    );
    res.json(rows.map(mapProject));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load projects", error: err.message });
  }
}

async function createProject(req, res) {
  try {
    const title = String(req.body.title || "").trim();
    if (!title) return res.status(400).json({ message: "title required" });
    const description = String(req.body.description ?? "").trim().slice(0, 16000);
    const link = String(req.body.link ?? "").trim().slice(0, 1024);
    const technologies = String(req.body.technologies ?? "").trim().slice(0, 2000);
    const image =
      typeof req.body.image === "string" && req.body.image.trim()
        ? req.body.image.trim().slice(0, 16000000)
        : null;

    const ins = await query(
      `INSERT INTO projects (user_id, title, description, link, technologies, image)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        title,
        description || null,
        link || null,
        technologies || null,
        image,
      ]
    );
    const rows = await query(`SELECT * FROM projects WHERE id = ?`, [ins.insertId]);
    res.status(201).json(mapProject(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create project", error: err.message });
  }
}

async function updateProject(req, res) {
  try {
    const id = Number(req.params.id);
    const rows = await query(`SELECT * FROM projects WHERE id = ?`, [id]);
    const prev = rows[0];
    if (!prev) return res.status(404).json({ message: "Not found" });
    if (prev.user_id !== req.user.id) return res.status(403).json({ message: "Forbidden" });

    const fields = [];
    const vals = [];
    const set = (col, val) => {
      fields.push(`${col} = ?`);
      vals.push(val);
    };

    if (req.body.title !== undefined) set("title", String(req.body.title).trim().slice(0, 255));
    if (req.body.description !== undefined)
      set("description", String(req.body.description ?? "").trim().slice(0, 16000) || null);
    if (req.body.link !== undefined)
      set("link", String(req.body.link ?? "").trim().slice(0, 1024) || null);
    if (req.body.technologies !== undefined)
      set("technologies", String(req.body.technologies ?? "").trim().slice(0, 2000) || null);
    if (req.body.image !== undefined) {
      const im =
        typeof req.body.image === "string" && req.body.image.trim()
          ? req.body.image.trim().slice(0, 16000000)
          : null;
      set("image", im);
    }

    if (!fields.length) return res.status(400).json({ message: "No updates" });
    vals.push(id);
    await query(`UPDATE projects SET ${fields.join(", ")} WHERE id = ?`, vals);
    const out = await query(`SELECT * FROM projects WHERE id = ?`, [id]);
    res.json(mapProject(out[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update", error: err.message });
  }
}

async function deleteProject(req, res) {
  try {
    const id = Number(req.params.id);
    const r = await query(`DELETE FROM projects WHERE id = ? AND user_id = ?`, [
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

module.exports = {
  listByUser,
  createProject,
  updateProject,
  deleteProject,
  mapProject,
};
