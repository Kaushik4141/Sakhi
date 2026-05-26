-- Clear existing data
DELETE FROM products;
DELETE FROM artisans;
DELETE FROM users;

-- Reset sequence counters
UPDATE sqlite_sequence SET seq = 0 WHERE name = 'products';
UPDATE sqlite_sequence SET seq = 0 WHERE name = 'artisans';
UPDATE sqlite_sequence SET seq = 0 WHERE name = 'users';

-- Insert Artisans
INSERT INTO artisans (id, slug, name, bio) VALUES
(1, 'anand-pottery', 'Anand Pottery', 'Traditional terracotta from Rajasthan'),
(2, 'weaver-co', 'The Weaver Co', 'Handloom silk and cotton from Varanasi'),
(3, 'woodcraft-masters', 'Woodcraft Masters', 'Intricate woodwork from Saharanpur'),
(4, 'divine-jewelry', 'Divine Jewelry', 'Handcrafted silver and bead jewelry'),
(5, 'bengal-kantha', 'Bengal Kantha House', 'Authentic Kantha embroidery from West Bengal'),
(6, 'kashmiri-crafts', 'Kashmiri Crafts', 'Pashmina shawls and walnut wood carving'),
(7, 'channapatna-toys', 'Channapatna Toys', 'Traditional wooden toys from Karnataka'),
(8, 'blue-pottery-jaipur', 'Blue Pottery Jaipur', 'Authentic GI verified blue pottery'),
(9, 'bastar-art', 'Bastar Dhokra Art', 'Tribal metal craft from Chhattisgarh'),
(10, 'madhubani-arts', 'Madhubani Arts', 'Traditional paintings from Bihar');

-- Insert Products (25+ products across categories)
INSERT INTO products (artisan_id, name, price, description, image_url, category, is_gi_verified) VALUES
-- Pottery & Ceramics
(1, 'Handpainted Terracotta Vase', 1200, 'A beautiful handpainted terracotta vase with traditional motifs.', 'https://picsum.photos/seed/pottery1/600/600', 'Pottery & Ceramics', 0),
(1, 'Clay Diya Set (12 pcs)', 450, 'Set of 12 traditional clay diyas for festivals.', 'https://picsum.photos/seed/pottery2/600/600', 'Pottery & Ceramics', 0),
(8, 'Jaipur Blue Pottery Plate', 2500, 'Authentic blue pottery decorative wall plate with floral designs.', 'https://picsum.photos/seed/pottery3/600/600', 'Pottery & Ceramics', 1),
(8, 'Blue Pottery Serving Bowl', 1800, 'Large serving bowl crafted in the traditional Jaipur style.', 'https://picsum.photos/seed/pottery4/600/600', 'Pottery & Ceramics', 1),

-- Textiles & Looms
(2, 'Banarasi Silk Saree', 15500, 'Pure handloom Banarasi silk saree with zari work.', 'https://picsum.photos/seed/textile1/600/600', 'Textiles & Looms', 1),
(2, 'Cotton Kurta Fabric', 1200, 'Breathable handwoven cotton fabric for kurtas.', 'https://picsum.photos/seed/textile2/600/600', 'Textiles & Looms', 0),
(5, 'Kantha Stitched Throw', 4500, 'Hand-stitched Kantha throw blanket using recycled cotton.', 'https://picsum.photos/seed/textile3/600/600', 'Textiles & Looms', 1),
(5, 'Kantha Embroidered Dupatta', 2200, 'Vibrant silk dupatta with intricate Kantha embroidery.', 'https://picsum.photos/seed/textile4/600/600', 'Textiles & Looms', 1),
(6, 'Pure Pashmina Shawl', 25000, 'Ultra-soft authentic Pashmina shawl from Kashmir.', 'https://picsum.photos/seed/textile5/600/600', 'Textiles & Looms', 1),

-- Woodwork & Carving
(3, 'Carved Wooden Screen', 18000, 'Intricately carved room divider made from teak wood.', 'https://picsum.photos/seed/wood1/600/600', 'Woodwork & Carving', 0),
(3, 'Wooden Spice Box', 950, 'Traditional round wooden spice box with glass lid.', 'https://picsum.photos/seed/wood2/600/600', 'Woodwork & Carving', 0),
(6, 'Walnut Wood Coffee Table', 32000, 'Hand-carved walnut wood coffee table featuring chinar leaf motifs.', 'https://picsum.photos/seed/wood3/600/600', 'Woodwork & Carving', 1),
(7, 'Channapatna Pull Toy', 450, 'Safe, vegetable-dyed wooden pull toy for toddlers.', 'https://picsum.photos/seed/wood4/600/600', 'Woodwork & Carving', 1),
(7, 'Wooden Abacus', 600, 'Colorful educational wooden abacus made in Channapatna.', 'https://picsum.photos/seed/wood5/600/600', 'Woodwork & Carving', 1),

-- Jewelry
(4, 'Oxidized Silver Necklace', 3500, 'Statement tribal necklace made from oxidized silver.', 'https://picsum.photos/seed/jewel1/600/600', 'Jewelry', 0),
(4, 'Meenakari Jhumkas', 1800, 'Traditional enamelled earrings in vibrant pink and green.', 'https://picsum.photos/seed/jewel2/600/600', 'Jewelry', 0),
(9, 'Dhokra Bell Metal Pendant', 1200, 'Unique tribal pendant cast using the lost-wax technique.', 'https://picsum.photos/seed/jewel3/600/600', 'Jewelry', 1),

-- Home Decor
(9, 'Dhokra Metal Horse', 4500, 'Traditional Bastar Dhokra metal horse figurine.', 'https://picsum.photos/seed/decor1/600/600', 'Home Decor', 1),
(10, 'Madhubani Wall Painting', 6500, 'Original Madhubani painting depicting nature scenes on handmade paper.', 'https://picsum.photos/seed/decor2/600/600', 'Home Decor', 1),
(10, 'Painted Serving Tray', 1500, 'Wooden tray adorned with traditional Madhubani art.', 'https://picsum.photos/seed/decor3/600/600', 'Home Decor', 0),
(3, 'Brass Inlay Coaster Set', 800, 'Set of 6 wooden coasters with brass inlay work.', 'https://picsum.photos/seed/decor4/600/600', 'Home Decor', 0),

-- Gifts & Souvenirs
(7, 'Wooden Spinning Tops Set', 300, 'Set of 3 colorful Channapatna spinning tops.', 'https://picsum.photos/seed/gift1/600/600', 'Gifts & Souvenirs', 1),
(1, 'Terracotta Wind Chime', 650, 'Earthy terracotta wind chime for balconies and gardens.', 'https://picsum.photos/seed/gift2/600/600', 'Gifts & Souvenirs', 0),
(4, 'Silver Charm Bracelet', 2200, 'Handcrafted silver bracelet with Indian motif charms.', 'https://picsum.photos/seed/gift3/600/600', 'Gifts & Souvenirs', 0),
(5, 'Kantha Eyeglass Case', 400, 'Soft cotton eyeglass case with Kantha stitching.', 'https://picsum.photos/seed/gift4/600/600', 'Gifts & Souvenirs', 0),

-- GI Verified (Mixed categories, but marked specifically if needed. The frontend can filter by isGiVerified if GI Verified category is clicked)
(2, 'Kanchipuram Silk Saree', 28000, 'Authentic Kanchipuram silk saree with heavy zari border.', 'https://picsum.photos/seed/gi1/600/600', 'Textiles & Looms', 1),
(8, 'Jaipur Blue Pottery Mug', 850, 'Hand-painted coffee mug in traditional blue pottery.', 'https://picsum.photos/seed/gi2/600/600', 'Pottery & Ceramics', 1),
(10, 'Madhubani Bookmark Set', 250, 'Set of 5 handmade bookmarks with Madhubani motifs.', 'https://picsum.photos/seed/gi3/600/600', 'Gifts & Souvenirs', 1);
