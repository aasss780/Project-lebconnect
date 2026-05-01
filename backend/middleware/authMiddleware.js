const jwt = require("jsonwebtoken");
const { query } = require("../config/db");
const { USER_PUBLIC_COLUMNS } = require("../constants/userColumns");
const { mapUser } = require("../utils/mappers");

const protect = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }
  const token = header.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = Number(decoded.id);
    if (!Number.isFinite(userId)) {
      return res.status(401).json({ message: "Not authorized, invalid token" });
    }

    const rows = await query(
      `SELECT ${USER_PUBLIC_COLUMNS} FROM users WHERE id = ?`,
      [userId]
    );
    const row = rows[0];
    if (!row) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = mapUser(row);
    req.user.id = row.id;
    req.user._id = row.id;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Not authorized, invalid token" });
  }
};

const optionalAuth = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next();
  }
  const token = header.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = Number(decoded.id);
    if (!Number.isFinite(userId)) {
      return next();
    }
    const rows = await query(
      `SELECT ${USER_PUBLIC_COLUMNS} FROM users WHERE id = ?`,
      [userId]
    );
    const row = rows[0];
    if (row) {
      req.user = mapUser(row);
      req.user.id = row.id;
      req.user._id = row.id;
    }
  } catch {
    /* anonymous */
  }
  next();
};

module.exports = { protect, optionalAuth };
