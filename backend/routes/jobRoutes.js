const express = require("express");
const {
  createJob,
  listJobs,
  getLatestJobs,
  getJobById,
  updateJob,
  deleteJob,
  closeJob,
  saveJob,
  unsaveJob,
  getMySavedJobs,
} = require("../controllers/jobController");
const { protect } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

const router = express.Router();

router.get("/latest", getLatestJobs);
router.get("/saved/my", protect, requireRole("candidate"), getMySavedJobs);
router.post("/:id/save", protect, requireRole("candidate"), saveJob);
router.delete("/:id/save", protect, requireRole("candidate"), unsaveJob);

router.get("/", listJobs);
router.post("/", protect, requireRole("company"), createJob);

router.put("/:id/close", protect, requireRole("company"), closeJob);

router
  .route("/:id")
  .get(getJobById)
  .put(protect, requireRole("company"), updateJob)
  .delete(protect, requireRole("company"), deleteJob);

module.exports = router;
