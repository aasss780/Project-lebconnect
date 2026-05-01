const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { query } = require("../config/db");
const { USER_PUBLIC_COLUMNS } = require("../constants/userColumns");
const { mapUser } = require("../utils/mappers");
const {
  resolveCandidateSpecialization,
  resolveCompanyIndustry,
} = require("../utils/categoryValidation");

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

const registerCandidate = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    const specRes = resolveCandidateSpecialization(
      req.body.specializationCategory,
      req.body.specializationOther ?? ""
    );
    if (specRes.error) {
      return res.status(400).json({ message: specRes.error });
    }
    const { specialization } = specRes;
    const ns = specRes.normalized;
    if (!fullName?.trim() || !email?.trim() || !password) {
      return res
        .status(400)
        .json({ message: "fullName, email, password, and specialization are required" });
    }

    const existing = await query(`SELECT id FROM users WHERE email = ?`, [
      email.toLowerCase(),
    ]);
    if (existing.length) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO users (email, password, role, full_name, specialization, normalized_specialization)
       VALUES (?, ?, 'candidate', ?, ?, ?)`,
      [email.toLowerCase(), hashed, fullName, specialization, ns || null]
    );

    const userId = result.insertId;
    const rows = await query(
      `SELECT ${USER_PUBLIC_COLUMNS} FROM users WHERE id = ?`,
      [userId]
    );

    res.status(201).json({
      message: "Candidate registered successfully",
      token: signToken(userId),
      user: mapUser(rows[0]),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Registration failed", error: err.message });
  }
};

const registerCompany = async (req, res) => {
  try {
    const { companyName, email, password, location } = req.body;
    const indRes = resolveCompanyIndustry(
      req.body.industryCategory ?? req.body.industry,
      req.body.industryOther
    );
    if (indRes.error) {
      return res.status(400).json({ message: indRes.error });
    }
    const { industry } = indRes;
    const ni = indRes.normalized;
    if (!companyName || !email || !password || !industry || !location) {
      return res.status(400).json({
        message: "companyName, email, password, industry, and location are required",
      });
    }

    const existing = await query(`SELECT id FROM users WHERE email = ?`, [
      email.toLowerCase(),
    ]);
    if (existing.length) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO users (email, password, role, company_name, industry, normalized_industry, location)
       VALUES (?, ?, 'company', ?, ?, ?, ?)`,
      [email.toLowerCase(), hashed, companyName, industry, ni || null, location]
    );

    const userId = result.insertId;
    const rows = await query(
      `SELECT ${USER_PUBLIC_COLUMNS} FROM users WHERE id = ?`,
      [userId]
    );

    res.status(201).json({
      message: "Company registered successfully",
      token: signToken(userId),
      user: mapUser(rows[0]),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Registration failed", error: err.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const rows = await query(`SELECT * FROM users WHERE email = ?`, [email.toLowerCase()]);
    const row = rows[0];
    if (!row) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const match = await bcrypt.compare(password, row.password);
    if (!match) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const safe = await query(`SELECT ${USER_PUBLIC_COLUMNS} FROM users WHERE id = ?`, [
      row.id,
    ]);

    res.json({
      message: "Login successful",
      token: signToken(row.id),
      user: mapUser(safe[0]),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Login failed", error: err.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const email = String(req.body.email ?? "").trim().toLowerCase();
    const newPassword = String(req.body.newPassword ?? "");
    if (!email || !newPassword) {
      return res.status(400).json({ message: "Email and new password are required." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    const rows = await query(`SELECT id FROM users WHERE email = ?`, [email]);
    const row = rows[0];
    if (!row) {
      return res.status(404).json({ message: "No account found for this email." });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await query(`UPDATE users SET password = ? WHERE id = ?`, [hashed, row.id]);

    res.json({ message: "Password updated. You can sign in with your new password." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not reset password", error: err.message });
  }
};

module.exports = {
  registerCandidate,
  registerCompany,
  login,
  resetPassword,
};
