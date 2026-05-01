const express = require("express");
const {
  listNotifications,
  markRead,
  markAllRead,
  deleteNotification,
} = require("../controllers/notificationController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.get("/", listNotifications);
router.put("/read-all", markAllRead);
router.put("/:id/read", markRead);
router.delete("/:id", deleteNotification);

module.exports = router;
