const requireRole = (...allowed) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authorized" });
  }
  if (!allowed.includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied for this role" });
  }
  next();
};

module.exports = { requireRole };
