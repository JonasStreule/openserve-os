-- Default admin user (PIN: 0000)
INSERT INTO users (username, pin_hash, role) VALUES
  ('Admin', '$2b$10$Jim3Pe10N6NlZxsQOpeS7ONa/0.Siw1s.gcZaeAk8G/eBAgRPZzmu', 'admin')
ON CONFLICT DO NOTHING;

-- Default staff (PIN: 1234)
INSERT INTO users (username, pin_hash, role) VALUES
  ('Anna', '$2b$10$lcJRcrr1eDX0oVHoNhrMTOTfmkL4nCvQuUBAaxuMAL6YpKo4dJIf2', 'service'),
  ('Marco', '$2b$10$lcJRcrr1eDX0oVHoNhrMTOTfmkL4nCvQuUBAaxuMAL6YpKo4dJIf2', 'service'),
  ('Luca', '$2b$10$lcJRcrr1eDX0oVHoNhrMTOTfmkL4nCvQuUBAaxuMAL6YpKo4dJIf2', 'kitchen')
ON CONFLICT DO NOTHING;

-- Restaurant tables
INSERT INTO tables (table_number, qr_token, capacity) VALUES
  ('T-1', 'table-T1-a1b2c3d4', 2),
  ('T-2', 'table-T2-e5f6g7h8', 4),
  ('T-3', 'table-T3-i9j0k1l2', 4),
  ('T-4', 'table-T4-m3n4o5p6', 6),
  ('T-5', 'table-T5-q7r8s9t0', 6),
  ('T-6', 'table-T6-u1v2w3x4', 8),
  ('Bar-1', 'table-Bar1-y5z6a7b8', 1),
  ('Bar-2', 'table-Bar2-c9d0e1f2', 1),
  ('Terrasse-1', 'table-Ter1-g3h4i5j6', 4),
  ('Terrasse-2', 'table-Ter2-k7l8m9n0', 6)
ON CONFLICT (table_number) DO NOTHING;

-- Menu products
INSERT INTO products (name, category, price) VALUES
  ('Pizza Margherita', 'Pizza', 16.50),
  ('Pizza Quattro Formaggi', 'Pizza', 19.00),
  ('Pizza Prosciutto', 'Pizza', 18.50),
  ('Pasta Carbonara', 'Pasta', 17.00),
  ('Pasta Bolognese', 'Pasta', 16.00),
  ('Pasta Aglio e Olio', 'Pasta', 14.50),
  ('Risotto ai Funghi', 'Risotto', 18.00),
  ('Bruschetta', 'Vorspeisen', 9.50),
  ('Caprese Salat', 'Vorspeisen', 11.00),
  ('Insalata Mista', 'Salate', 10.50),
  ('Caesar Salad', 'Salate', 13.00),
  ('Rindsfilet', 'Fleisch', 38.00),
  ('Scaloppine', 'Fleisch', 29.00),
  ('Tiramisu', 'Desserts', 9.00),
  ('Panna Cotta', 'Desserts', 8.50),
  ('Gelato (3 Kugeln)', 'Desserts', 7.00),
  ('Espresso', 'Getränke', 4.50),
  ('Cappuccino', 'Getränke', 5.50),
  ('Coca-Cola', 'Getränke', 4.00),
  ('Mineralwasser', 'Getränke', 3.50),
  ('Hauswein rot (1dl)', 'Getränke', 6.00),
  ('Hauswein weiss (1dl)', 'Getränke', 6.00),
  ('Bier vom Fass', 'Getränke', 5.50)
ON CONFLICT DO NOTHING;
