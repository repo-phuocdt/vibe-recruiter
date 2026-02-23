-- Add authentication fields for JWT-based auth
ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free';
