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
  return (
    <div className="w-full bg-[#111111] border-b border-[#222222]">
      <div className="mx-auto flex max-w-[1400px] items-center gap-8 overflow-x-auto px-6 py-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {categories.map((category) => (
          <button
            key={category}
            className="whitespace-nowrap text-sm font-medium text-neutral-300 hover:text-[#f3d286] transition-colors"
          >
            {category}
          </button>
        ))}
      </div>
    </div>
  );
}
