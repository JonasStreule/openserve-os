-- Task Pool System
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL DEFAULT 'general',  -- cleaning, restock, setup, custom
  priority VARCHAR(20) NOT NULL DEFAULT 'normal',     -- low, normal, high, urgent
  points INTEGER NOT NULL DEFAULT 1,                   -- points earned on completion
  status VARCHAR(20) NOT NULL DEFAULT 'open',          -- open, claimed, done, cancelled
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,  -- NULL = pool task, set = assigned
  claimed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_by TIMESTAMPTZ,  -- optional deadline
  recurring BOOLEAN NOT NULL DEFAULT false,
  recurring_interval VARCHAR(20)  -- 'daily', 'hourly', etc.
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);

-- Seed some example tasks
INSERT INTO tasks (title, category, priority, points) VALUES
  ('Tisch T-3 abwischen', 'cleaning', 'normal', 1),
  ('Besteck nachfüllen', 'restock', 'normal', 1),
  ('Servietten auffüllen', 'restock', 'low', 1),
  ('Aussenbereich kehren', 'cleaning', 'normal', 2),
  ('Getränkekühlschrank auffüllen', 'restock', 'high', 3),
  ('Salat-Bar nachfüllen', 'restock', 'urgent', 3),
  ('Toiletten kontrollieren', 'cleaning', 'normal', 2),
  ('Gläser polieren (20 Stk)', 'setup', 'low', 2);
