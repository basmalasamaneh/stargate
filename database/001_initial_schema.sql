-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. CATEGORIES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(100) NOT NULL UNIQUE,
  slug        VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  icon        VARCHAR(50),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── 2. USERS ────────────────────────────────────────────────────
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
  is_featured   BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── 3. PRODUCTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id           UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_id    UUID           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id  UUID           REFERENCES categories(id) ON DELETE SET NULL,
  title        VARCHAR(255)   NOT NULL,
  description  TEXT           NOT NULL,
  price        DECIMAL(10,2)  NOT NULL CHECK (price > 0),
  stock        INTEGER        NOT NULL DEFAULT 1 CHECK (stock >= 0),
  images       TEXT[]         NOT NULL DEFAULT '{}',
  dimensions   VARCHAR(100),
  year_created INTEGER,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ── 4. CARTS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carts (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 5. CART_ITEMS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cart_items (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  cart_id    UUID        NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity   INTEGER     NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cart_id, product_id)
);

-- ── 6. PAYMENT_SOURCES ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_sources (
  id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         VARCHAR(30)  NOT NULL CHECK (type IN ('card', 'cash_on_delivery')),
  -- Card-only fields (NULL when type = 'cash_on_delivery')
  card_last4   VARCHAR(4),
  card_brand   VARCHAR(20),
  card_holder  VARCHAR(255),
  expiry_month INTEGER      CHECK (expiry_month BETWEEN 1 AND 12),
  expiry_year  INTEGER,
  is_default   BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  -- Ensure card fields are only populated for card type
  CONSTRAINT chk_card_fields CHECK (
    type = 'card' OR (
      card_last4   IS NULL AND
      card_brand   IS NULL AND
      card_holder  IS NULL AND
      expiry_month IS NULL AND
      expiry_year  IS NULL
    )
  )
);

-- ── 7. ORDERS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID          REFERENCES users(id) ON DELETE SET NULL,
  payment_source_id UUID          REFERENCES payment_sources(id) ON DELETE SET NULL,
  first_name        VARCHAR(255)  NOT NULL CHECK (LENGTH(TRIM(first_name)) >= 2),
  last_name         VARCHAR(255)  NOT NULL CHECK (LENGTH(TRIM(last_name))  >= 2),
  email             VARCHAR(255)  NOT NULL,
  phone             VARCHAR(50)   NOT NULL,
  address           TEXT          NOT NULL,
  city              VARCHAR(100)  NOT NULL,
  postal_code       VARCHAR(20),
  country           VARCHAR(100)  NOT NULL DEFAULT 'Palestine',
  notes             TEXT,
  total_amount      DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
  status            VARCHAR(20)   NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','processing','completed','cancelled')),
  payment_status    VARCHAR(20)   NOT NULL DEFAULT 'pending'
                      CHECK (payment_status IN ('pending','paid','failed','refunded')),
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── 8. ORDER_ITEMS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      UUID          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id    UUID          REFERENCES products(id) ON DELETE SET NULL,
  artist_id     UUID          REFERENCES users(id) ON DELETE SET NULL,
  product_title VARCHAR(255)  NOT NULL,
  product_image VARCHAR(500),
  quantity      INTEGER       NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price    DECIMAL(10,2) NOT NULL CHECK (unit_price > 0),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── 9. PAYMENTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id          UUID          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id           UUID          REFERENCES users(id) ON DELETE SET NULL,
  payment_source_id UUID          REFERENCES payment_sources(id) ON DELETE SET NULL,
  amount            DECIMAL(10,2) NOT NULL,
  currency          VARCHAR(10)   NOT NULL DEFAULT 'ILS',
  status            VARCHAR(20)   NOT NULL DEFAULT 'succeeded'
                      CHECK (status IN ('pending','succeeded','failed','refunded')),
  mock_payment_id   VARCHAR(100),
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_products_artist    ON products(artist_id);
CREATE INDEX IF NOT EXISTS idx_products_category  ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_price     ON products(price);
CREATE INDEX IF NOT EXISTS idx_carts_user         ON carts(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart    ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product ON cart_items(product_id);
CREATE INDEX IF NOT EXISTS idx_pay_src_user       ON payment_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_user        ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status      ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order  ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_artist ON order_items(artist_id);
CREATE INDEX IF NOT EXISTS idx_payments_order     ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_users_role         ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_featured     ON users(is_featured);


CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at      ON users;
DROP TRIGGER IF EXISTS trg_products_updated_at   ON products;
DROP TRIGGER IF EXISTS trg_carts_updated_at      ON carts;
DROP TRIGGER IF EXISTS trg_cart_items_updated_at ON cart_items;
DROP TRIGGER IF EXISTS trg_orders_updated_at     ON orders;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_carts_updated_at
  BEFORE UPDATE ON carts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_cart_items_updated_at
  BEFORE UPDATE ON cart_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


CREATE OR REPLACE FUNCTION add_to_cart(
  p_user_id    UUID,
  p_product_id UUID,
  p_quantity   INTEGER DEFAULT 1
)
RETURNS cart_items AS $$
DECLARE
  v_cart_id UUID;
  v_result  cart_items;
BEGIN
  INSERT INTO carts (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT id INTO v_cart_id
  FROM carts
  WHERE user_id = p_user_id;

  INSERT INTO cart_items (cart_id, product_id, quantity)
  VALUES (v_cart_id, p_product_id, p_quantity)
  ON CONFLICT (cart_id, product_id)
  DO UPDATE SET
    quantity   = cart_items.quantity + EXCLUDED.quantity,
    updated_at = NOW()
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;