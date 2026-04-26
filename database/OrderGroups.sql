-- ============================================================
-- Migration: Add Parent/Child Order System
-- ============================================================

CREATE TABLE IF NOT EXISTS order_groups (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id),
  total_price  DECIMAL(10, 2) NOT NULL,
  status       order_status NOT NULL DEFAULT 'pending',
  shipping_address TEXT NOT NULL,
  shipping_city    TEXT NOT NULL,
  shipping_phone   TEXT NOT NULL,
  shipping_name    TEXT NOT NULL,
  shipping_fee     DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Link orders to order_groups
ALTER TABLE orders ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES order_groups(id) ON DELETE SET NULL;

-- Update updated_at trigger for order_groups
DROP TRIGGER IF EXISTS trg_order_groups_updated_at ON order_groups;
CREATE TRIGGER trg_order_groups_updated_at BEFORE UPDATE ON order_groups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add index for group_id
CREATE INDEX IF NOT EXISTS idx_orders_group_id ON orders(group_id);

-- Fallback for existing installations
ALTER TABLE order_groups ADD COLUMN IF NOT EXISTS shipping_fee DECIMAL(10, 2) NOT NULL DEFAULT 0;
