-- ============================================================
-- FILE: CreateUserTable.sql
-- DESC: Create users table with role-based constraints
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(255) NOT NULL UNIQUE,
  password      VARCHAR(255) NOT NULL,
  first_name    VARCHAR(255) NOT NULL CHECK (LENGTH(TRIM(first_name)) >= 2),
  last_name     VARCHAR(255) NOT NULL CHECK (LENGTH(TRIM(last_name))  >= 2),
  role          VARCHAR(20)  NOT NULL DEFAULT 'user'
                  CHECK (role IN ('user', 'artist')),
  artist_name   VARCHAR(255),
  bio           TEXT,
  location      VARCHAR(255),
  phone         VARCHAR(50),
  social_media  JSONB,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- Constraints for artist role
  CHECK (role != 'artist' OR (artist_name IS NOT NULL AND LENGTH(TRIM(artist_name)) >= 3)),
  CHECK (role != 'artist' OR (bio IS NOT NULL AND LENGTH(TRIM(bio)) >= 20)),
  CHECK (role != 'artist' OR (location IS NOT NULL AND LENGTH(TRIM(location)) >= 3)),
  CHECK (role != 'artist' OR (phone IS NOT NULL AND phone ~ '^\d{10}$'))
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ── Auto-update updated_at ───────────────────────────────────
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

  