const { query } = require("../config/db");

/** @param {{ role?: string, fullName?: string, companyName?: string }} actor */
function displayActorName(actor) {
  if (!actor) return "Someone";
  if (actor.role === "company")
    return actor.companyName || "Someone";
  return actor.fullName || "Someone";
}

async function createNotification(userId, { title, message, type }) {
  await query(
    `INSERT INTO notifications (user_id, title, message, type, is_read)
     VALUES (?, ?, ?, ?, 0)`,
    [userId, title, message, type]
  );
}

module.exports = {
  createNotification,
  displayActorName,
};
