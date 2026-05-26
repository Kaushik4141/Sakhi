export const runtime = 'edge';

// DB imports removed as we now use API
import Header from "@/components/Header";
import CategoriesBar from "@/components/CategoriesBar";
import HeroCarousel from "@/components/HeroCarousel";
import ProductCard from "@/components/ProductCard";

export default async function Home({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const resolvedSearchParams = await searchParams;
  const category = resolvedSearchParams.category || "All Crafts";
  let productsWithArtisans: any[] = [];
  
  try {
    const fetchUrl = 'http://127.0.0.1:8787/marketplace';
      
    const res = await fetch(fetchUrl, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json() as any;
      if (data.success && data.products) {
        productsWithArtisans = data.products.map((p: any) => ({
          product: {
            id: p.id,
            name: p.name,
            price: p.priceInr,
            imageUrl: p.imageUrl,
            isGiVerified: false
          },
          artisan: {
            name: p.artisanName
          }
        }));
      }
    }
  } catch (error) {
    console.error("Backend is not running or unreachable.");
  }

  return (
    <main className="min-h-screen bg-black">
      <Header />
      <CategoriesBar />
      <HeroCarousel />
      
      <section className="mx-auto max-w-[1400px] px-4 sm:px-6 py-12">
        <div className="flex items-center justify-between mb-8 border-b border-[#222222] pb-4">
          <h2 className="text-2xl font-semibold text-white tracking-wide">
            Top Picks <span className="text-neutral-500 font-normal">for you</span>
          </h2>
          <button className="text-sm font-medium text-[#f3d286] hover:text-white transition-colors">
            View All
          </button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
          {productsWithArtisans.map(({ product, artisan }) => (
            <ProductCard 
              key={product.id} 
              product={product} 
              artisan={artisan} 
            />
          ))}
        </div>

        {productsWithArtisans.length === 0 && (
          <div className="text-center py-24 text-neutral-500 border-2 border-dashed border-[#222222] rounded-xl">
            No products found in the database. Run the seed script to populate products!
          </div>
        )}
      </section>
      
      {/* Footer / Trust badges */}
      <div className="border-t border-[#222222] bg-[#0a0a0a] mt-12 py-12">
        <div className="mx-auto max-w-[1400px] px-6 grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
          <div>
            <h4 className="text-white font-bold mb-3 uppercase tracking-wider text-sm">100% Authentic</h4>
            <p className="text-sm text-neutral-400">Direct from artisans and weavers.</p>
          </div>
          <div>
            <h4 className="text-white font-bold mb-3 uppercase tracking-wider text-sm">Secure Payments</h4>
            <p className="text-sm text-neutral-400">Safe and encrypted checkout.</p>
          </div>
          <div>
            <h4 className="text-white font-bold mb-3 uppercase tracking-wider text-sm">GI Verified</h4>
            <p className="text-sm text-neutral-400">Authentic Geographical Indication products.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
