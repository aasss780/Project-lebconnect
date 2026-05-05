const { query } = require("../config/db");

/** Hiring analytics computed from existing application/job tables */
async function getAnalytics(req, res) {
  try {
    const cid = req.user.id;

    const activeRows = await query(
      `SELECT COUNT(*) AS c FROM jobs WHERE company_id = ? AND status = 'active'`,
      [cid]
    );
    const appsMonthRows = await query(
      `SELECT COUNT(*) AS c
       FROM applications a
       JOIN jobs j ON j.id = a.job_id
       WHERE j.company_id = ?
         AND a.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      [cid]
    );
    const pendingRows = await query(
      `SELECT COUNT(*) AS c
       FROM applications a
       JOIN jobs j ON j.id = a.job_id
       WHERE j.company_id = ? AND a.status = 'pending'`,
      [cid]
    );
    const accRows = await query(
      `SELECT COUNT(*) AS c
       FROM applications a
       JOIN jobs j ON j.id = a.job_id
       WHERE j.company_id = ? AND a.status = 'accepted'`,
      [cid]
    );
    const rejRows = await query(
      `SELECT COUNT(*) AS c
       FROM applications a
       JOIN jobs j ON j.id = a.job_id
       WHERE j.company_id = ? AND a.status = 'rejected'`,
      [cid]
    );

    const acc = Number(accRows[0]?.c || 0);
    const rej = Number(rejRows[0]?.c || 0);
    const decided = acc + rej;
    const acceptanceRate = decided > 0 ? Math.round((acc / decided) * 100) : null;

    const topJobRows = await query(
      `SELECT j.title, COUNT(a.id) AS cnt
       FROM jobs j
       LEFT JOIN applications a ON a.job_id = j.id
       WHERE j.company_id = ?
       GROUP BY j.id, j.title
       ORDER BY cnt DESC
       LIMIT 1`,
      [cid]
    );

    res.json({
      activeJobs: Number(activeRows[0]?.c || 0),
      applicationsLast30Days: Number(appsMonthRows[0]?.c || 0),
      pendingApplicants: Number(pendingRows[0]?.c || 0),
      acceptedTotal: acc,
      rejectedTotal: rej,
      acceptanceRatePercent: acceptanceRate,
      bestPerformingJob: topJobRows[0]?.title || null,
      bestPerformingApplicants: Number(topJobRows[0]?.cnt || 0),
      profileViewsEstimated: null,
      profileViewsNote:
        "Profile views not tracked server-side yet — labeled for transparency.",
      postEngagementNote:
        "Engagement rollup can aggregate likes/comments in a future sprint.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Analytics failed", error: err.message });
  }
}

module.exports = { getAnalytics };
