INSERT INTO artisans (id, slug, name, bio)
  VALUES
    (1, 'pottery-jane', 'Jane Doe', 'Master potter specializing in handmade clay vessels.'),
    (2, 'weaver-anita', 'Anita Sharma', 'Traditional handloom weaver creating cotton and silk textiles.'),
    (3, 'woodcraft-ravi', 'Ravi Kumar', 'Wood artisan crafting carved home decor and utility pieces.'),
    (4, 'brass-meera', 'Meera Iyer', 'Brassware maker preserving traditional metal craft techniques.')
  ON CONFLICT(id) DO UPDATE SET
    slug = excluded.slug,
    name = excluded.name,
    bio = excluded.bio;

  INSERT INTO products (
    id,
    artisan_id,
    name,
    price,
    description,
    image_url,
    is_gi_verified
  )
  VALUES
    (
      1,
      1,
      'Handmade Clay Vase',
      5000,
      'A wheel-thrown clay vase with a natural terracotta finish.',
      'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61',
      1
    ),
    (
      2,
      1,
      'Decorative Ceramic Bowl',
      2800,
      'A glazed ceramic bowl suitable for table decor or gifting.',
      'https://images.unsplash.com/photo-1610701596007-11502861dcfa',
      0
    ),
    (
      3,
      2,
      'Handwoven Cotton Dupatta',
      3200,
      'Soft cotton dupatta woven on a traditional handloom.',
      'https://images.unsplash.com/photo-1594736797933-d0501ba2fe65',
      1
    ),
    (
      4,
      2,
      'Silk Table Runner',
      4500,
      'Elegant handwoven silk table runner with traditional motifs.',
      'https://images.unsplash.com/photo-1601050690597-df0568f70950',
      1
    ),
    (
      5,
      3,
      'Carved Wooden Tray',
      3600,
      'A polished wooden serving tray with hand-carved edges.',
      'https://images.unsplash.com/photo-1618220179428-22790b461013',
      0
    ),
    (
      6,
      4,
      'Brass Diya Set',
      2200,
      'Set of two handcrafted brass diyas for festive decor.',
      'https://images.unsplash.com/photo-1605292356183-a77d0a9c9d1d',
      1
    )
  ON CONFLICT(id) DO UPDATE SET
    artisan_id = excluded.artisan_id,
    name = excluded.name,
    price = excluded.price,
    description = excluded.description,
    image_url = excluded.image_url,
    is_gi_verified = excluded.is_gi_verified;