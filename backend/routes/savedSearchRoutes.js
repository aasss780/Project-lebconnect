const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");
const {
  listMine,
  createSaved,
  deleteSaved,
} = require("../controllers/savedSearchController");

const router = express.Router();
router.use(protect, requireRole("candidate"));

router.get("/", listMine);
router.post("/", createSaved);
router.delete("/:id", deleteSaved);

module.exports = router;
