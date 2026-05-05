const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");
const {
  listByUser,
  createProject,
  updateProject,
  deleteProject,
} = require("../controllers/projectController");

const router = express.Router();

router.get("/user/:userId", listByUser);
router.post("/", protect, requireRole("candidate"), createProject);
router.put("/:id", protect, requireRole("candidate"), updateProject);
router.delete("/:id", protect, requireRole("candidate"), deleteProject);

module.exports = router;
