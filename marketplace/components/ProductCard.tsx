"use client";

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCart } from './CartProvider';

interface Product {
  id: number;
  name: string;
  price: number;
  imageUrl: string | null;
  isGiVerified: boolean;
}

interface Artisan {
  name: string;
}

export default function ProductCard({ product, artisan }: { product: Product, artisan?: Artisan }) {
  const { addToCart } = useCart();
  const router = useRouter();

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
    });
  };

  const handleBuyNow = (e: React.MouseEvent) => {
    e.preventDefault();
    handleAddToCart(e);
    router.push('/checkout');
  };

  return (
    <div className="group relative flex flex-col overflow-hidden bg-[#111111] border border-[#222222] transition-all hover:border-[#444444] hover:shadow-[0_8px_30px_rgb(0,0,0,0.5)] hover:-translate-y-1">
      <div className="relative aspect-square w-full bg-[#1a1a1a] overflow-hidden">
        <Image
          src={product.imageUrl || 'https://images.unsplash.com/photo-1610701596007-11502861dcfa'}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover transition-transform duration-700 group-hover:scale-110 opacity-90 group-hover:opacity-100"
        />
        {product.isGiVerified && (
          <div className="absolute top-3 left-3 bg-gradient-to-r from-green-600 to-green-500 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-sm shadow-md z-10 flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
              <path fillRule="evenodd" d="M16.403 12.652a3 3 0 0 0 0-5.304 3 3 0 0 0-3.75-3.751 3 3 0 0 0-5.305 0 3 3 0 0 0-3.751 3.75 3 3 0 0 0 0 5.305 3 3 0 0 0 3.75 3.751 3 3 0 0 0 5.305 0 3 3 0 0 0 3.751-3.75Zm-2.546-4.46a.75.75 0 0 0-1.214-.883l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
            </svg>
            GI Verified
          </div>
        )}
      </div>
      
      <div className="flex flex-1 flex-col p-5">
        {artisan && (
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-1 z-10 relative pointer-events-none">
            By {artisan.name}
          </p>
        )}
        <h3 className="text-sm font-medium text-white line-clamp-2 min-h-[40px] group-hover:text-[#f3d286] transition-colors leading-relaxed">
          <Link href={`/shop/${product.id}`}>
            <span aria-hidden="true" className="absolute inset-0" />
            {product.name}
          </Link>
        </h3>
        
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xl font-bold text-white tracking-wide">
            ₹{product.price.toFixed(2)}
          </span>
          <span className="text-xs text-neutral-500 line-through">
            ₹{(product.price * 1.2).toFixed(2)}
          </span>
        </div>

        <div className="mt-4 pt-4 border-t border-[#222222] flex items-center gap-2 relative z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button 
            onClick={handleAddToCart}
            className="flex-1 bg-[#1a1a1a] hover:bg-[#333333] text-white text-[11px] font-semibold py-2.5 rounded transition-colors border border-[#333333] hover:border-[#555555]"
          >
            ADD TO CART
          </button>
          <button 
            onClick={handleBuyNow}
            className="flex-1 bg-[#f3d286] hover:bg-[#ffffff] hover:-translate-y-0.5 text-black text-[11px] font-bold py-2.5 rounded transition-all shadow hover:shadow-[0_4px_12px_rgba(243,210,134,0.3)]"
          >
            BUY NOW
          </button>
        </div>
      </div>
    </div>
  );
}
