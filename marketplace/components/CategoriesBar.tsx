"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const categories = [
  "All Crafts",
  "Textiles & Looms",
  "Pottery & Ceramics",
  "Woodwork & Carving",
  "Jewelry",
  "GI Verified",
  "Home Decor",
  "Gifts & Souvenirs",
];

export default function CategoriesBar() {
  const searchParams = useSearchParams();
  const currentCategory = searchParams.get('category') || "All Crafts";

  return (
    <div className="w-full bg-[#111111] border-b border-[#222222]">
      <div className="mx-auto flex max-w-[1400px] items-center gap-8 overflow-x-auto px-6 py-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {categories.map((category) => (
          <Link
            key={category}
            href={category === "All Crafts" ? "/" : `/?category=${encodeURIComponent(category)}`}
            className={`whitespace-nowrap text-sm font-medium transition-colors ${
              currentCategory === category 
                ? "text-[#f3d286]" 
                : "text-neutral-300 hover:text-[#f3d286]"
            }`}
          >
            {category}
          </Link>
        ))}
      </div>
    </div>
  );
}
