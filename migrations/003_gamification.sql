-- Staff performance tracking
CREATE TABLE staff_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  username VARCHAR(100) NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  orders_served INTEGER NOT NULL DEFAULT 0,
  tips_earned NUMERIC(10, 2) NOT NULL DEFAULT 0,
  avg_service_time INTEGER DEFAULT 0,
  period VARCHAR(20) NOT NULL DEFAULT 'daily',
  period_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(username, period, period_date)
);

-- Add server/staff reference to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS served_by VARCHAR(100);

CREATE INDEX idx_staff_scores_period ON staff_scores(period, period_date);
CREATE INDEX idx_staff_scores_points ON staff_scores(points DESC);
