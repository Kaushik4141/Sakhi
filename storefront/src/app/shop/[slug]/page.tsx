import { notFound } from "next/navigation";
import { Playfair_Display, Cormorant_Garamond, Lora, Inter } from 'next/font/google';

const playfair = Playfair_Display({ subsets: ['latin'], display: 'swap' });
const cormorant = Cormorant_Garamond({ subsets: ['latin'], display: 'swap', weight: ['400', '600', '700'] });
const lora = Lora({ subsets: ['latin'], display: 'swap' });
const inter = Inter({ subsets: ['latin'], display: 'swap' });

interface Product {
  id: string;
  titleOriginal: string;
  titleEn: string;
  descriptionSeo: string | null;
  priceInr: number;
  stock: number;
  imageUrl: string;
  isGiCertified?: boolean;
}

interface Artisan {
  id: string;
  name: string;
  region: string;
  shopSlug: string;
  craftType?: string;
  theme?: "terracotta" | "indigo" | "forest";
}

interface StorefrontResponse {
  success: boolean;
  artisan?: Artisan;
  products?: Product[];
  error?: string;
}

type ThemeConfig = {
  bg: string;
  card: string;
  header: string;
  accent: string;
  text: string;
  subtext: string;
  badge: string;
  font: string;
  bodyFont: string;
};

const THEMES: Record<string, ThemeConfig> = {
  terracotta: {
    bg: "bg-amber-50",
    card: "bg-white border border-amber-100",
    header: "bg-gradient-to-br from-orange-800 to-amber-700",
    accent: "bg-orange-600 hover:bg-orange-700 text-white",
    text: "text-orange-900",
    subtext: "text-amber-700",
    badge: "bg-orange-100 text-orange-800 border border-orange-300",
    font: playfair.className,
    bodyFont: inter.className,
  },
  indigo: {
    bg: "bg-slate-50",
    card: "bg-white border border-indigo-100",
    header: "bg-gradient-to-br from-indigo-900 to-purple-800",
    accent: "bg-indigo-600 hover:bg-indigo-700 text-white",
    text: "text-indigo-900",
    subtext: "text-indigo-600",
    badge: "bg-indigo-100 text-indigo-800 border border-indigo-300",
    font: cormorant.className,
    bodyFont: inter.className,
  },
  forest: {
    bg: "bg-green-50",
    card: "bg-white border border-green-100",
    header: "bg-gradient-to-br from-green-900 to-emerald-700",
    accent: "bg-emerald-600 hover:bg-emerald-700 text-white",
    text: "text-green-900",
    subtext: "text-green-700",
    badge: "bg-green-100 text-green-800 border border-green-300",
    font: lora.className,
    bodyFont: inter.className,
  }
};

export const revalidate = 60;

export default async function StorefrontPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ theme_preview?: string }>;
}) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;
  const resolvedSearchParams = await searchParams;
  
  const apiUrl = process.env.API_URL || "http://127.0.0.1:8787";
  
  const res = await fetch(`${apiUrl}/storefront/${slug}`, {
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    if (res.status === 404) {
      return <ShopNotFound />;
    }
    throw new Error("Failed to fetch storefront data");
  }

  const data = (await res.json()) as StorefrontResponse;

  if (!data.success || !data.artisan) {
    return <ShopNotFound />;
  }

  const { artisan, products = [] } = data;
  
  const previewTheme = resolvedSearchParams.theme_preview as "terracotta" | "indigo" | "forest";
  const activeThemeKey = previewTheme || artisan.theme || "terracotta";
  const theme = THEMES[activeThemeKey] || THEMES.terracotta;

  const hasGiProducts = products.some(p => p.isGiCertified);

  return (
    <main className={`min-h-screen ${theme.bg} ${theme.bodyFont} transition-colors duration-500`}>
      {/* HERO SECTION */}
      <section className={`${theme.header} relative pb-16 pt-12 px-6 shadow-md overflow-hidden`}>
        <div className="max-w-5xl mx-auto relative z-10 flex flex-col items-center text-center">
          <div className="flex flex-wrap justify-center gap-3 mb-6">
            <span className="bg-white/20 backdrop-blur-sm text-white px-4 py-1.5 rounded-full text-sm font-medium inline-flex items-center gap-2 border border-white/30 shadow-sm">
              🏡 Verified Home Creator
            </span>
            {hasGiProducts && (
              <span className="bg-white/20 backdrop-blur-sm text-white px-4 py-1.5 rounded-full text-sm font-medium inline-flex items-center gap-2 border border-white/30 shadow-sm">
                🏛️ GI Heritage Certified Region
              </span>
            )}
          </div>
          
          <h1 className={`${theme.font} text-4xl md:text-6xl font-bold text-white mb-4 drop-shadow-sm`}>
            {artisan.name}
          </h1>
          
          {artisan.craftType && (
            <p className="text-white/90 text-lg md:text-xl font-medium max-w-2xl drop-shadow-sm">
              {artisan.craftType} from {artisan.region}
            </p>
          )}
        </div>
        
        {/* Decorative Wave Divider */}
        <div className="absolute bottom-0 left-0 right-0 translate-y-[1px]">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto drop-shadow-sm">
            <path d="M0,64L80,69.3C160,75,320,85,480,80C640,75,800,53,960,48C1120,43,1280,53,1360,58.7L1440,64L1440,120L1360,120C1280,120,1120,120,960,120C800,120,640,120,480,120C320,120,160,120,80,120L0,120Z" className={`fill-current ${theme.bg.replace('bg-', 'text-')}`}></path>
          </svg>
        </div>
      </section>

      {/* PRODUCTS SECTION */}
      <section className="max-w-5xl mx-auto px-4 md:px-8 py-12 md:py-16">
        {products.length === 0 ? (
          <EmptyState artisanName={artisan.name} theme={theme} />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-8">
            {products.map((product) => (
              <ProductCard 
                key={product.id} 
                product={product} 
                artisan={artisan} 
                theme={theme} 
                slug={slug} 
              />
            ))}
          </div>
        )}
      </section>

      {/* FOOTER */}
      <footer className="max-w-5xl mx-auto px-4 py-12 text-center border-t border-black/5 mt-auto">
        <p className={`${theme.subtext} font-medium mb-1`}>Powered by Kala-Mitra 🪔</p>
        <p className={`${theme.subtext} text-sm opacity-75`}>Supporting rural artisans of Karnataka</p>
      </footer>
    </main>
  );
}

function ProductCard({ product, artisan, theme, slug }: { product: Product, artisan: Artisan, theme: ThemeConfig, slug: string }) {
  const shareText = `ನಮಸ್ಕಾರ! ${artisan.name} ಅವರ ${product.titleEn} ₹${product.priceInr}ಗೆ ಲಭ್ಯವಿದೆ: ${process.env.NEXT_PUBLIC_SITE_URL || 'https://kalamitra.in'}/shop/${slug}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  return (
    <article className={`${theme.card} rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col group`}>
      {/* Image Container */}
      <div className="aspect-square w-full relative bg-black/5 overflow-hidden">
        {product.imageUrl ? (
          <img 
            src={product.imageUrl} 
            alt={product.titleEn} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-black/5 to-black/10">
            <span className={`${theme.font} text-6xl ${theme.text} opacity-40 font-bold uppercase`}>
              {product.titleEn.charAt(0)}
            </span>
          </div>
        )}
        
        {product.isGiCertified && (
          <div className="absolute top-3 right-3 z-10">
            <span className={`${theme.badge} px-2.5 py-1 rounded-full text-xs font-bold shadow-sm inline-flex items-center gap-1 backdrop-blur-md bg-opacity-90`}>
              <span className="text-[10px]">✦</span> GI TAG
            </span>
          </div>
        )}
      </div>
      
      {/* Content Container */}
      <div className="p-4 md:p-6 flex flex-col flex-grow">
        <h3 className={`${theme.font} ${theme.text} font-bold text-lg md:text-xl mb-2 line-clamp-2 leading-tight`}>
          {product.titleEn}
        </h3>
        
        <p className={`${theme.subtext} text-sm mb-5 line-clamp-3 leading-relaxed flex-grow`}>
          {product.descriptionSeo || "Handcrafted with traditional techniques."}
        </p>
        
        <div className="mt-auto space-y-4 pt-4 border-t border-black/5">
          <div className={`${theme.text} text-2xl font-bold tracking-tight`}>
            ₹{product.priceInr}
          </div>
          
          <div className="grid grid-cols-1 gap-2.5">
            <a 
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`w-full ${theme.accent} py-2.5 rounded-xl font-medium text-sm transition-all shadow-sm active:scale-[0.98] block text-center`}
            >
              Buy via UPI
            </a>
            <a 
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`w-full bg-transparent border-2 ${theme.badge.split(' ').find(c => c.startsWith('border-')) || 'border-black/20'} ${theme.text} hover:bg-black/5 py-2 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2`}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Share
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}

function EmptyState({ artisanName, theme }: { artisanName: string, theme: ThemeConfig }) {
  return (
    <div className={`${theme.card} rounded-3xl p-12 text-center shadow-sm max-w-2xl mx-auto my-12 flex flex-col items-center`}>
      <div className={`w-32 h-32 mb-8 ${theme.badge.split(' ').find(c => c.startsWith('text-')) || 'text-black/50'} opacity-75`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M8 12h8"></path>
          <path d="M12 8v8"></path>
          <path d="M9.5 8.5l5 5"></path>
          <path d="M14.5 8.5l-5 5"></path>
        </svg>
      </div>
      <h3 className={`${theme.font} text-2xl font-bold ${theme.text} mb-3`}>Products coming soon</h3>
      <p className={`${theme.subtext} text-lg max-w-md mx-auto leading-relaxed`}>
        Check back after {artisanName} adds her first item!
      </p>
    </div>
  );
}

function ShopNotFound() {
  return (
    <main className="min-h-screen bg-amber-50 flex items-center justify-center p-6">
      <div className="bg-white border border-amber-100 rounded-3xl p-12 max-w-lg text-center shadow-lg">
        <div className="text-6xl mb-6">🪔</div>
        <h1 className="text-3xl font-bold text-orange-900 mb-4">This shop hasn't opened yet</h1>
        <p className="text-amber-700 text-lg">
          The artisan is still setting up their storefront. Please check back later!
        </p>
      </div>
    </main>
  );
}
