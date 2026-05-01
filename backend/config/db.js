const mysql = require("mysql2/promise");

let pool;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || "127.0.0.1",
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD ?? "",
      database: process.env.DB_NAME || "lebconnect",
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return pool;
}

async function query(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

async function connectDB() {
  try {
    await query("SELECT 1");
    console.log(
      "MySQL connected (database:",
      process.env.DB_NAME || "lebconnect",
      ")"
    );
  } catch (err) {
    console.error(
      "MySQL connection failed. Check XAMPP MySQL, DB_PORT, username, password, and database name.",
      "\n",
      err.message
    );
    throw err;
  }
}

module.exports = { getPool, query, connectDB };