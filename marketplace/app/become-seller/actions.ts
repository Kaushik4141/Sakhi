"use server";

import { revalidatePath } from "next/cache";

export async function registerArtisan(formData: FormData) {
  const name = formData.get("name") as string;
  const slug = formData.get("slug") as string;
  const bio = formData.get("bio") as string;

  if (!name || !slug || !bio) {
    return { success: false, error: "All fields are required." };
  }

  try {
    const res = await fetch('http://127.0.0.1:8787/api/artisans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, slug, bio }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      return { success: false, error: data.error || "Failed to register seller." };
    }

    revalidatePath("/");
    revalidatePath("/sell"); // Revalidate product listing page dropdown

    return { success: true };
  } catch (error: any) {
    console.error("Failed to register artisan via API:", error);
    return { success: false, error: "Backend communication failed." };
  }
}
