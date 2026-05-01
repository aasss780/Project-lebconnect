const { query } = require("./db");
const {
  normalizeSpecialization,
  normalizeIndustry,
} = require("../utils/categoryNormalize");

/**
 * Idempotent DDL for local/dev DBs — runs at server startup.
 */
async function ensureSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS site_reviews (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED DEFAULT NULL,
      name VARCHAR(255) NOT NULL,
      rating TINYINT UNSIGNED NOT NULL,
      comment TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_site_reviews_created_at (created_at),
      CONSTRAINT fk_site_reviews_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
    ) ENGINE=InnoDB
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS follows (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      follower_id INT UNSIGNED NOT NULL,
      following_id INT UNSIGNED NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_follows_pair (follower_id, following_id),
      KEY idx_follows_follower (follower_id),
      KEY idx_follows_following (following_id),
      CONSTRAINT fk_follows_follower FOREIGN KEY (follower_id) REFERENCES users (id) ON DELETE CASCADE,
      CONSTRAINT fk_follows_following FOREIGN KEY (following_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);

  try {
    await query(`
      ALTER TABLE notifications
      MODIFY COLUMN type ENUM(
        'application','message','system','post','follow'
      ) NOT NULL
    `);
  } catch (err) {
    const m = `${err.sqlMessage || err.message || ""}`;
    // Already aligned or incompatible server — log once so operators can patch manually.
    if (!/(Duplicate column|near|doesn't exist|Unknown column)/i.test(m)) {
      console.warn("[ensureSchema] notifications ENUM:", m);
    }
  }

  try {
    await query(
      `ALTER TABLE users ADD COLUMN cover_image VARCHAR(1024) DEFAULT NULL AFTER logo`
    );
  } catch (err) {
    const m = `${err.sqlMessage || err.message || ""}`;
    if (!/Duplicate column name/i.test(m)) {
      console.warn("[ensureSchema] users.cover_image:", m);
    }
  }

  try {
    await query(`ALTER TABLE users MODIFY COLUMN profile_image LONGTEXT NULL`);
  } catch (err) {
    const m = `${err.sqlMessage || err.message || ""}`;
    if (!/Unknown column/i.test(m)) {
      console.warn("[ensureSchema] users.profile_image LONGTEXT:", m);
    }
  }
  try {
    await query(`ALTER TABLE users MODIFY COLUMN cover_image LONGTEXT NULL`);
  } catch (err) {
    const m = `${err.sqlMessage || err.message || ""}`;
    if (!/Unknown column/i.test(m)) {
      console.warn("[ensureSchema] users.cover_image LONGTEXT:", m);
    }
  }
  try {
    await query(`ALTER TABLE users MODIFY COLUMN logo LONGTEXT NULL`);
  } catch (err) {
    const m = `${err.sqlMessage || err.message || ""}`;
    if (!/Unknown column/i.test(m)) {
      console.warn("[ensureSchema] users.logo LONGTEXT:", m);
    }
  }

  try {
    await query(
      `ALTER TABLE applications ADD COLUMN cv LONGTEXT DEFAULT NULL AFTER status`
    );
  } catch (err) {
    const m = `${err.sqlMessage || err.message || ""}`;
    if (!/Duplicate column name/i.test(m)) {
      console.warn("[ensureSchema] applications.cv:", m);
    }
  }
  try {
    await query(
      `ALTER TABLE applications ADD COLUMN cv_file_name VARCHAR(255) DEFAULT NULL AFTER cv`
    );
  } catch (err) {
    const m = `${err.sqlMessage || err.message || ""}`;
    if (!/Duplicate column name/i.test(m)) {
      console.warn("[ensureSchema] applications.cv_file_name:", m);
    }
  }
  try {
    await query(
      `ALTER TABLE applications ADD COLUMN message TEXT DEFAULT NULL AFTER cv_file_name`
    );
  } catch (err) {
    const m = `${err.sqlMessage || err.message || ""}`;
    if (!/Duplicate column name/i.test(m)) {
      console.warn("[ensureSchema] applications.message:", m);
    }
  }

  try {
    await query(
      `ALTER TABLE users ADD COLUMN normalized_specialization VARCHAR(128) DEFAULT NULL AFTER specialization`
    );
  } catch (err) {
    const m = `${err.sqlMessage || err.message || ""}`;
    if (!/Duplicate column name/i.test(m)) {
      console.warn("[ensureSchema] users.normalized_specialization:", m);
    }
  }

  try {
    await query(
      `ALTER TABLE users ADD COLUMN normalized_industry VARCHAR(128) DEFAULT NULL AFTER industry`
    );
  } catch (err) {
    const m = `${err.sqlMessage || err.message || ""}`;
    if (!/Duplicate column name/i.test(m)) {
      console.warn("[ensureSchema] users.normalized_industry:", m);
    }
  }

  try {
    await query(`ALTER TABLE posts MODIFY COLUMN image LONGTEXT DEFAULT NULL`);
  } catch (err) {
    const m = `${err.sqlMessage || err.message || ""}`;
    if (!/Duplicate column name/i.test(m) && !/same\s+as/i.test(m)) {
      console.warn("[ensureSchema] posts.image LONGTEXT:", m);
    }
  }

  try {
    await query(`
      ALTER TABLE posts
      ADD COLUMN post_type ENUM('standard','job') NOT NULL DEFAULT 'standard' AFTER image
    `);
  } catch (err) {
    const m = `${err.sqlMessage || err.message || ""}`;
    if (!/Duplicate column name/i.test(m)) {
      console.warn("[ensureSchema] posts.post_type:", m);
    }
  }

  try {
    await query(
      `ALTER TABLE posts ADD COLUMN job_id INT UNSIGNED DEFAULT NULL AFTER post_type`
    );
  } catch (err) {
    const m = `${err.sqlMessage || err.message || ""}`;
    if (!/Duplicate column name/i.test(m)) {
      console.warn("[ensureSchema] posts.job_id column:", m);
    }
  }

  try {
    await query(`
      ALTER TABLE posts
      ADD CONSTRAINT fk_posts_job FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE SET NULL
    `);
  } catch (err) {
    const m = `${err.sqlMessage || err.message || ""}`;
    if (
      !/Duplicate key name/i.test(m) &&
      !/already exists/i.test(m) &&
      !/duplicate foreign key/i.test(m)
    ) {
      console.warn("[ensureSchema] posts fk_posts_job:", m);
    }
  }

  try {
    const cand = await query(
      `SELECT id, specialization FROM users
       WHERE role = 'candidate'
         AND specialization IS NOT NULL AND TRIM(specialization) <> ''
         AND (normalized_specialization IS NULL OR normalized_specialization = '')`
    );
    for (const r of cand) {
      const bucket = normalizeSpecialization(r.specialization);
      await query(`UPDATE users SET normalized_specialization = ? WHERE id = ?`, [
        bucket || null,
        r.id,
      ]);
    }
  } catch (err) {
    console.warn(
      "[ensureSchema] backfill normalized_specialization:",
      err.message || err
    );
  }

  try {
    const comps = await query(
      `SELECT id, industry FROM users
       WHERE role = 'company'
         AND industry IS NOT NULL AND TRIM(industry) <> ''
         AND (normalized_industry IS NULL OR normalized_industry = '')`
    );
    for (const r of comps) {
      const bucket = normalizeIndustry(r.industry);
      await query(`UPDATE users SET normalized_industry = ? WHERE id = ?`, [
        bucket || null,
        r.id,
      ]);
    }
  } catch (err) {
    console.warn(
      "[ensureSchema] backfill normalized_industry:",
      err.message || err
    );
  }
}

module.exports = { ensureSchema };
