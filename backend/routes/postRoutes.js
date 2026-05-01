const express = require("express");
const {
  createPost,
  listPosts,
  getPostById,
  toggleLike,
  addComment,
  incrementShare,
  deletePost,
} = require("../controllers/postController");
const { protect } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

const router = express.Router();

const authorRoles = requireRole("candidate", "company", "admin");

router.post("/", protect, authorRoles, createPost);
router.get("/", protect, listPosts);
router.get("/:id", protect, getPostById);
router.put("/:id/like", protect, authorRoles, toggleLike);
router.post("/:id/comments", protect, authorRoles, addComment);
router.put("/:id/share", protect, incrementShare);
router.delete("/:id", protect, deletePost);

module.exports = router;
