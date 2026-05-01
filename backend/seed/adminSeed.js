const bcrypt = require("bcryptjs");
const { query } = require("../config/db");

async function seedAdmin() {
  const rows = await query(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
  if (rows.length) return;

  const email = process.env.ADMIN_EMAIL || "admin@lebconnect.com";
  const password = process.env.ADMIN_PASSWORD || "admin123";

  const hashed = await bcrypt.hash(password, 10);
  await query(
    `INSERT INTO users (email, password, role, full_name)
     VALUES (?, ?, 'admin', 'Platform Admin')`,
    [email.toLowerCase(), hashed]
  );

  console.log(`Default admin seeded: ${email}`);
}

module.exports = seedAdmin;
