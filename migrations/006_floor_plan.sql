-- Floor plan positions and sections
ALTER TABLE tables ADD COLUMN IF NOT EXISTS x_pos INTEGER DEFAULT 10;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS y_pos INTEGER DEFAULT 10;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS section VARCHAR(50) DEFAULT 'Innenraum';

-- Ristorante Mezzaluna layout
UPDATE tables SET x_pos = 8,  y_pos = 10, section = 'Innenraum' WHERE table_number = 'T-1';
UPDATE tables SET x_pos = 24, y_pos = 10, section = 'Innenraum' WHERE table_number = 'T-2';
UPDATE tables SET x_pos = 40, y_pos = 10, section = 'Innenraum' WHERE table_number = 'T-3';
UPDATE tables SET x_pos = 8,  y_pos = 32, section = 'Innenraum' WHERE table_number = 'T-4';
UPDATE tables SET x_pos = 24, y_pos = 32, section = 'Innenraum' WHERE table_number = 'T-5';
UPDATE tables SET x_pos = 40, y_pos = 32, section = 'Innenraum' WHERE table_number = 'T-6';
UPDATE tables SET x_pos = 74, y_pos = 10, section = 'Bar'       WHERE table_number = 'Bar-1';
UPDATE tables SET x_pos = 74, y_pos = 28, section = 'Bar'       WHERE table_number = 'Bar-2';
UPDATE tables SET x_pos = 8,  y_pos = 68, section = 'Terrasse'  WHERE table_number = 'Terrasse-1';
UPDATE tables SET x_pos = 32, y_pos = 68, section = 'Terrasse'  WHERE table_number = 'Terrasse-2';

-- Street Bites layout
UPDATE tables SET x_pos = 38, y_pos = 8,  section = 'Theke'   WHERE table_number = 'Counter-1';
UPDATE tables SET x_pos = 54, y_pos = 8,  section = 'Theke'   WHERE table_number = 'Counter-2';
UPDATE tables SET x_pos = 8,  y_pos = 60, section = 'Outdoor' WHERE table_number = 'Outdoor-1';
UPDATE tables SET x_pos = 30, y_pos = 60, section = 'Outdoor' WHERE table_number = 'Outdoor-2';
UPDATE tables SET x_pos = 55, y_pos = 60, section = 'Outdoor' WHERE table_number = 'Outdoor-3';

-- Station accounts
-- Küche station (PIN: 5555)
INSERT INTO users (username, pin_hash, role) VALUES
  ('Küche', '$2b$10$glzCt89.Tc4.wiDUz4DJ1eR4s7kZpEL5vjQEAedTBgZvC9.5XBd5m', 'kitchen')
ON CONFLICT DO NOTHING;

-- Buffet station (PIN: 6666)
INSERT INTO users (username, pin_hash, role) VALUES
  ('Buffet', '$2b$10$3Zxb9pkkxuMHOTrEkZuetez4v28Nkg7iiS/D8QPeTfl0TSR80NUiK', 'service')
ON CONFLICT DO NOTHING;
