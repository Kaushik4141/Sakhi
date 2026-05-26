INSERT INTO artisans (id, name, region, shop_slug, phone, uin_number, craft_type, experience_years, language, theme)
VALUES (
  'artisan-lakshmi-001',
  'Lakshmi',
  'Karnataka',
  'lakshmi-totes',
  '9876543210',
  'UIN-98765',
  'Jute Crafting',
  '15',
  'en',
  'terracotta'
);

INSERT INTO products (id, artisan_id, title_original, title_en, description_seo, price_inr, stock, image_url, material, color, seo_keywords, is_live, is_gi_certified)
VALUES (
  'product-tote-001',
  'artisan-lakshmi-001',
  'Mini Jute And Fabric Tote Bag',
  'Mini Jute And Fabric Tote Bag',
  'Beautiful handcrafted mini jute and fabric tote bag by master artisan Lakshmi. Perfect for everyday use and environmentally sustainable.',
  500,
  10,
  'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?q=80&w=600&auto=format&fit=crop',
  'Jute and Fabric',
  'Brown/Multicolor',
  'jute bag, tote bag, handcrafted, sustainable',
  1,
  0
);
