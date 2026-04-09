-- Add UNIQUE constraint on username to prevent duplicates
-- Using a unique index (idempotent with IF NOT EXISTS)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique ON users (username);

-- Add missing indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments (created_at);
CREATE INDEX IF NOT EXISTS idx_payments_method ON payments (method);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_status ON cash_sessions (status);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events (created_at);
