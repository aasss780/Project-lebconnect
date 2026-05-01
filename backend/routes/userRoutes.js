const express = require("express");
const {
  getSupportAdminUser,
  getPublicProfile,
  updateMyProfile,
  listCompanies,
  listCandidates,
  getTopCompanies,
  getHomeStats,
  listMyFollowing,
  getFollowStatus,
  followUser,
  unfollowUser,
} = require("../controllers/userController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/admin", getSupportAdminUser);
router.get("/home/stats", getHomeStats);
router.get("/companies/top", getTopCompanies);
router.get("/companies", listCompanies);
router.get("/candidates", listCandidates);
router.get("/following", protect, listMyFollowing);
router.get("/:id/follow-status", protect, getFollowStatus);
router.get("/profile/:id", getPublicProfile);
router.put("/profile", protect, updateMyProfile);
router.post("/:id/follow", protect, followUser);
router.delete("/:id/follow", protect, unfollowUser);

module.exports = router;
