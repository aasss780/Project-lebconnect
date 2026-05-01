const { query } = require("../config/db");

function mapNotification(row) {
  return {
    _id: row.id,
    id: row.id,
    user: row.user_id,
    title: row.title,
    message: row.message,
    type: row.type,
    isRead: !!row.is_read,
    createdAt: row.created_at,
  };
}

async function listNotifications(req, res) {
  try {
    const rows = await query(
      `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(rows.map(mapNotification));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load notifications", error: err.message });
  }
}

async function markRead(req, res) {
  try {
    const nid = Number(req.params.id);
    const result = await query(
      `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`,
      [nid, req.user.id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ message: "Notification not found" });
    }
    const rows = await query(`SELECT * FROM notifications WHERE id = ?`, [nid]);
    res.json({ message: "Marked as read", notification: mapNotification(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update notification", error: err.message });
  }
}

async function markAllRead(req, res) {
  try {
    await query(`UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`, [
      req.user.id,
    ]);
    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update notifications", error: err.message });
  }
}

async function deleteNotification(req, res) {
  try {
    const nid = Number(req.params.id);
    const result = await query(`DELETE FROM notifications WHERE id = ? AND user_id = ?`, [
      nid,
      req.user.id,
    ]);
    if (!result.affectedRows) {
      return res.status(404).json({ message: "Notification not found" });
    }
    res.json({ message: "Notification deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete notification", error: err.message });
  }
}

module.exports = {
  listNotifications,
  markRead,
  markAllRead,
  deleteNotification,
};
