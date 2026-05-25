import { notFound } from "next/navigation";
import Link from "next/link";

interface Product {
  id: string;
  titleOriginal: string;
  titleEn: string;
  descriptionSeo: string | null;
  priceInr: number;
  stock: number;
  imageUrl: string;
}

interface Artisan {
  id: string;
  name: string;
  region: string;
  shopSlug: string;
}

interface StorefrontResponse {
  success: boolean;
  artisan?: Artisan;
  products?: Product[];
  error?: string;
}

// In Next.js 15, params is a Promise
export default async function StorefrontPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;

  const apiUrl = process.env.API_URL || "http://127.0.0.1:8787";
  
  // Fetch data with ISR revalidation every 60 seconds
  const res = await fetch(`${apiUrl}/storefront/${slug}`, {
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    if (res.status === 404) {
      notFound();
    }
    throw new Error("Failed to fetch storefront data");
  }

  const data = (await res.json()) as StorefrontResponse;

  if (!data.success || !data.artisan) {
    notFound();
  }

  const { artisan, products = [] } = data;

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-5xl mx-auto">
      {/* Header Card */}
      <section className="bg-white rounded-2xl p-6 md:p-10 shadow-sm border border-terracotta-100 mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-terracotta-900 mb-2 flex items-center gap-2">
            {artisan.name}
          </h1>
          <p className="text-terracotta-600 flex items-center gap-2 font-medium">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            {artisan.region}
          </p>
        </div>
        
        <div className="bg-terracotta-50 text-terracotta-900 px-4 py-2 rounded-full font-medium inline-flex items-center gap-2 self-start md:self-auto border border-terracotta-100 shadow-sm">
          <svg className="w-5 h-5 text-terracotta-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
          Verified Home Creator
        </div>
      </section>

      {/* Products Grid */}
      <section>
        <h2 className="text-2xl font-bold text-terracotta-900 mb-6">Available Creations</h2>
        
        {products.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-terracotta-100 shadow-sm">
            <h3 className="text-xl font-semibold text-terracotta-900 mb-2">Products coming soon</h3>
            <p className="text-terracotta-600">This creator is currently working on new items.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => {
              // Create WhatsApp share URL
              const shareText = `Check out ${product.titleEn} for ₹${product.priceInr} by ${artisan.name}: ${process.env.NEXT_PUBLIC_SITE_URL || 'https://kalamitra.in'}/shop/${slug}#${product.id}`;
              const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

              return (
                <article 
                  key={product.id} 
                  id={product.id}
                  className="bg-white rounded-2xl overflow-hidden shadow-sm border border-terracotta-100 hover-lift flex flex-col h-full"
                >
                  {/* Image placeholder since we might not have real images yet */}
                  <div className="bg-terracotta-100 h-48 w-full flex items-center justify-center relative">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.titleEn} className="w-full h-full object-cover" />
                    ) : (
                      <svg className="w-12 h-12 text-terracotta-500 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    )}
                  </div>
                  
                  <div className="p-6 flex flex-col flex-grow">
                    <h3 className="font-bold text-xl text-terracotta-900 mb-2 line-clamp-1">{product.titleEn}</h3>
                    <p className="text-terracotta-600 text-sm mb-4 line-clamp-2 flex-grow">
                      {product.descriptionSeo || "Handcrafted with traditional techniques."}
                    </p>
                    
                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-terracotta-50">
                      <span className="text-xl font-bold text-terracotta-900">₹{product.priceInr}</span>
                      
                      <a 
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-full font-medium text-sm transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        Share
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
