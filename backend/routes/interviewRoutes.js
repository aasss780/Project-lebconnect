const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");
const {
  createInterview,
  listMyInterviews,
  listCompanyInterviews,
  cancelInterviewByCandidate,
  updateInterviewStatus,
} = require("../controllers/interviewController");

const router = express.Router();

router.post("/", protect, requireRole("company"), createInterview);
router.get("/my", protect, requireRole("candidate"), listMyInterviews);
router.get("/company", protect, requireRole("company"), listCompanyInterviews);
router.put("/:id/cancel", protect, requireRole("candidate"), cancelInterviewByCandidate);
router.patch("/:id/status", protect, updateInterviewStatus);
router.put("/:id/status", protect, updateInterviewStatus);

module.exports = router;
