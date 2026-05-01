const { query } = require("../config/db");

const MIN_COMMENT = 3;
const MAX_COMMENT = 5000;

function mapRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    rating: Number(row.rating),
    comment: row.comment,
    createdAt: row.created_at,
  };
}

async function listSiteReviews(_req, res) {
  try {
    const rows = await query(
      `SELECT id, user_id, name, rating, comment, created_at
       FROM site_reviews
       ORDER BY created_at DESC`
    );
    res.json(rows.map(mapRow));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not load reviews", error: err.message });
  }
}

async function createSiteReview(req, res) {
  try {
    const rating = Number(req.body.rating);
    const comment = String(req.body.comment ?? "").trim();
    let name = String(req.body.name ?? "").trim();

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5." });
    }
    if (!comment) {
      return res.status(400).json({ message: "Please write a comment." });
    }
    if (comment.length < MIN_COMMENT) {
      return res
        .status(400)
        .json({ message: `Comment must be at least ${MIN_COMMENT} characters.` });
    }
    if (comment.length > MAX_COMMENT) {
      return res.status(400).json({ message: "Comment is too long." });
    }

    let userId = null;
    if (req.user) {
      userId = req.user.id;
      const fromUser =
        (req.user.fullName && String(req.user.fullName).trim()) ||
        (req.user.companyName && String(req.user.companyName).trim()) ||
        (req.user.email && String(req.user.email).trim());
      if (fromUser) name = fromUser;
    }

    if (!name) {
      return res.status(400).json({ message: "Please enter your name." });
    }
    if (name.length < 2) {
      return res.status(400).json({ message: "Name is too short." });
    }

    const result = await query(
      `INSERT INTO site_reviews (user_id, name, rating, comment)
       VALUES (?, ?, ?, ?)`,
      [userId, name.slice(0, 255), rating, comment]
    );

    const rows = await query(
      `SELECT id, user_id, name, rating, comment, created_at FROM site_reviews WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json({ message: "Thanks for your review!", review: mapRow(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not save review", error: err.message });
  }
}

module.exports = {
  listSiteReviews,
  createSiteReview,
};
