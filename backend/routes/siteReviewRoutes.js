const express = require("express");
const { optionalAuth } = require("../middleware/authMiddleware");
const {
  listSiteReviews,
  createSiteReview,
} = require("../controllers/siteReviewController");

const router = express.Router();

router.get("/", listSiteReviews);
router.post("/", optionalAuth, createSiteReview);

module.exports = router;
