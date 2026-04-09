-- ============================================================
-- Station Routing: order numbers + product stations + item-level status
-- ============================================================

-- 1. Add station field to products (kitchen, bar, or direct)
ALTER TABLE products ADD COLUMN IF NOT EXISTS station VARCHAR(20) DEFAULT 'kitchen';

-- 2. Add daily order number to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number INTEGER;

-- 3. Index for fast daily order number lookup
CREATE INDEX IF NOT EXISTS idx_orders_created_at_order_number
  ON orders (created_at DESC, order_number);

-- 4. Index for item-level status queries
CREATE INDEX IF NOT EXISTS idx_order_items_status ON order_items (status);

-- 5. Add station snapshot to order_items (so display knows which station owns the item)
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS station VARCHAR(20) DEFAULT 'kitchen';

-- 6. Auto-assign stations based on existing categories (best guess)
-- Drinks → bar, everything else → kitchen
UPDATE products SET station = 'bar'
  WHERE LOWER(category) IN ('getränke', 'drinks', 'beverages', 'bier', 'wein', 'cocktails', 'softdrinks', 'heissgetränke', 'kaltgetränke');
UPDATE products SET station = 'kitchen'
  WHERE station IS NULL OR station = 'kitchen';
