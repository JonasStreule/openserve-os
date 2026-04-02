-- Foodtruck "Street Bites" demo users (PIN: 0101)
INSERT INTO users (username, pin_hash, role) VALUES
  ('Kai',  '$2b$10$3cihOI4mBA1wMP72Qegg4ed0ohC0R1CTllQ6RJY1/PUwAfO8o2IyO', 'service'),
  ('Sam',  '$2b$10$T61OsUEi9H3IwGsv6eP1Geve2dxddxOA08S8XjZiDzCCbDIvJPOKK', 'admin')
ON CONFLICT DO NOTHING;

-- Foodtruck tables / counter spots
INSERT INTO tables (table_number, qr_token, capacity) VALUES
  ('Counter-1', 'table-C1-ft001aaa', 1),
  ('Counter-2', 'table-C2-ft002bbb', 1),
  ('Outdoor-1', 'table-O1-ft003ccc', 4),
  ('Outdoor-2', 'table-O2-ft004ddd', 4),
  ('Outdoor-3', 'table-O3-ft005eee', 6)
ON CONFLICT (table_number) DO NOTHING;

-- Foodtruck menu (short, casual)
INSERT INTO products (name, category, price) VALUES
  ('Classic Burger',        'Burger',   13.50),
  ('Cheeseburger',          'Burger',   14.50),
  ('BBQ Bacon Burger',      'Burger',   16.00),
  ('Veggie Burger',         'Burger',   13.00),
  ('Chicken Wrap',          'Wraps',    12.50),
  ('Falafel Wrap',          'Wraps',    11.50),
  ('Pommes Frites',         'Beilagen',  5.00),
  ('Süsskartoffel Frites',  'Beilagen',  6.00),
  ('Onion Rings',           'Beilagen',  5.50),
  ('Cola',                  'Getränke',  3.50),
  ('Bier',                  'Getränke',  5.00),
  ('Lemonade',              'Getränke',  4.00),
  ('Wasser',                'Getränke',  2.50)
ON CONFLICT DO NOTHING;
