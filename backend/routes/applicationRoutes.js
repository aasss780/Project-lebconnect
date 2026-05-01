const express = require("express");
const {
  applyToJob,
  listMyApplications,
  listApplicationsForJob,
  updateApplicationStatus,
} = require("../controllers/applicationController");
const { protect } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

const router = express.Router();

router.post("/", protect, requireRole("candidate"), applyToJob);
router.get("/my", protect, requireRole("candidate"), listMyApplications);
router.get("/job/:jobId", protect, requireRole("company"), listApplicationsForJob);
router.put("/:id/status", protect, requireRole("company"), updateApplicationStatus);

module.exports = router;
