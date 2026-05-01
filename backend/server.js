const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { connectDB } = require("./config/db");
const { ensureSchema } = require("./config/ensureSchema");
const seedAdmin = require("./seed/adminSeed");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const jobRoutes = require("./routes/jobRoutes");
const applicationRoutes = require("./routes/applicationRoutes");
const postRoutes = require("./routes/postRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const complaintRoutes = require("./routes/complaintRoutes");
const adminRoutes = require("./routes/adminRoutes");
const messageRoutes = require("./routes/messageRoutes");
const siteReviewRoutes = require("./routes/siteReviewRoutes");

const {
  getHomeStats,
  getTopCompanies,
} = require("./controllers/userController");

const { getLatestJobs } = require("./controllers/jobController");

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
      "http://localhost:5176",
    ],
    credentials: true,
  })
);

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

app.use((req, res, next) => {
  console.log(req.method, req.originalUrl);
  next();
});

app.get("/", (req, res) => {
  res.json({
    ok: true,
    name: "LebConnect API",
    docs: "/api",
  });
});

app.get("/api/home/stats", getHomeStats);
app.get("/api/home/jobs", getLatestJobs);
app.get("/api/home/companies", getTopCompanies);

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/site-reviews", siteReviewRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((err, req, res, _next) => {
  if (err?.type === "entity.too.large") {
    return res.status(413).json({
      message:
        "Request body is too large. Maximum size is about 25 MB — try a smaller file or compress your CV.",
    });
  }
  console.error(err);
  return res.status(500).json({
    message: err?.message ? String(err.message) : "Unexpected server error",
  });
});

const PORT = process.env.PORT || 5000;

async function start() {
  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is required in .env");
    process.exit(1);
  }

  await connectDB();
  await ensureSchema();
  await seedAdmin();

  app.listen(PORT, () => {
    console.log(`LebConnect API running at http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});