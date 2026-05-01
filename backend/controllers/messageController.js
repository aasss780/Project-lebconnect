const { query } = require("../config/db");
const { createNotification } = require("../utils/notificationHelper");

function mapMiniUser(row) {
  return {
    _id: row.uid,
    id: row.uid,
    fullName: row.full_name,
    companyName: row.company_name,
    role: row.role,
    profileImage: row.profile_image,
    logo: row.logo,
    email: row.email,
  };
}

function mapMessage(row) {
  return {
    _id: row.mid,
    text: row.text,
    isRead: !!row.is_read,
    createdAt: row.created_at,
    sender: mapMiniUser({
      uid: row.sid,
      full_name: row.s_full_name,
      company_name: row.s_company_name,
      role: row.s_role,
      profile_image: row.s_profile_image,
      logo: row.s_logo,
      email: row.s_email,
    }),
    receiver: mapMiniUser({
      uid: row.rid,
      full_name: row.r_full_name,
      company_name: row.r_company_name,
      role: row.r_role,
      profile_image: row.r_profile_image,
      logo: row.r_logo,
      email: row.r_email,
    }),
  };
}

const MSG_JOIN = `
  SELECT m.id AS mid,
         m.text,
         m.is_read,
         m.created_at,
         m.sender_id AS sid,
         m.receiver_id AS rid,
         su.full_name AS s_full_name,
         su.company_name AS s_company_name,
         su.role AS s_role,
         su.profile_image AS s_profile_image,
         su.logo AS s_logo,
         su.email AS s_email,
         ru.full_name AS r_full_name,
         ru.company_name AS r_company_name,
         ru.role AS r_role,
         ru.profile_image AS r_profile_image,
         ru.logo AS r_logo,
         ru.email AS r_email
  FROM messages m
  JOIN users su ON su.id = m.sender_id
  JOIN users ru ON ru.id = m.receiver_id
`;

async function sendMessage(req, res) {
  try {
    const { receiver, text } = req.body;
    if (!receiver || !text || !String(text).trim()) {
      return res.status(400).json({ message: "receiver and text are required" });
    }

    const rid = Number(receiver);
    if (!Number.isFinite(rid)) {
      return res.status(400).json({ message: "Invalid receiver id" });
    }

    const others = await query(`SELECT id FROM users WHERE id = ?`, [rid]);
    if (!others.length) {
      return res.status(404).json({ message: "Receiver not found" });
    }

    const ins = await query(
      `INSERT INTO messages (sender_id, receiver_id, text, is_read)
       VALUES (?, ?, ?, 0)`,
      [req.user.id, rid, text.trim()]
    );

    const rows = await query(`${MSG_JOIN} WHERE m.id = ?`, [ins.insertId]);

    const senderNorm =
      req.user.role === "company"
        ? req.user.companyName || "Someone"
        : req.user.fullName || "Someone";

    const recRows = await query(
      `SELECT id, role FROM users WHERE id = ? LIMIT 1`,
      [rid]
    );
    const receiverRole = recRows[0]?.role || "";

    let notifTitle = "New Message";
    let notifBody = `${senderNorm} sent you a message`;
    if (receiverRole === "admin") {
      notifTitle = "Support message";
      notifBody = `${senderNorm} sent you a support message`;
    }
    if (req.user.role === "admin" && receiverRole !== "admin") {
      notifTitle = "Reply from support";
      notifBody = "LebConnect support replied to your message";
    }

    await createNotification(rid, {
      title: notifTitle,
      message: notifBody,
      type: "message",
    });

    res.status(201).json({ message: "Message sent", message: mapMessage(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send message", error: err.message });
  }
}

async function conversationWithUser(req, res) {
  try {
    const otherId = Number(req.params.userId);
    const rows = await query(
      `${MSG_JOIN}
       WHERE (m.sender_id = ? AND m.receiver_id = ?)
          OR (m.sender_id = ? AND m.receiver_id = ?)
       ORDER BY m.created_at ASC`,
      [req.user.id, otherId, otherId, req.user.id]
    );

    await query(
      `UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0`,
      [otherId, req.user.id]
    );

    res.json(rows.map(mapMessage));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load messages", error: err.message });
  }
}

async function listConversations(req, res) {
  try {
    const rows = await query(
      `${MSG_JOIN}
       WHERE m.sender_id = ? OR m.receiver_id = ?
       ORDER BY m.created_at DESC`,
      [req.user.id, req.user.id]
    );

    const partnerMap = new Map();
    for (const row of rows) {
      const sid = row.sid;
      const rid = row.rid;
      const me = req.user.id;
      const partnerId = sid === me ? rid : sid;
      if (!partnerMap.has(partnerId)) {
        const partnerRow =
          sid === me
            ? {
                uid: rid,
                full_name: row.r_full_name,
                company_name: row.r_company_name,
                role: row.r_role,
                profile_image: row.r_profile_image,
                logo: row.r_logo,
                email: row.r_email,
              }
            : {
                uid: sid,
                full_name: row.s_full_name,
                company_name: row.s_company_name,
                role: row.s_role,
                profile_image: row.s_profile_image,
                logo: row.s_logo,
                email: row.s_email,
              };
        partnerMap.set(partnerId, {
          partner: mapMiniUser(partnerRow),
          lastMessage: mapMessage(row),
          unread: 0,
        });
      }
    }

    const unreadRows = await query(
      `SELECT sender_id, COUNT(*) AS cnt
       FROM messages
       WHERE receiver_id = ? AND is_read = 0
       GROUP BY sender_id`,
      [req.user.id]
    );
    const unreadBySender = Object.fromEntries(
      unreadRows.map((u) => [String(u.sender_id), Number(u.cnt)])
    );

    const conversations = [...partnerMap.values()].map((c) => ({
      partner: c.partner,
      lastMessage: c.lastMessage,
      unread: unreadBySender[String(c.partner._id)] || 0,
    }));

    res.json(conversations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load conversations", error: err.message });
  }
}

module.exports = {
  sendMessage,
  conversationWithUser,
  listConversations,
};
