const express = require("express");
const {
  createComplaint,
  listComplaints,
  updateComplaintStatus,
} = require("../controllers/complaintController");
const { protect } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

const router = express.Router();

router.post("/", protect, createComplaint);
router.get("/", protect, listComplaints);
router.put("/:id/status", protect, requireRole("admin"), updateComplaintStatus);

module.exports = router;
