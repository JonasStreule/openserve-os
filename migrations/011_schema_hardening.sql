-- Schema hardening: indexes, constraints, consistency fixes

-- 1. Missing indexes for frequent lookups
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_staff_scores_user_id ON staff_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_payment_id ON cash_transactions(payment_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_tasks_claimed_by ON tasks(claimed_by);

-- 2. NOT NULL constraints on critical columns
ALTER TABLE users ALTER COLUMN username SET NOT NULL;
ALTER TABLE users ALTER COLUMN pin_hash SET NOT NULL;

-- 3. Default for products.category (code already defaults to 'Uncategorized')
ALTER TABLE products ALTER COLUMN category SET DEFAULT 'Uncategorized';
UPDATE products SET category = 'Uncategorized' WHERE category IS NULL;
ALTER TABLE products ALTER COLUMN category SET NOT NULL;

-- 4. Standardize timestamps to TIMESTAMPTZ for timezone safety
-- (ALTER TYPE is safe — PostgreSQL handles the conversion automatically)
ALTER TABLE orders ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE orders ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';
ALTER TABLE order_items ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE users ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE products ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE audit_events ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE payments ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE cash_sessions ALTER COLUMN opened_at TYPE TIMESTAMPTZ USING opened_at AT TIME ZONE 'UTC';
ALTER TABLE cash_sessions ALTER COLUMN closed_at TYPE TIMESTAMPTZ USING closed_at AT TIME ZONE 'UTC';
ALTER TABLE cash_transactions ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE staff_scores ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE tables ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
