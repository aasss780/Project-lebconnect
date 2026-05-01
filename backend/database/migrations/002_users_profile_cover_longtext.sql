-- Safe to run on existing DBs: widens avatar/cover payloads (e.g. base64 data URLs).
-- Idempotent MODIFIES; adjust if your MySQL version rejects duplicate MODIFY.

ALTER TABLE users MODIFY COLUMN profile_image LONGTEXT NULL;
ALTER TABLE users MODIFY COLUMN cover_image LONGTEXT NULL;
