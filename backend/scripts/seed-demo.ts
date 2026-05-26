import { execSync } from "child_process";
import { randomUUID } from "crypto";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";

// Helper to escape single quotes in SQL strings
const esc = (str: string) => str.replace(/'/g, "''");

const artisansData = [
  {
    id: randomUUID(),
    name: "Meena Devi",
    region: "Channapatna",
    shop_slug: "meena-devi-demo",
    phone: `demo_${Date.now()}_1`,
    uin_number: "DEMO1",
    craft_type: "Channapatna wooden toys",
    experience_years: "15 years",
    theme: "terracotta",
    language: "en"
  },
  {
    id: randomUUID(),
    name: "Savitha R",
    region: "Mysore",
    shop_slug: "savitha-silks",
    phone: `demo_${Date.now()}_2`,
    uin_number: "DEMO2",
    craft_type: "Mysore silk weaving",
    experience_years: "20 years",
    theme: "indigo",
    language: "en"
  },
  {
    id: randomUUID(),
    name: "Prakruthi Bai",
    region: "Sirsi",
    shop_slug: "prakruthi-crafts",
    phone: `demo_${Date.now()}_3`,
    uin_number: "DEMO3",
    craft_type: "bamboo basket weaving",
    experience_years: "8 years",
    theme: "forest",
    language: "en"
  }
];

const products = [
  // Meena Devi (terracotta)
  {
    id: randomUUID(),
    artisan_id: artisansData[0].id,
    title_original: "Channapatna Wooden Elephant",
    title_en: "Channapatna Wooden Elephant",
    description_seo: "Beautifully handcrafted Channapatna wooden elephant, made with natural lac dyes. A perfect showcase of Karnataka's rich toy-making heritage.",
    price_inr: 450,
    stock: 10,
    image_url: "",
    is_live: 1,
    is_gi_certified: 1,
    created_at: new Date().toISOString()
  },
  {
    id: randomUUID(),
    artisan_id: artisansData[0].id,
    title_original: "Hand-painted Spinning Top",
    title_en: "Hand-painted Spinning Top",
    description_seo: "Traditional wooden spinning top, hand-painted with vibrant natural colors. Classic entertainment and authentic craftsmanship.",
    price_inr: 150,
    stock: 25,
    image_url: "",
    is_live: 1,
    is_gi_certified: 0,
    created_at: new Date().toISOString()
  },
  {
    id: randomUUID(),
    artisan_id: artisansData[0].id,
    title_original: "Nesting Dolls Set of 5",
    title_en: "Nesting Dolls Set of 5",
    description_seo: "Set of 5 wooden nesting dolls. Carefully carved and painted by hand, a beautiful collectible showcasing local artistry.",
    price_inr: 800,
    stock: 5,
    image_url: "",
    is_live: 1,
    is_gi_certified: 0,
    created_at: new Date().toISOString()
  },
  
  // Savitha R (indigo)
  {
    id: randomUUID(),
    artisan_id: artisansData[1].id,
    title_original: "Royal Mysore Silk Saree",
    title_en: "Royal Mysore Silk Saree",
    description_seo: "An exquisite Mysore silk saree in deep indigo with pure gold zari borders. Woven with the finest pure silk.",
    price_inr: 15000,
    stock: 2,
    image_url: "",
    is_live: 1,
    is_gi_certified: 1,
    created_at: new Date().toISOString()
  },
  {
    id: randomUUID(),
    artisan_id: artisansData[1].id,
    title_original: "Silk Scarf with Zari",
    title_en: "Silk Scarf with Zari",
    description_seo: "A lightweight, elegant silk scarf featuring subtle zari work. Perfect for evening wear.",
    price_inr: 2500,
    stock: 8,
    image_url: "",
    is_live: 1,
    is_gi_certified: 0,
    created_at: new Date().toISOString()
  },
  {
    id: randomUUID(),
    artisan_id: artisansData[1].id,
    title_original: "Traditional Silk Stole",
    title_en: "Traditional Silk Stole",
    description_seo: "Handwoven silk stole showing the classic hallmarks of Mysore craftsmanship and dyeing.",
    price_inr: 3200,
    stock: 5,
    image_url: "",
    is_live: 1,
    is_gi_certified: 0,
    created_at: new Date().toISOString()
  },

  // Prakruthi Bai (forest)
  {
    id: randomUUID(),
    artisan_id: artisansData[2].id,
    title_original: "Large Woven Bamboo Basket",
    title_en: "Large Woven Bamboo Basket",
    description_seo: "A sturdy, eco-friendly bamboo basket woven using traditional techniques from Sirsi. Perfect for storage or decor.",
    price_inr: 650,
    stock: 12,
    image_url: "",
    is_live: 1,
    is_gi_certified: 0,
    created_at: new Date().toISOString()
  },
  {
    id: randomUUID(),
    artisan_id: artisansData[2].id,
    title_original: "Bamboo Lampshade",
    title_en: "Bamboo Lampshade",
    description_seo: "Intricately woven bamboo lampshade that casts beautiful shadows. Handcrafted from locally sourced bamboo.",
    price_inr: 1200,
    stock: 4,
    image_url: "",
    is_live: 1,
    is_gi_certified: 0,
    created_at: new Date().toISOString()
  },
  {
    id: randomUUID(),
    artisan_id: artisansData[2].id,
    title_original: "Set of 4 Bamboo Coasters",
    title_en: "Set of 4 Bamboo Coasters",
    description_seo: "Heat-resistant and durable coasters made from finely split bamboo. A perfect addition to any natural aesthetic.",
    price_inr: 350,
    stock: 20,
    image_url: "",
    is_live: 1,
    is_gi_certified: 0,
    created_at: new Date().toISOString()
  }
];

// 3. Construct SQL commands
const insertArtisansSql = artisansData.map(a => `
  INSERT INTO artisans (id, name, region, shop_slug, phone, uin_number, craft_type, experience_years, theme, language) 
  VALUES ('${a.id}', '${esc(a.name)}', '${esc(a.region)}', '${a.shop_slug}', '${a.phone}', '${a.uin_number}', '${esc(a.craft_type)}', '${esc(a.experience_years)}', '${a.theme}', '${a.language}');
`).join('\n');

const insertProductsSql = products.map(p => `
  INSERT INTO products (id, artisan_id, title_original, title_en, description_seo, price_inr, stock, image_url, is_live, is_gi_certified, created_at)
  VALUES ('${p.id}', '${p.artisan_id}', '${esc(p.title_original)}', '${esc(p.title_en)}', '${esc(p.description_seo)}', ${p.price_inr}, ${p.stock}, '${p.image_url}', ${p.is_live}, ${p.is_gi_certified}, '${p.created_at}');
`).join('\n');

const fullSql = `
  ${insertArtisansSql}
  ${insertProductsSql}
`;

console.log("Executing SQL seed against local D1 database...");

const tempFile = join(process.cwd(), "temp-seed.sql");
writeFileSync(tempFile, fullSql);

try {
  // Use wrangler to execute the SQL against the local D1 db (the db name is DB based on package.json/wrangler.toml)
  execSync(`npx wrangler d1 execute DB --local --file=temp-seed.sql`, {
    stdio: 'inherit'
  });
  
  console.log("\n✅ Demo data seeded successfully!");
  console.log(`\n🎉 Theme Previews available at:`);
  artisansData.forEach(a => {
    console.log(`   http://localhost:3000/shop/${a.shop_slug}  (${a.theme} theme)`);
  });
} catch (error) {
  console.error("Failed to seed data:", error);
} finally {
  try {
    unlinkSync(tempFile);
  } catch (e) {}
}
