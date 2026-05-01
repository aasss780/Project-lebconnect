const express = require("express");
const {
  getStats,
  listUsers,
  getAdminUserDetail,
  deleteUser,
  listAllJobs,
  getAdminJobById,
  closeAdminJob,
  deleteJob,
  listAdminComplaints,
  updateAdminComplaintStatus,
} = require("../controllers/adminController");
const { protect } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

const router = express.Router();

router.use(protect, requireRole("admin"));

router.get("/stats", getStats);
router.get("/users", listUsers);
router.get("/users/:id", getAdminUserDetail);
router.delete("/users/:id", deleteUser);
router.get("/jobs", listAllJobs);
router.get("/jobs/:id", getAdminJobById);
router.put("/jobs/:id/close", closeAdminJob);
router.delete("/jobs/:id", deleteJob);
router.get("/complaints", listAdminComplaints);
router.put("/complaints/:id/status", updateAdminComplaintStatus);

module.exports = router;
