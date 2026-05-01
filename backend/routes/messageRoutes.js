const express = require("express");
const {
  sendMessage,
  conversationWithUser,
  listConversations,
} = require("../controllers/messageController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.post("/", sendMessage);
router.get("/conversations", listConversations);
router.get("/:userId", conversationWithUser);


module.exports = router;
