"use client";

import { useRouter } from "next/navigation";
import { useCart } from "./CartProvider";
import { useAuth } from "./AuthProvider";

export default function CartCheckoutButton() {
  const { cartItems } = useCart();
  const { user } = useAuth();
  const router = useRouter();

  const handleProceed = () => {
    if (cartItems.length === 0) return;
    
    if (!user) {
      router.push('/login');
      return;
    }
    
    router.push('/checkout');
  };

  return (
    <button
      onClick={handleProceed}
      disabled={cartItems.length === 0}
      className="w-full flex items-center justify-center gap-2 bg-[#f3d286] hover:bg-white hover:scale-[1.02] text-black font-bold py-4 rounded transition-all shadow-lg text-sm tracking-wide uppercase disabled:opacity-50 disabled:cursor-not-allowed"
    >
      Proceed to Checkout
    </button>
  );
}
