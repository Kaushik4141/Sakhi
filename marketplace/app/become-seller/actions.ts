"use server";

import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";

export async function registerArtisan(formData: FormData) {
  const db = getDb();

  const name = formData.get("name") as string;
  const slug = formData.get("slug") as string;
  const bio = formData.get("bio") as string;

  if (!name || !slug || !bio) {
    return { success: false, error: "All fields are required." };
  }

  // Ensure slug is url-friendly (no spaces)
  const formattedSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  try {
    // Check if slug already exists
    const existing = await db
      .select()
      .from(schema.artisans)
      .where(eq(schema.artisans.slug, formattedSlug));

    if (existing.length > 0) {
      return { success: false, error: "This store URL (slug) is already taken. Please choose another." };
    }

    await db.insert(schema.artisans).values({
      name,
      slug: formattedSlug,
      bio,
    });

    revalidatePath("/");
    revalidatePath("/sell"); // Revalidate product listing page dropdown

    return { success: true };
  } catch (error: any) {
    console.error("Failed to register artisan:", error);
    return { success: false, error: error.message || "Failed to register as a seller." };
  }
}
