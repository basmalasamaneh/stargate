
INSERT INTO categories (name, slug, description, icon) VALUES
  ('Paintings',   'paintings',   'Original paintings including oil, acrylic, and watercolor', '🎨'),
  ('Embroidery',  'embroidery',  'Traditional Palestinian tatreez embroidery and textile art', '🧵'),
  ('Ceramics',    'ceramics',    'Handcrafted pottery and ceramic artwork',                   '🏺'),
  ('Calligraphy', 'calligraphy', 'Arabic calligraphy and typography art',                    '✒️'),
  ('Photography', 'photography', 'Fine art photography of Palestinian landscapes',            '📷'),
  ('Sculpture',   'sculpture',   'Three-dimensional art in wood, stone, and metal',          '🗿')
ON CONFLICT (slug) DO NOTHING;