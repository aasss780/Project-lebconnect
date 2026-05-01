-- Run if an existing DB was created before follows + notification type 'follow'.

USE lebconnect;

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
) ENGINE=InnoDB;

ALTER TABLE notifications
  MODIFY COLUMN type ENUM(
    'application','message','system','post','follow'
  ) NOT NULL;
