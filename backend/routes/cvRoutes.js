const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");
const {
  analyzeCv,
  getMyCvAnalysis,
  clearMyCvAnalysis,
} = require("../controllers/cvAnalyzeController");

const router = express.Router();
router.post("/analyze", protect, requireRole("candidate"), analyzeCv);
router.get("/analysis/my", protect, requireRole("candidate"), getMyCvAnalysis);
router.delete("/analysis/my", protect, requireRole("candidate"), clearMyCvAnalysis);

module.exports = router;
