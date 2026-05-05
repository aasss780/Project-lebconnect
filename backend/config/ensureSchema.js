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
        'application','message','system','post','follow',
        'interview','job_alert','verification','report'
      ) NOT NULL
    `);
  } catch (err) {
    const m = `${err.sqlMessage || err.message || ""}`;
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
    await query(`ALTER TABLE users ADD COLUMN cv_analysis LONGTEXT NULL`);
  } catch (err) {
    const m = `${err.sqlMessage || err.message || ""}`;
    if (!/Duplicate column name/i.test(m)) {
      console.warn("[ensureSchema] users.cv_analysis:", m);
    }
  }
  try {
    await query(
      `ALTER TABLE users ADD COLUMN cv_analysis_updated_at DATETIME NULL AFTER cv_analysis`
    );
  } catch (err) {
    const m = `${err.sqlMessage || err.message || ""}`;
    if (!/Duplicate column name/i.test(m)) {
      console.warn("[ensureSchema] users.cv_analysis_updated_at:", m);
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
    const dbRows = await query(`SELECT DATABASE() AS db`);
    const schema = dbRows[0]?.db;
    if (!schema) {
      console.warn("[ensureSchema] posts fk_posts_job: skip (could not read DATABASE())");
    } else {
      const byName = await query(
        `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
         WHERE CONSTRAINT_SCHEMA = ?
           AND TABLE_NAME = 'posts'
           AND CONSTRAINT_TYPE = 'FOREIGN KEY'
           AND CONSTRAINT_NAME = 'fk_posts_job'`,
        [schema]
      );
      if (byName.length > 0) {
        console.log("[ensureSchema] posts fk_posts_job: skipped (constraint already exists)");
      } else {
        const jobColFks = await query(
          `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
           WHERE TABLE_SCHEMA = ?
             AND TABLE_NAME = 'posts'
             AND COLUMN_NAME = 'job_id'
             AND REFERENCED_TABLE_NAME IS NOT NULL`,
          [schema]
        );
        if (jobColFks.length > 0) {
          const names = jobColFks.map((r) => r.CONSTRAINT_NAME).join(", ");
          console.log(
            `[ensureSchema] posts fk_posts_job: skipped (job_id already referenced by FK: ${names})`
          );
        } else {
          await query(`
            ALTER TABLE posts
            ADD CONSTRAINT fk_posts_job FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE SET NULL
          `);
          console.log("[ensureSchema] posts fk_posts_job: added missing FK");
        }
      }
    }
  } catch (err) {
    const m = `${err.sqlMessage || err.message || ""}`;
    const errno = err.errno ?? err.code;
    if (
      errno === 121 ||
      errno === 1022 ||
      /Duplicate key on write or update/i.test(m) ||
      /Duplicate foreign key constraint name/i.test(m) ||
      /already exists/i.test(m) ||
      /Duplicate key name/i.test(m)
    ) {
      console.log("[ensureSchema] posts fk_posts_job: skipped (MySQL duplicate constraint/index)");
    } else {
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

  try {
    await query(
      `ALTER TABLE users ADD COLUMN is_verified TINYINT(1) NOT NULL DEFAULT 0 AFTER cover_image`
    );
  } catch (err) {
    const m = `${err.sqlMessage || err.message || ""}`;
    if (!/Duplicate column name/i.test(m)) {
      console.warn("[ensureSchema] users.is_verified:", m);
    }
  }

  try {
    await query(
      `ALTER TABLE applications ADD COLUMN stage VARCHAR(50) NOT NULL DEFAULT 'applied' AFTER status`
    );
  } catch (err) {
    const m = `${err.sqlMessage || err.message || ""}`;
    if (!/Duplicate column name/i.test(m)) {
      console.warn("[ensureSchema] applications.stage:", m);
    }
  }
  try {
    await query(
      `ALTER TABLE applications ADD COLUMN viewed_at DATETIME NULL AFTER stage`
    );
  } catch (err) {
    const m = `${err.sqlMessage || err.message || ""}`;
    if (!/Duplicate column name/i.test(m)) {
      console.warn("[ensureSchema] applications.viewed_at:", m);
    }
  }
  try {
    await query(
      `ALTER TABLE applications ADD COLUMN interview_date DATETIME NULL AFTER viewed_at`
    );
  } catch (err) {
    const m = `${err.sqlMessage || err.message || ""}`;
    if (!/Duplicate column name/i.test(m)) {
      console.warn("[ensureSchema] applications.interview_date:", m);
    }
  }
  try {
    await query(
      `ALTER TABLE applications ADD COLUMN interview_location TEXT NULL AFTER interview_date`
    );
  } catch (err) {
    const m = `${err.sqlMessage || err.message || ""}`;
    if (!/Duplicate column name/i.test(m)) {
      console.warn("[ensureSchema] applications.interview_location:", m);
    }
  }
  try {
    await query(
      `ALTER TABLE applications ADD COLUMN interview_mode VARCHAR(50) NULL AFTER interview_location`
    );
  } catch (err) {
    const m = `${err.sqlMessage || err.message || ""}`;
    if (!/Duplicate column name/i.test(m)) {
      console.warn("[ensureSchema] applications.interview_mode:", m);
    }
  }

  try {
    await query(`UPDATE applications SET stage = 'applied' WHERE stage IS NULL OR TRIM(stage) = ''`);
  } catch (err) {
    console.warn("[ensureSchema] applications stage backfill:", err.message || err);
  }

  await query(`
    CREATE TABLE IF NOT EXISTS interviews (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      application_id INT UNSIGNED NOT NULL,
      candidate_id INT UNSIGNED NOT NULL,
      company_id INT UNSIGNED NOT NULL,
      job_id INT UNSIGNED NOT NULL,
      scheduled_at DATETIME NOT NULL,
      mode ENUM('online','office') NOT NULL DEFAULT 'online',
      location_or_link TEXT,
      message TEXT,
      status ENUM('scheduled','cancelled','completed') NOT NULL DEFAULT 'scheduled',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_interviews_app (application_id),
      KEY idx_interviews_cand (candidate_id),
      KEY idx_interviews_co (company_id),
      CONSTRAINT fk_interviews_app FOREIGN KEY (application_id) REFERENCES applications (id) ON DELETE CASCADE,
      CONSTRAINT fk_interviews_cand FOREIGN KEY (candidate_id) REFERENCES users (id) ON DELETE CASCADE,
      CONSTRAINT fk_interviews_co FOREIGN KEY (company_id) REFERENCES users (id) ON DELETE CASCADE,
      CONSTRAINT fk_interviews_job FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS projects (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      link VARCHAR(1024) DEFAULT NULL,
      image LONGTEXT NULL,
      technologies TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_projects_user (user_id),
      CONSTRAINT fk_projects_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS saved_searches (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      name VARCHAR(255) NOT NULL,
      keyword VARCHAR(512) DEFAULT NULL,
      location VARCHAR(255) DEFAULT NULL,
      type VARCHAR(128) DEFAULT NULL,
      field VARCHAR(255) DEFAULT NULL,
      salary VARCHAR(255) DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_ss_user (user_id),
      CONSTRAINT fk_ss_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS reports (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      reporter_id INT UNSIGNED NOT NULL,
      target_type ENUM('post','user','job','company') NOT NULL,
      target_id INT UNSIGNED NOT NULL,
      reason TEXT NOT NULL,
      status ENUM('open','reviewing','resolved') NOT NULL DEFAULT 'open',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_reports_status (status),
      CONSTRAINT fk_reports_reporter FOREIGN KEY (reporter_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS company_reviews (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id INT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      rating TINYINT UNSIGNED NOT NULL,
      title VARCHAR(255) NOT NULL,
      comment TEXT NOT NULL,
      interview_experience TEXT DEFAULT NULL,
      status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_crev_company (company_id),
      KEY idx_crev_user (user_id),
      UNIQUE KEY uq_crev_company_user (company_id, user_id),
      CONSTRAINT fk_crev_company FOREIGN KEY (company_id) REFERENCES users (id) ON DELETE CASCADE,
      CONSTRAINT fk_crev_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);

  try {
    await query(
      `ALTER TABLE users ADD COLUMN candidate_cv LONGTEXT NULL AFTER experience`
    );
  } catch (err) {
    const m = `${err.sqlMessage || err.message || ""}`;
    if (!/Duplicate column name/i.test(m)) {
      console.warn("[ensureSchema] users.candidate_cv:", m);
    }
  }
  try {
    await query(
      `ALTER TABLE users ADD COLUMN candidate_cv_file_name VARCHAR(255) NULL AFTER candidate_cv`
    );
  } catch (err) {
    const m = `${err.sqlMessage || err.message || ""}`;
    if (!/Duplicate column name/i.test(m)) {
      console.warn("[ensureSchema] users.candidate_cv_file_name:", m);
    }
  }
  try {
    await query(
      `ALTER TABLE users ADD COLUMN candidate_cv_text LONGTEXT NULL AFTER candidate_cv_file_name`
    );
  } catch (err) {
    const m = `${err.sqlMessage || err.message || ""}`;
    if (!/Duplicate column name/i.test(m)) {
      console.warn("[ensureSchema] users.candidate_cv_text:", m);
    }
  }

  try {
    await query(
      `ALTER TABLE saved_searches ADD COLUMN sort VARCHAR(64) NULL DEFAULT NULL AFTER salary`
    );
  } catch (err) {
    const m = `${err.sqlMessage || err.message || ""}`;
    if (!/Duplicate column name/i.test(m)) {
      console.warn("[ensureSchema] saved_searches.sort:", m);
    }
  }
  try {
    await query(
      `ALTER TABLE saved_searches ADD COLUMN alert_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER sort`
    );
  } catch (err) {
    const m = `${err.sqlMessage || err.message || ""}`;
    if (!/Duplicate column name/i.test(m)) {
      console.warn("[ensureSchema] saved_searches.alert_enabled:", m);
    }
  }
}

module.exports = { ensureSchema };
