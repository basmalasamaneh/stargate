-- ============================================================
-- FILE: CreateArtworkSystem.sql
-- DESC: Complete artwork system with all tables in one file
-- ============================================================

-- Enums
CREATE TYPE artwork_status AS ENUM ('available', 'sold', 'reserved');
CREATE TYPE artwork_category AS ENUM (
  'لوحات فنية',
  'تطريز فلسطيني', 
  'خزف وفخار',
  'خط عربي',
  'تصوير فوتوغرافي',
  'نحت ومجسمات'
);

-- Artworks table
CREATE TABLE IF NOT EXISTS artworks (
  id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  title           VARCHAR(255) NOT NULL CHECK (LENGTH(TRIM(title)) >= 2),
  description     TEXT         NOT NULL CHECK (LENGTH(TRIM(description)) >= 10),
  category        artwork_category NOT NULL,
  artist_id       UUID         NOT NULL REFERENCES users(id),
  price           DECIMAL(10,2) NOT NULL CHECK (price > 0),
  quantity        INTEGER      NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  status          artwork_status NOT NULL DEFAULT 'available',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  
  -- Ensure only artists can have artworks
  CONSTRAINT chk_artist_role CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = artist_id AND role = 'artist')
  )
);

-- Artwork images table
CREATE TABLE IF NOT EXISTS artwork_images (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  artwork_id  UUID         NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  filename    VARCHAR(255) NOT NULL UNIQUE, -- Unique filename for storage
  alt_text    TEXT,
  is_featured  BOOLEAN      NOT NULL DEFAULT FALSE,
  sort_order  INTEGER      NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_artworks_artist_id ON artworks(artist_id);
CREATE INDEX IF NOT EXISTS idx_artworks_category ON artworks(category);
CREATE INDEX IF NOT EXISTS idx_artworks_status ON artworks(status);
CREATE INDEX IF NOT EXISTS idx_artwork_images_artwork_id ON artwork_images(artwork_id);

-- Ensure only one primary image per artwork
CREATE UNIQUE INDEX IF NOT EXISTS uq_artwork_primary_image 
  ON artwork_images(artwork_id) 
  WHERE is_primary = TRUE;

-- Auto-update updated_at trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_artworks_updated_at ON artworks;
CREATE TRIGGER trg_artworks_updated_at
  BEFORE UPDATE ON artworks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to validate image count constraints
CREATE OR REPLACE FUNCTION validate_artwork_image_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if artwork would exceed 5 images after this insert
  IF TG_OP = 'INSERT' THEN
    IF (
      SELECT COUNT(*) 
      FROM artwork_images 
      WHERE artwork_id = NEW.artwork_id
    ) >= 5 THEN
      RAISE EXCEPTION 'Artwork cannot have more than 5 images';
    END IF;
  END IF;
  
  -- Check if artwork would have 0 images after this delete
  IF TG_OP = 'DELETE' THEN
    IF (
      SELECT COUNT(*) 
      FROM artwork_images 
      WHERE artwork_id = OLD.artwork_id
    ) <= 1 THEN
      RAISE EXCEPTION 'Artwork must have at least 1 image';
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers for image count validation
DROP TRIGGER IF EXISTS trg_artwork_images_insert ON artwork_images;
CREATE TRIGGER trg_artwork_images_insert
  BEFORE INSERT ON artwork_images
  FOR EACH ROW EXECUTE FUNCTION validate_artwork_image_count();

DROP TRIGGER IF EXISTS trg_artwork_images_delete ON artwork_images;
CREATE TRIGGER trg_artwork_images_delete
  BEFORE DELETE ON artwork_images
  FOR EACH ROW EXECUTE FUNCTION validate_artwork_image_count();

