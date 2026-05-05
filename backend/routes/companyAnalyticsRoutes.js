const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");
const { getAnalytics } = require("../controllers/companyAnalyticsController");

const router = express.Router();
router.get("/", protect, requireRole("company"), getAnalytics);

module.exports = router;
