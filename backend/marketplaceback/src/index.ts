import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt, sign, verify } from 'hono/jwt';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import * as schema from './db/schema';

export type Env = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Env }>();

// Enable CORS for frontend
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
}));

// ── PRODUCTS ─────────────────────────────────────────────────────────────────
app.get('/api/products', async (c) => {
  try {
    const db = drizzle(c.env.DB, { schema });
    const categoryQuery = c.req.query('category');
    
    let query = db
      .select({
        product: schema.products,
        artisan: schema.artisans,
      })
      .from(schema.products)
      .innerJoin(schema.artisans, eq(schema.products.artisanId, schema.artisans.id));

    if (categoryQuery && categoryQuery !== "All Crafts") {
      if (categoryQuery === "GI Verified") {
        const results = await query.where(eq(schema.products.isGiVerified, true));
        return c.json(results);
      } else {
        const results = await query.where(eq(schema.products.category, categoryQuery));
        return c.json(results);
      }
    }

    const productsWithArtisans = await query;
    return c.json(productsWithArtisans);
  } catch (error: any) {
    console.error("DB Error:", error.message);
    return c.json([]); // Return empty array if tables don't exist yet
  }
});

app.post('/api/products', async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const data = await c.req.json();
  
  const { name, price, description, imageUrl, isGiVerified, artisanId, category } = data;
  
  if (!name || isNaN(artisanId) || isNaN(price)) {
    return c.json({ success: false, error: 'Missing required product fields.' }, 400);
  }

  try {
    await db.insert(schema.products).values({
      artisanId: Number(artisanId),
      name,
      price: Number(price),
      description: description || '',
      imageUrl: imageUrl || 'https://images.unsplash.com/photo-1610701596007-11502861dcfa',
      isGiVerified: Boolean(isGiVerified),
      category: category || "All Crafts",
    });

    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ── ARTISANS ─────────────────────────────────────────────────────────────────
app.get('/api/artisans', async (c) => {
  try {
    const db = drizzle(c.env.DB, { schema });
    const allArtisans = await db.select().from(schema.artisans);
    return c.json(allArtisans);
  } catch (error: any) {
    console.error("DB Error:", error.message);
    return c.json([]); // Return empty array if tables don't exist yet
  }
});

app.post('/api/artisans', async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const { name, slug, bio } = await c.req.json();

  if (!name || !slug || !bio) {
    return c.json({ success: false, error: "All fields are required." }, 400);
  }

  const formattedSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  try {
    const existing = await db
      .select()
      .from(schema.artisans)
      .where(eq(schema.artisans.slug, formattedSlug));

    if (existing.length > 0) {
      return c.json({ success: false, error: "This store URL (slug) is already taken." }, 400);
    }

    await db.insert(schema.artisans).values({
      name,
      slug: formattedSlug,
      bio,
    });

    const inserted = await db.select().from(schema.artisans).where(eq(schema.artisans.slug, formattedSlug));

    return c.json({ success: true, artisan: inserted[0] });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ── AUTHENTICATION ───────────────────────────────────────────────────────────
const JWT_SECRET = 'super-secret-key-sakhi'; // In production, use environment variables

async function hashPassword(password: string) {
  const msgUint8 = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

app.post('/api/auth/register', async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const { name, email, password, address, city, state, pincode } = await c.req.json();

  if (!name || !email || !password) {
    return c.json({ success: false, error: "Name, email, and password are required." }, 400);
  }

  try {
    const existingUser = await db.select().from(schema.users).where(eq(schema.users.email, email));
    if (existingUser.length > 0) {
      return c.json({ success: false, error: "User with this email already exists." }, 400);
    }

    const passwordHash = await hashPassword(password);

    await db.insert(schema.users).values({
      name,
      email,
      passwordHash,
      address: address || null,
      city: city || null,
      state: state || null,
      pincode: pincode || null,
    });

    // Fetch the inserted user to get their ID (since .returning() can fail on older D1 versions)
    const inserted = await db.select().from(schema.users).where(eq(schema.users.email, email));
    const user = inserted[0];
    const token = await sign({ id: user.id, name: user.name, email: user.email, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 }, JWT_SECRET);

    return c.json({ 
      success: true, 
      token, 
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email,
        address: user.address,
        city: user.city,
        state: user.state,
        pincode: user.pincode
      } 
    });
  } catch (error: any) {
    console.error("REGISTER ERROR:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

app.post('/api/auth/login', async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const { email, password } = await c.req.json();

  if (!email || !password) {
    return c.json({ success: false, error: "Email and password required." }, 400);
  }

  try {
    const users = await db.select().from(schema.users).where(eq(schema.users.email, email));
    if (users.length === 0) {
      return c.json({ success: false, error: "Invalid credentials." }, 401);
    }

    const user = users[0];
    const passwordHash = await hashPassword(password);

    if (passwordHash !== user.passwordHash) {
      return c.json({ success: false, error: "Invalid credentials." }, 401);
    }

    const token = await sign({ id: user.id, name: user.name, email: user.email, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 }, JWT_SECRET);
    
    return c.json({ 
      success: true, 
      token, 
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email,
        address: user.address,
        city: user.city,
        state: user.state,
        pincode: user.pincode
      } 
    });
  } catch (error: any) {
    console.error("LOGIN ERROR:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Protected Profile Route
app.get('/api/auth/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }
  
  const token = authHeader.split(' ')[1];
  try {
    const payload = await verify(token, JWT_SECRET);
    return c.json({ success: true, user: payload });
  } catch (error) {
    return c.json({ success: false, error: "Invalid token" }, 401);
  }
});

// ── WEBHOOKS ─────────────────────────────────────────────────────────────────
app.post('/api/webhooks/razorpay', async (c) => {
  // Simple webhook handling
  const body = await c.req.json();
  console.log("Razorpay Webhook received:", body);
  return c.json({ status: "ok" });
});

export default app;
