"use client";

import { useState } from "react";
import { addProduct } from "./actions";

type Artisan = {
  id: number;
  name: string;
  slug: string;
};

export default function SellClientForm({ artisans }: { artisans: Artisan[] }) {
  const [isNewArtisan, setIsNewArtisan] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setMessage(null);
    
    if (isNewArtisan) {
        formData.set("artisanId", "new");
    }

    const res = await addProduct(formData);
    
    if (res.success) {
      setMessage({ type: "success", text: "Product successfully listed!" });
      // Reset form natively
      (document.getElementById("sell-form") as HTMLFormElement).reset();
      setIsNewArtisan(false);
    } else {
      setMessage({ type: "error", text: res.error || "An error occurred." });
    }
    
    setLoading(false);
  }

  return (
    <form id="sell-form" action={handleSubmit} className="flex flex-col gap-6">
      {message && (
        <div className={`p-4 rounded-lg border ${message.type === "success" ? "bg-emerald-900/20 border-emerald-500/30 text-emerald-300" : "bg-red-900/20 border-red-500/30 text-red-300"}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-stone-300">Product Name *</label>
          <input required name="name" type="text" placeholder="e.g. Handwoven Silk Saree" className="bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-stone-600 focus:outline-none focus:border-white/30 transition" />
        </div>
        
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-stone-300">Price (₹) *</label>
          <input required name="price" type="number" min="1" placeholder="e.g. 4500" className="bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-stone-600 focus:outline-none focus:border-white/30 transition" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-stone-300">Description</label>
        <textarea name="description" rows={3} placeholder="Describe the craft..." className="bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-stone-600 focus:outline-none focus:border-white/30 transition resize-none"></textarea>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-stone-300">Image URL</label>
        <input name="imageUrl" type="url" placeholder="Leave empty for default placeholder" className="bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-stone-600 focus:outline-none focus:border-white/30 transition" />
      </div>

      <label className="flex items-center gap-3 cursor-pointer p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition">
        <input type="checkbox" name="isGiVerified" value="true" className="w-5 h-5 rounded border-white/20 bg-black text-white focus:ring-0 accent-white" />
        <div>
          <p className="font-medium text-white">GI Verified Heritage Craft</p>
          <p className="text-xs text-stone-400">Check this if the product has Geographical Indication certification.</p>
        </div>
      </label>

      <hr className="border-white/10 my-2" />

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-stone-300">Select Artisan *</label>
          <button type="button" onClick={() => setIsNewArtisan(!isNewArtisan)} className="text-xs text-stone-400 hover:text-white underline underline-offset-4">
            {isNewArtisan ? "Select Existing Artisan" : "+ Register New Artisan"}
          </button>
        </div>

        {!isNewArtisan ? (
          <select name="artisanId" required className="bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white/30 transition appearance-none">
            <option value="" disabled selected>Choose an artisan...</option>
            {artisans.map(a => (
              <option key={a.id} value={a.id}>{a.name} (@{a.slug})</option>
            ))}
          </select>
        ) : (
          <div className="flex flex-col gap-4 p-5 rounded-lg border border-white/10 bg-black/30">
            <h4 className="text-sm font-semibold text-white">New Artisan Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input required name="newArtisanName" type="text" placeholder="Full Name" className="bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder-stone-600 focus:outline-none focus:border-white/30 transition" />
              <input required name="newArtisanSlug" type="text" placeholder="Slug (e.g. artisan-name)" className="bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder-stone-600 focus:outline-none focus:border-white/30 transition" />
            </div>
            <textarea name="newArtisanBio" rows={2} placeholder="Artisan Bio..." className="bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder-stone-600 focus:outline-none focus:border-white/30 transition resize-none"></textarea>
          </div>
        )}
      </div>

      <button disabled={loading} type="submit" className="mt-4 w-full bg-white text-black py-4 rounded-lg font-bold hover:bg-stone-200 transition disabled:opacity-50 disabled:cursor-not-allowed">
        {loading ? "Listing Product..." : "List Product on Sakhi"}
      </button>
    </form>
  );
}
