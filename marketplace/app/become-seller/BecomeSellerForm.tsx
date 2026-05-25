"use client";

import { useState } from "react";
import { registerArtisan } from "./actions";

export default function BecomeSellerForm() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setMessage(null);
    
    const res = await registerArtisan(formData);
    
    if (res.success) {
      setMessage({ type: "success", text: "Successfully registered as a Seller! You can now start listing products." });
      (document.getElementById("seller-form") as HTMLFormElement).reset();
    } else {
      setMessage({ type: "error", text: res.error || "An error occurred." });
    }
    
    setLoading(false);
  }

  return (
    <form id="seller-form" action={handleSubmit} className="flex flex-col gap-6">
      {message && (
        <div className={`p-4 rounded-lg border ${message.type === "success" ? "bg-emerald-900/20 border-emerald-500/30 text-emerald-300" : "bg-red-900/20 border-red-500/30 text-red-300"}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-stone-300">Artisan / Store Name *</label>
          <input required name="name" type="text" placeholder="e.g. Anita Handlooms" className="bg-black/50 border border-[#333] rounded-lg px-4 py-3 text-white placeholder-stone-600 focus:outline-none focus:border-[#f3d286] transition-colors" />
        </div>
        
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-stone-300">Store URL Slug *</label>
          <div className="flex bg-black/50 border border-[#333] rounded-lg focus-within:border-[#f3d286] transition-colors overflow-hidden">
            <span className="px-4 py-3 text-stone-500 bg-[#111] border-r border-[#333]">sakhi.com/shop/</span>
            <input required name="slug" type="text" placeholder="anita-handlooms" className="w-full bg-transparent px-4 py-3 text-white placeholder-stone-600 focus:outline-none" />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-stone-300">Artisan Bio / Story *</label>
        <textarea required name="bio" rows={4} placeholder="Tell buyers about your heritage, craft, and story..." className="bg-black/50 border border-[#333] rounded-lg px-4 py-3 text-white placeholder-stone-600 focus:outline-none focus:border-[#f3d286] transition-colors resize-none"></textarea>
      </div>

      <button disabled={loading} type="submit" className="mt-4 w-full bg-[#f3d286] text-black py-4 rounded-lg font-bold hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg">
        {loading ? "Registering..." : "Join Sakhi as a Seller"}
      </button>
    </form>
  );
}
