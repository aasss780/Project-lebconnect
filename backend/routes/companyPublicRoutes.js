const express = require("express");
const {
  listForCompany,
  createReview,
} = require("../controllers/companyReviewController");
const { protect } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

const router = express.Router();

router.get("/:companyId/reviews", listForCompany);
router.post("/:companyId/reviews", protect, requireRole("candidate"), createReview);

module.exports = router;
