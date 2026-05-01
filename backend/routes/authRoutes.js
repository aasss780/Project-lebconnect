const express = require("express");
const {
  registerCandidate,
  registerCompany,
  login,
  resetPassword,
} = require("../controllers/authController");

const router = express.Router();

router.post("/register/candidate", registerCandidate);
router.post("/register/company", registerCompany);
router.post("/login", login);
router.post("/reset-password", resetPassword);

module.exports = router;
