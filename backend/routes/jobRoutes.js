const express = require("express");
const {
  createJob,
  listJobs,
  listMyJobs,
  getLatestJobs,
  getJobById,
  updateJob,
  deleteJob,
  closeJob,
  saveJob,
  unsaveJob,
  getMySavedJobs,
} = require("../controllers/jobController");
const { protect, optionalAuth } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

const router = express.Router();

router.get("/latest", optionalAuth, getLatestJobs);
router.get("/saved/my", protect, requireRole("candidate"), getMySavedJobs);
router.post("/:id/save", protect, requireRole("candidate"), saveJob);
router.delete("/:id/save", protect, requireRole("candidate"), unsaveJob);

router.get("/", optionalAuth, listJobs);
router.get("/mine", protect, requireRole("company"), listMyJobs);
router.post("/", protect, requireRole("company"), createJob);

router.put("/:id/close", protect, requireRole("company"), closeJob);

router
  .route("/:id")
  .get(optionalAuth, getJobById)
  .put(protect, requireRole("company"), updateJob)
  .delete(protect, requireRole("company"), deleteJob);

module.exports = router;
