const { query } = require("../config/db");
const { sqlTextCell } = require("../utils/mappers");
const {
  createNotification,
  displayActorName,
} = require("../utils/notificationHelper");
const {
  normalizeSpecialization,
  normalizeIndustry,
} = require("../utils/categoryNormalize");

const POST_AUTHOR_JOIN = `
  SELECT p.*,
         u.id AS author_uid,
         u.email AS author_email,
         u.role AS author_role,
         u.full_name AS author_full_name,
         u.company_name AS author_company_name,
         u.specialization AS author_specialization,
         u.normalized_specialization AS author_normalized_specialization,
         u.industry AS author_industry,
         u.normalized_industry AS author_normalized_industry,
         u.location AS author_location,
         u.logo AS author_logo,
         u.profile_image AS author_profile_image,
         j.title AS linked_job_title,
         j.location AS linked_job_location,
         j.type AS linked_job_type,
         j.salary AS linked_job_salary
  FROM posts p
  JOIN users u ON u.id = p.author_id
  LEFT JOIN jobs j ON j.id = p.job_id
`;

function mapAuthor(row) {
  const logo = sqlTextCell(row.author_logo);
  const pic = sqlTextCell(row.author_profile_image);
  const profileImage = pic || logo;
  return {
    _id: row.author_uid,
    id: row.author_uid,
    email: row.author_email,
    role: row.author_role,
    fullName: row.author_full_name,
    companyName: row.author_company_name,
    specialization: row.author_specialization,
    normalizedSpecialization: row.author_normalized_specialization || null,
    industry: row.author_industry,
    normalizedIndustry: row.author_normalized_industry || null,
    location: row.author_location,
    logo,
    profileImage,
  };
}

function buildPost(row, likesList, commentsList) {
  return {
    _id: row.id,
    id: row.id,
    author: mapAuthor(row),
    content: row.content,
    image: row.image,
    postType: row.post_type || "standard",
    jobId: row.job_id != null ? row.job_id : null,
    linkedJobTitle: row.linked_job_title || null,
    linkedJobLocation: row.linked_job_location || null,
    linkedJobType: row.linked_job_type || null,
    linkedJobSalary: row.linked_job_salary || null,
    likes: likesList,
    comments: commentsList,
    shareCount: row.share_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function viewerSameFieldBucket(viewer) {
  if (!viewer) return "";
  const r = String(viewer.role || "").toLowerCase();
  if (r === "candidate") {
    const n = viewer.normalizedSpecialization || viewer.normalized_specialization;
    if (n != null && String(n).trim() !== "") {
      return String(n).trim().toLowerCase();
    }
    return normalizeSpecialization(viewer.specialization || "");
  }
  if (r === "company") {
    const n = viewer.normalizedIndustry || viewer.normalized_industry;
    if (n != null && String(n).trim() !== "") {
      return String(n).trim().toLowerCase();
    }
    return normalizeIndustry(viewer.industry || "");
  }
  return "";
}

function authorSameFieldBucket(authorLike) {
  if (!authorLike) return "";
  const role = String(authorLike.role || "").toLowerCase();
  if (role === "candidate") {
    const n = authorLike.normalizedSpecialization;
    if (n != null && String(n).trim() !== "") {
      return String(n).trim().toLowerCase();
    }
    return normalizeSpecialization(authorLike.specialization || "");
  }
  if (role === "company") {
    const n = authorLike.normalizedIndustry;
    if (n != null && String(n).trim() !== "") {
      return String(n).trim().toLowerCase();
    }
    return normalizeIndustry(authorLike.industry || "");
  }
  return "";
}

function passesSameFieldFilter(viewer, post) {
  const vr = String(viewer.role || "").toLowerCase();
  if (!vr || vr === "admin") return true;

  const bucket = viewerSameFieldBucket(viewer);
  if (!bucket) return false;

  const author = post.author || {};
  const ar = String(author.role || "").toLowerCase();
  const ab = authorSameFieldBucket(author);
  return ab === bucket;
}

async function hydratePosts(postBaseRows) {
  if (!postBaseRows.length) return [];
  const ids = postBaseRows.map((p) => p.id);
  const ph = ids.map(() => "?").join(",");

  const likeUsers = await query(
    `SELECT pl.post_id,
            u.id AS uid,
            u.email,
            u.role,
            u.full_name,
            u.company_name,
            u.specialization,
            u.industry,
            u.location,
            u.logo,
            u.profile_image
     FROM post_likes pl
     JOIN users u ON u.id = pl.user_id
     WHERE pl.post_id IN (${ph})`,
    ids
  );

  const commentRows = await query(
    `SELECT c.id AS cid,
            c.post_id,
            c.text,
            c.created_at,
            u.id AS uid,
            u.email,
            u.role,
            u.full_name,
            u.company_name,
            u.specialization,
            u.industry,
            u.location,
            u.logo,
            u.profile_image
     FROM comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.post_id IN (${ph})
     ORDER BY c.created_at ASC`,
    ids
  );

  const likesByPost = {};
  for (const lu of likeUsers) {
    if (!likesByPost[lu.post_id]) likesByPost[lu.post_id] = [];
    const logo = sqlTextCell(lu.logo);
    const pic = sqlTextCell(lu.profile_image);
    const profileImage = pic || logo;
    likesByPost[lu.post_id].push({
      _id: lu.uid,
      id: lu.uid,
      email: lu.email,
      role: lu.role,
      fullName: lu.full_name,
      companyName: lu.company_name,
      specialization: lu.specialization,
      industry: lu.industry,
      location: lu.location,
      logo,
      profileImage,
    });
  }

  const commentsByPost = {};
  for (const cr of commentRows) {
    if (!commentsByPost[cr.post_id]) commentsByPost[cr.post_id] = [];
    const clogo = sqlTextCell(cr.logo);
    const cpic = sqlTextCell(cr.profile_image);
    const cprofileImage = cpic || clogo;
    commentsByPost[cr.post_id].push({
      _id: cr.cid,
      text: cr.text,
      createdAt: cr.created_at,
      user: {
        _id: cr.uid,
        id: cr.uid,
        email: cr.email,
        role: cr.role,
        fullName: cr.full_name,
        companyName: cr.company_name,
        specialization: cr.specialization,
        industry: cr.industry,
        location: cr.location,
        logo: clogo,
        profileImage: cprofileImage,
      },
    });
  }

  return postBaseRows.map((row) =>
    buildPost(row, likesByPost[row.id] || [], commentsByPost[row.id] || [])
  );
}

async function createPost(req, res) {
  try {
    let contentIn = req.body.content != null ? String(req.body.content) : "";
    const imageRaw = req.body.image != null ? String(req.body.image) : "";
    const jobIdReq = req.body.jobId ?? req.body.job_id;
    const jobIdNum =
      jobIdReq !== undefined &&
      jobIdReq !== null &&
      String(jobIdReq).trim() !== ""
        ? Number(jobIdReq)
        : NaN;

    const imageTrim = imageRaw.trim();
    const hasImage = imageTrim.length > 0;
    let postType = "standard";
    let jobIdDb = null;
    let trimmedContent = contentIn.trim();

    if (Number.isFinite(jobIdNum)) {
      const jobs = await query(`SELECT company_id, title FROM jobs WHERE id = ?`, [
        jobIdNum,
      ]);
      if (!jobs.length) {
        return res.status(404).json({ message: "Job not found" });
      }
      if (jobs[0].company_id !== req.user.id) {
        return res.status(403).json({ message: "You can only attach your own jobs" });
      }
      postType = "job";
      jobIdDb = jobIdNum;
      if (!trimmedContent) {
        trimmedContent = `We are hiring: ${jobs[0].title || "New role"}`;
      }
    }

    if (!trimmedContent && !hasImage && postType !== "job") {
      return res.status(400).json({
        message: "Add text, a photo, or link a job announcement.",
      });
    }

    const finalContent =
      trimmedContent || (hasImage ? " " : trimmedContent) || " ";

    const ins = await query(
      `INSERT INTO posts (author_id, content, image, post_type, job_id, share_count)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [req.user.id, finalContent, hasImage ? imageTrim : "", postType, jobIdDb]
    );

    const followerRows = await query(
      `SELECT follower_id FROM follows WHERE following_id = ?`,
      [req.user.id]
    );
    const authorName = displayActorName(req.user);
    for (const row of followerRows) {
      const followerId = row.follower_id;
      if (followerId === req.user.id) continue;
      await createNotification(followerId, {
        title: "New Post",
        message: `${authorName} shared a new post`,
        type: "post",
      });
    }

    const rows = await query(`${POST_AUTHOR_JOIN} WHERE p.id = ?`, [ins.insertId]);
    const full = await hydratePosts(rows);
    res.status(201).json({ message: "Post created", post: full[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create post", error: err.message });
  }
}

async function listPosts(req, res) {
  try {
    const rawFilter = String(req.query.filter || "all").toLowerCase();
    const filter = rawFilter.replace(/[\s_]+/g, "");

    const rows = await query(`${POST_AUTHOR_JOIN} ORDER BY p.created_at DESC`);
    let posts = await hydratePosts(rows);

    if (filter === "following") {
      const followerRows = await query(
        `SELECT following_id FROM follows WHERE follower_id = ?`,
        [req.user.id]
      );
      const followingSet = new Set(
        followerRows.map((r) => String(r.following_id))
      );
      posts = posts.filter((p) => {
        const aid = p.author?.id ?? p.author?._id;
        return aid != null && followingSet.has(String(aid));
      });
    } else if (filter === "people") {
      posts = posts.filter(
        (p) => String(p.author?.role || "").toLowerCase() !== "company"
      );
    } else if (filter === "companies") {
      posts = posts.filter(
        (p) => String(p.author?.role || "").toLowerCase() === "company"
      );
    } else if (filter === "samefield") {
      const vr = String(req.user.role || "").toLowerCase();
      if (vr !== "admin") {
        posts = posts.filter((p) => passesSameFieldFilter(req.user, p));
      }
    }

    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load posts", error: err.message });
  }
}

async function getPostById(req, res) {
  try {
    const pid = Number(req.params.id);
    const rows = await query(`${POST_AUTHOR_JOIN} WHERE p.id = ?`, [pid]);
    if (!rows.length) {
      return res.status(404).json({ message: "Post not found" });
    }
    const full = await hydratePosts(rows);
    res.json(full[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load post", error: err.message });
  }
}

async function toggleLike(req, res) {
  try {
    const pid = Number(req.params.id);
    const rows = await query(`${POST_AUTHOR_JOIN} WHERE p.id = ?`, [pid]);
    if (!rows.length) {
      return res.status(404).json({ message: "Post not found" });
    }
    const postRow = rows[0];
    const uid = req.user.id;

    const existing = await query(
      `SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?`,
      [pid, uid]
    );

    let liked = false;
    if (existing.length) {
      await query(`DELETE FROM post_likes WHERE post_id = ? AND user_id = ?`, [pid, uid]);
    } else {
      await query(`INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)`, [pid, uid]);
      liked = true;

      if (postRow.author_uid !== uid) {
        await createNotification(postRow.author_uid, {
          title: "New Like",
          message: `${displayActorName(req.user)} liked your post`,
          type: "post",
        });
      }
    }

    const refreshed = await query(`${POST_AUTHOR_JOIN} WHERE p.id = ?`, [pid]);
    const full = await hydratePosts(refreshed);
    res.json({ message: liked ? "Post liked" : "Like removed", liked, post: full[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update like", error: err.message });
  }
}

async function addComment(req, res) {
  try {
    const { text } = req.body;
    if (!text || !String(text).trim()) {
      return res.status(400).json({ message: "text is required" });
    }

    const pid = Number(req.params.id);
    const rows = await query(`${POST_AUTHOR_JOIN} WHERE p.id = ?`, [pid]);
    if (!rows.length) {
      return res.status(404).json({ message: "Post not found" });
    }
    const postRow = rows[0];

    await query(`INSERT INTO comments (post_id, user_id, text) VALUES (?, ?, ?)`, [
      pid,
      req.user.id,
      text.trim(),
    ]);

    if (postRow.author_uid !== req.user.id) {
      await createNotification(postRow.author_uid, {
        title: "New Comment",
        message: `${displayActorName(req.user)} commented on your post`,
        type: "post",
      });
    }

    const refreshed = await query(`${POST_AUTHOR_JOIN} WHERE p.id = ?`, [pid]);
    const full = await hydratePosts(refreshed);
    res.status(201).json({ message: "Comment added", post: full[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to add comment", error: err.message });
  }
}

async function incrementShare(req, res) {
  try {
    const pid = Number(req.params.id);
    const r = await query(`SELECT id, share_count FROM posts WHERE id = ?`, [pid]);
    if (!r.length) {
      return res.status(404).json({ message: "Post not found" });
    }
    await query(`UPDATE posts SET share_count = share_count + 1 WHERE id = ?`, [pid]);
    const u = await query(`SELECT share_count FROM posts WHERE id = ?`, [pid]);
    res.json({ message: "Share counted", shareCount: u[0].share_count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update share count", error: err.message });
  }
}

async function deletePost(req, res) {
  try {
    const pid = Number(req.params.id);
    const rows = await query(`SELECT author_id FROM posts WHERE id = ?`, [pid]);
    if (!rows.length) {
      return res.status(404).json({ message: "Post not found" });
    }

    const isOwner = rows[0].author_id === req.user.id;
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: "You cannot delete this post" });
    }

    await query(`DELETE FROM posts WHERE id = ?`, [pid]);
    res.json({ message: "Post deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete post", error: err.message });
  }
}

module.exports = {
  createPost,
  listPosts,
  getPostById,
  toggleLike,
  addComment,
  incrementShare,
  deletePost,
  hydratePosts,
};
