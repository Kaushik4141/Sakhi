import { execSync } from "child_process";
import { randomUUID } from "crypto";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";

// 1. Generate IDs
const artisanId = randomUUID();
const productId1 = randomUUID();
const productId2 = randomUUID();
const productId3 = randomUUID();

// 2. Prepare Data
// Helper to escape single quotes in SQL strings
const esc = (str: string) => str.replace(/'/g, "''");

const artisan = {
  id: artisanId,
  name: "Meena Devi",
  region: "Channapatna",
  shop_slug: "meena-devi-demo",
  phone: `demo_${Date.now()}`,
  uin_number: "DEMO123",
  craft_type: "wooden toys",
  experience_years: "15 years"
};

const products = [
  {
    id: productId1,
    artisan_id: artisanId,
    title_original: "Channapatna Wooden Elephant",
    title_en: "Channapatna Wooden Elephant",
    description_seo: "Beautifully handcrafted Channapatna wooden elephant, made with natural lac dyes. A perfect showcase of Karnataka's rich toy-making heritage.",
    price_inr: 450,
    stock: 10,
    image_url: "",
    is_live: 1,
    created_at: new Date().toISOString()
  },
  {
    id: productId2,
    artisan_id: artisanId,
    title_original: "Hand-painted Spinning Top",
    title_en: "Hand-painted Spinning Top",
    description_seo: "Traditional wooden spinning top, hand-painted with vibrant natural colors. Classic entertainment and authentic craftsmanship.",
    price_inr: 150,
    stock: 25,
    image_url: "",
    is_live: 1,
    created_at: new Date().toISOString()
  },
  {
    id: productId3,
    artisan_id: artisanId,
    title_original: "Nesting Dolls Set of 5",
    title_en: "Nesting Dolls Set of 5",
    description_seo: "Set of 5 wooden nesting dolls. Carefully carved and painted by hand, a beautiful collectible showcasing local artistry.",
    price_inr: 800,
    stock: 5,
    image_url: "",
    is_live: 1,
    created_at: new Date().toISOString()
  }
];

// 3. Construct SQL commands
const insertArtisanSql = `
  INSERT INTO artisans (id, name, region, shop_slug, phone, uin_number, craft_type, experience_years) 
  VALUES ('${artisan.id}', '${esc(artisan.name)}', '${esc(artisan.region)}', '${artisan.shop_slug}', '${artisan.phone}', '${artisan.uin_number}', '${esc(artisan.craft_type)}', '${esc(artisan.experience_years)}');
`;

const insertProductsSql = products.map(p => `
  INSERT INTO products (id, artisan_id, title_original, title_en, description_seo, price_inr, stock, image_url, is_live, created_at)
  VALUES ('${p.id}', '${p.artisan_id}', '${esc(p.title_original)}', '${esc(p.title_en)}', '${esc(p.description_seo)}', ${p.price_inr}, ${p.stock}, '${p.image_url}', ${p.is_live}, '${p.created_at}');
`).join('\n');

const fullSql = `
  ${insertArtisanSql}
  ${insertProductsSql}
`;

console.log("Executing SQL seed against local D1 database...");

const tempFile = join(process.cwd(), "temp-seed.sql");
writeFileSync(tempFile, fullSql);

try {
  // Use wrangler to execute the SQL against the local D1 db
  execSync(`npx wrangler d1 execute kalamitra-db --local --file=temp-seed.sql`, {
    stdio: 'inherit'
  });
  
  console.log("\n✅ Demo data seeded successfully!");
  console.log(`\n🎉 Demo storefront ready: http://localhost:3000/shop/${artisan.shop_slug}`);
} catch (error) {
  console.error("Failed to seed data:", error);
} finally {
  try {
    unlinkSync(tempFile);
  } catch (e) {}
}
