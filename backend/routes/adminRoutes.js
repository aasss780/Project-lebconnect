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
  verifyUser,
  unverifyUser,
  listReports,
  updateReportStatus,
  listCompanyReviewsAdmin,
  updateCompanyReviewStatus,
  listSiteReviewsAdmin,
  deleteSiteReviewAdmin,
} = require("../controllers/adminController");
const { protect } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

const router = express.Router();

router.use(protect, requireRole("admin"));

router.get("/stats", getStats);
router.get("/reports", listReports);
router.put("/reports/:id/status", updateReportStatus);
router.get("/company-reviews", listCompanyReviewsAdmin);
router.put("/company-reviews/:id/status", updateCompanyReviewStatus);
router.get("/site-reviews", listSiteReviewsAdmin);
router.delete("/site-reviews/:id", deleteSiteReviewAdmin);

router.put("/users/:id/verify", verifyUser);
router.put("/users/:id/unverify", unverifyUser);

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
