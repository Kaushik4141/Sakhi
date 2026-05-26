"use server";

import { revalidatePath } from "next/cache";

export async function addProduct(formData: FormData) {
  const artisanIdStr = formData.get("artisanId") as string;
  const name = formData.get("name") as string;
  const priceStr = formData.get("price") as string;
  const description = formData.get("description") as string;
  let imageUrl = formData.get("imageUrl") as string;
  const isGiVerifiedStr = formData.get("isGiVerified") as string;

  const newArtisanName = formData.get("newArtisanName") as string;
  const newArtisanSlug = formData.get("newArtisanSlug") as string;
  const newArtisanBio = formData.get("newArtisanBio") as string;

  let finalArtisanId: string | number = artisanIdStr;

  try {
    // 1. If "new" artisan was selected, insert it first via API
    if (artisanIdStr === "new") {
      const artRes = await fetch('http://127.0.0.1:8787/api/artisans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newArtisanName, slug: newArtisanSlug, bio: newArtisanBio }),
      });
      const artData = await artRes.json() as any;
      if (!artRes.ok || !artData.success) {
        return { success: false, error: artData.error || "Failed to create new artisan." };
      }
      finalArtisanId = artData.artisan.id;
    }

    // 2. Validate final variables
    if (!name || !finalArtisanId || !priceStr) {
      return { success: false, error: "Missing required product fields." };
    }

    // 3. Insert Product via API
    const prodRes = await fetch('http://127.0.0.1:8787/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        artisanId: finalArtisanId,
        name,
        price: parseFloat(priceStr),
        description,
        imageUrl,
        isGiVerified: isGiVerifiedStr === "true",
      }),
    });
    
    const prodData = await prodRes.json() as any;
    if (!prodRes.ok || !prodData.success) {
      return { success: false, error: prodData.error || "Failed to add product." };
    }

    // 4. Revalidate cache
    revalidatePath("/");
    revalidatePath(`/shop`);

    return { success: true };
  } catch (error: any) {
    console.error("Failed to add product via API:", error);
    return { success: false, error: "Backend communication failed." };
  }
}
