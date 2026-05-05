const express = require("express");
const {
  applyToJob,
  listMyApplications,
  getMyApplicationById,
  listApplicationsForJob,
  updateApplicationStatus,
  markApplicationViewed,
  updateApplicationStage,
} = require("../controllers/applicationController");
const { protect } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

const router = express.Router();

router.post("/", protect, requireRole("candidate"), applyToJob);
router.get("/my", protect, requireRole("candidate"), listMyApplications);
router.get("/my/:id", protect, requireRole("candidate"), getMyApplicationById);
router.get("/job/:jobId", protect, requireRole("company"), listApplicationsForJob);
router.put("/:id/viewed", protect, requireRole("company"), markApplicationViewed);
router.put("/:id/stage", protect, requireRole("company"), updateApplicationStage);
router.put("/:id/status", protect, requireRole("company"), updateApplicationStatus);

module.exports = router;
