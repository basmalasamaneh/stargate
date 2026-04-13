-- ============================================================
-- FILE: CreateArtworkSystem.sql
-- DESC: Complete artwork system with all tables in one file
-- ============================================================

-- ── Enums ────────────────────────────────────────────────────
CREATE TYPE artwork_status AS ENUM ('available', 'sold', 'reserved');
CREATE TYPE artwork_category AS ENUM (
  'لوحات فنية',
  'تطريز فلسطيني',
  'خزف وفخار',
  'خط عربي',
  'تصوير فوتوغرافي',
  'نحت ومجسمات'
);

-- ── Artworks table ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS artworks (
  id          UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       VARCHAR(255)      NOT NULL CHECK (LENGTH(TRIM(title)) >= 2),
  description TEXT              NOT NULL CHECK (LENGTH(TRIM(description)) >= 10),
  category    artwork_category  NOT NULL,
  artist_id   UUID              NOT NULL REFERENCES users(id),
  price       DECIMAL(10,2)     NOT NULL CHECK (price > 0),
  quantity    INTEGER           NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  status      artwork_status    NOT NULL DEFAULT 'available',
  is_active   BOOLEAN           NOT NULL DEFAULT TRUE,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

-- ── Backward-compatible migration (is_deleted -> is_active) ──
ALTER TABLE public.artworks
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'artworks'
      AND column_name = 'is_deleted'
  ) THEN
    UPDATE public.artworks
    SET is_active = NOT is_deleted
    WHERE is_active IS NULL;
  END IF;
END $$;

UPDATE public.artworks
SET is_active = TRUE
WHERE is_active IS NULL;
 
ALTER TABLE public.artworks
  ALTER COLUMN is_active SET DEFAULT TRUE,
  ALTER COLUMN is_active SET NOT NULL;

DROP INDEX IF EXISTS public.idx_artworks_is_deleted;
ALTER TABLE public.artworks
  DROP COLUMN IF EXISTS is_deleted;

-- ── Trigger to enforce artist_id must be an artist ───────────
-- (replaces the invalid subquery CHECK constraint)
CREATE OR REPLACE FUNCTION validate_artwork_artist()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.artist_id AND role = 'artist') THEN
    RAISE EXCEPTION 'artist_id must reference a user with role = artist';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_artwork_artist ON artworks;
CREATE TRIGGER trg_validate_artwork_artist
  BEFORE INSERT OR UPDATE ON artworks
  FOR EACH ROW EXECUTE FUNCTION validate_artwork_artist();

-- ── Artwork images table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS artwork_images (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  artwork_id  UUID         NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  filename    VARCHAR(255) NOT NULL UNIQUE,
  alt_text    TEXT,
  is_featured BOOLEAN      NOT NULL DEFAULT FALSE,
  sort_order  INTEGER      NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_artworks_artist_id ON artworks(artist_id);
CREATE INDEX IF NOT EXISTS idx_artworks_category ON artworks(category);
CREATE INDEX IF NOT EXISTS idx_artworks_status ON artworks(status);
CREATE INDEX IF NOT EXISTS idx_artworks_is_active ON artworks(is_active);
CREATE INDEX IF NOT EXISTS idx_artwork_images_artwork_id ON artwork_images(artwork_id);

-- FIX: was is_primary (wrong), correct column is is_featured
CREATE UNIQUE INDEX IF NOT EXISTS uq_artwork_primary_image
  ON artwork_images(artwork_id)
  WHERE is_featured = TRUE;

-- ── Auto-update updated_at ───────────────────────────────────
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

-- ── Image count validation ───────────────────────────────────
CREATE OR REPLACE FUNCTION validate_artwork_image_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF (SELECT COUNT(*) FROM artwork_images WHERE artwork_id = NEW.artwork_id) >= 5 THEN
      RAISE EXCEPTION 'لا يمكن أن يحتوي العمل الفني على أكثر من 5 صور';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF (SELECT COUNT(*) FROM artwork_images WHERE artwork_id = OLD.artwork_id) < 1 THEN
      RAISE EXCEPTION 'يجب أن يحتوي العمل الفني على صورة واحدة على الأقل';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_artwork_images_insert ON artwork_images;
CREATE TRIGGER trg_artwork_images_insert
  BEFORE INSERT ON artwork_images
  FOR EACH ROW EXECUTE FUNCTION validate_artwork_image_count();

DROP TRIGGER IF EXISTS trg_artwork_images_delete ON artwork_images;
CREATE TRIGGER trg_artwork_images_delete
  BEFORE DELETE ON artwork_images
  FOR EACH ROW EXECUTE FUNCTION validate_artwork_image_count();