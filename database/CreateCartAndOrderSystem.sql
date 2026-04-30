-- ============================================================
-- FILE: CreateCartAndOrderSystem.sql
-- DESC: Cart and Order system with status workflow
-- ============================================================

-- ── Enums ────────────────────────────────────────────────────
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
        CREATE TYPE order_status AS ENUM (
            'pending',
            'approved',
            'rejected',
            'preparing',
            'shipped',
            'delivered',
            'cancelled'
        );
    END IF;
END $$;

-- ── Carts table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carts (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID          NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── Cart Items table ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cart_items (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  cart_id     UUID          NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  artwork_id  UUID          NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  quantity    INTEGER       NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(cart_id, artwork_id)
);

-- ── Orders table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID          NOT NULL REFERENCES users(id),
  -- artist_id is NULL for parent orders, set for child (per-artist) orders
  artist_id        UUID          REFERENCES users(id),
  -- parent_order_id links a child to its parent; NULL means this IS the parent
  parent_order_id  UUID          REFERENCES orders(id) ON DELETE CASCADE,
  total_price      DECIMAL(10,2) NOT NULL,
  -- shipping_fee is on the parent order only; children use 0
  shipping_fee     DECIMAL(10,2) NOT NULL DEFAULT 0,
  shipping_address TEXT          NOT NULL,
  shipping_city    TEXT          NOT NULL,
  shipping_phone   TEXT          NOT NULL,
  shipping_name    TEXT          NOT NULL DEFAULT '',
  status           order_status  NOT NULL DEFAULT 'pending',
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── Order Items table ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id          UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID           NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  artwork_id  UUID           NOT NULL REFERENCES artworks(id),
  price       DECIMAL(10,2)  NOT NULL CHECK (price >= 0),
  quantity    INTEGER        NOT NULL CHECK (quantity > 0),
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_artist_id ON orders(artist_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_parent_order_id ON orders(parent_order_id);

-- ── Triggers for updated_at ──────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_carts_updated_at ON carts;
CREATE TRIGGER trg_carts_updated_at BEFORE UPDATE ON carts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_cart_items_updated_at ON cart_items;
CREATE TRIGGER trg_cart_items_updated_at BEFORE UPDATE ON cart_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
