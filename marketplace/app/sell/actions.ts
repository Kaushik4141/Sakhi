"use server";

import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/db";

export async function addProduct(formData: FormData) {
  const db = getDb();

  // Extract form data
  const artisanIdStr = formData.get("artisanId") as string;
  const name = formData.get("name") as string;
  const priceStr = formData.get("price") as string;
  const description = formData.get("description") as string;
  let imageUrl = formData.get("imageUrl") as string;
  const isGiVerifiedStr = formData.get("isGiVerified") as string;

  // Optional: New artisan fields
  const newArtisanName = formData.get("newArtisanName") as string;
  const newArtisanSlug = formData.get("newArtisanSlug") as string;
  const newArtisanBio = formData.get("newArtisanBio") as string;

  if (!imageUrl) {
    // High-fidelity fallback image if none provided
    imageUrl = "https://images.unsplash.com/photo-1610701596007-11502861dcfa";
  }

  let finalArtisanId = parseInt(artisanIdStr);

  try {
    // 1. If "new" artisan was selected, insert it first
    if (artisanIdStr === "new") {
      if (!newArtisanName || !newArtisanSlug) {
        return { success: false, error: "New Artisan Name and Slug are required." };
      }

      const insertedArtisan = await db
        .insert(schema.artisans)
        .values({
          name: newArtisanName,
          slug: newArtisanSlug,
          bio: newArtisanBio,
        })
        .returning();

      finalArtisanId = insertedArtisan[0].id;
    }

    // 2. Validate final variables
    if (!name || isNaN(finalArtisanId) || !priceStr) {
      return { success: false, error: "Missing required product fields." };
    }

    const price = parseFloat(priceStr);
    const isGiVerified = isGiVerifiedStr === "true";

    // 3. Insert Product
    await db.insert(schema.products).values({
      artisanId: finalArtisanId,
      name,
      price,
      description,
      imageUrl,
      isGiVerified,
    });

    // 4. Revalidate cache
    revalidatePath("/");
    revalidatePath(`/shop/${newArtisanSlug || "all"}`);

    return { success: true };
  } catch (error: any) {
    console.error("Failed to add product:", error);
    return { success: false, error: error.message || "Failed to add product." };
  }
}
