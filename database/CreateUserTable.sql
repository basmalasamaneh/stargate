-- MIGRATION: Create users table 
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name    VARCHAR(255) NOT NULL CHECK (LENGTH(TRIM(first_name)) >= 2),
  last_name     VARCHAR(255) NOT NULL CHECK (LENGTH(TRIM(last_name))  >= 2),
  role          VARCHAR(20)  NOT NULL DEFAULT 'user'
                  CHECK (role IN ('user', 'artist')),
  bio           TEXT,
  profile_image VARCHAR(500),
  location      VARCHAR(255),
  phone         VARCHAR(50),
  instagram     VARCHAR(255),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role     ON users(role);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();