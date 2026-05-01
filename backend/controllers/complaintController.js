const { query } = require("../config/db");

const JOIN = `
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
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    user: {
      _id: row.user_id,
      fullName: row.u_full_name,
      companyName: row.u_company_name,
      email: row.u_email,
      role: row.u_role,
    },
    against: row.against_user_id
      ? {
          _id: row.against_user_id,
          fullName: row.a_full_name,
          companyName: row.a_company_name,
          email: row.a_email,
          role: row.a_role,
        }
      : null,
  };
}

async function createComplaint(req, res) {
  try {
    const { title, description, against } = req.body;
    if (!title || !description) {
      return res.status(400).json({ message: "title and description are required" });
    }

    let againstVal = null;
    if (against !== undefined && against !== null && String(against).trim() !== "") {
      const n = Number(against);
      if (!Number.isFinite(n)) {
        return res.status(400).json({ message: "Invalid against user id" });
      }
      againstVal = n;
    }

    const ins = await query(
      `INSERT INTO complaints (user_id, against_user_id, title, description, status)
       VALUES (?, ?, ?, ?, 'open')`,
      [req.user.id, againstVal, title, description]
    );

    const rows = await query(`${JOIN} WHERE c.id = ?`, [ins.insertId]);
    res.status(201).json({ message: "Complaint submitted", complaint: mapComplaint(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to submit complaint", error: err.message });
  }
}

async function listComplaints(req, res) {
  try {
    let rows;
    if (req.user.role === "admin") {
      rows = await query(`${JOIN} ORDER BY c.created_at DESC`);
    } else {
      rows = await query(`${JOIN} WHERE c.user_id = ? ORDER BY c.created_at DESC`, [
        req.user.id,
      ]);
    }
    res.json(rows.map(mapComplaint));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load complaints", error: err.message });
  }
}

async function updateComplaintStatus(req, res) {
  try {
    const { status } = req.body;
    if (!["open", "reviewing", "resolved"].includes(status)) {
      return res.status(400).json({
        message: "status must be open, reviewing, or resolved",
      });
    }
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admins can update complaint status" });
    }

    const cid = Number(req.params.id);
    const result = await query(`UPDATE complaints SET status = ? WHERE id = ?`, [status, cid]);
    if (!result.affectedRows) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    const rows = await query(`${JOIN} WHERE c.id = ?`, [cid]);
    res.json({ message: "Complaint updated", complaint: mapComplaint(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update complaint", error: err.message });
  }
}

module.exports = {
  createComplaint,
  listComplaints,
  updateComplaintStatus,
};
