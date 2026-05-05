const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { getSameFieldNetwork } = require("../controllers/networkController");

const router = express.Router();
router.get("/same-field", protect, getSameFieldNetwork);

module.exports = router;
