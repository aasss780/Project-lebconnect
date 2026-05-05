const { query } = require("../config/db");

async function listForCompany(req, res) {
  try {
    const companyId = Number(req.params.companyId);
    const users = await query(`SELECT id, role FROM users WHERE id = ?`, [companyId]);
    if (!users.length || users[0].role !== "company") {
      return res.status(404).json({ message: "Company not found" });
    }

    const rows = await query(
      `SELECT r.*, u.full_name, u.profile_image
       FROM company_reviews r
       JOIN users u ON u.id = r.user_id
       WHERE r.company_id = ? AND r.status = 'approved'
       ORDER BY r.created_at DESC`,
      [companyId]
    );

    const ratings = rows.map((x) => Number(x.rating));
    const avg =
      ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : null;

    res.json({
      averageRating: avg,
      count: rows.length,
      reviews: rows.map((r) => ({
        id: r.id,
        rating: Number(r.rating),
        title: r.title,
        comment: r.comment,
        interviewExperience: r.interview_experience,
        createdAt: r.created_at,
        author: {
          fullName: r.full_name,
          profileImage: r.profile_image,
        },
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load reviews", error: err.message });
  }
}

async function createReview(req, res) {
  try {
    if (req.user.role !== "candidate") {
      return res.status(403).json({ message: "Only candidates can review companies" });
    }
    const companyId = Number(req.params.companyId);
    const companies = await query(`SELECT id FROM users WHERE id = ? AND role = 'company'`, [
      companyId,
    ]);
    if (!companies.length) return res.status(404).json({ message: "Company not found" });

    const rating = Number(req.body.rating);
    const title = String(req.body.title || "").trim();
    const comment = String(req.body.comment || "").trim();
    const interviewExperience = String(req.body.interviewExperience ?? "").trim() || null;

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "rating 1-5 required" });
    }
    if (!title || !comment) {
      return res.status(400).json({ message: "title and comment required" });
    }

    try {
      const ins = await query(
        `INSERT INTO company_reviews (company_id, user_id, rating, title, comment, interview_experience, status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        [companyId, req.user.id, rating, title.slice(0, 255), comment, interviewExperience]
      );
      res.status(201).json({
        id: ins.insertId,
        message: "Review submitted — it will appear after moderator approval.",
        status: "pending",
      });
    } catch (e) {
      if (e.errno === 1062 || e.code === "ER_DUP_ENTRY") {
        return res.status(400).json({ message: "You already reviewed this company" });
      }
      throw e;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to submit review", error: err.message });
  }
}

module.exports = {
  listForCompany,
  createReview,
};
