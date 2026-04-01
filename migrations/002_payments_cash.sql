-- Payments table
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  method VARCHAR(20) NOT NULL CHECK (method IN ('cash', 'card', 'twint')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'refunded', 'failed')),
  idempotency_key VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Cash register sessions
CREATE TABLE cash_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  opened_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP,
  opening_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  closing_amount NUMERIC(10, 2),
  expected_amount NUMERIC(10, 2),
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  notes TEXT
);

-- Cash transactions within a session
CREATE TABLE cash_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES cash_sessions(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('sale', 'refund', 'tip', 'adjustment')),
  amount NUMERIC(10, 2) NOT NULL,
  payment_id UUID REFERENCES payments(id),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add tip column to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tip_amount NUMERIC(10, 2) DEFAULT 0;

-- Index for fast payment lookups
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_idempotency ON payments(idempotency_key);
CREATE INDEX idx_cash_transactions_session ON cash_transactions(session_id);
