"use client";

import Link from "next/link";
import { useCart } from "@/components/CartProvider";
import Header from "@/components/Header";
import CartCheckoutButton from "@/components/CartCheckoutButton";

export default function CartPage() {
  const { cartItems, removeFromCart, updateQuantity, cartTotal } = useCart();

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <Header />
      
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-bold mb-8">Shopping Cart</h1>

        {cartItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-[#111] rounded-xl border border-[#222]">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 text-neutral-600 mb-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
            </svg>
            <h2 className="text-xl font-semibold mb-2">Your cart is empty</h2>
            <p className="text-neutral-400 mb-6">Looks like you haven't added any artisan products yet.</p>
            <Link href="/" className="bg-[#f3d286] text-black font-bold px-8 py-3 rounded hover:bg-white transition-colors shadow-lg">
              Continue Shopping
            </Link>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Cart Items */}
            <div className="flex-1">
              <div className="bg-[#111] rounded-xl border border-[#222] overflow-hidden">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex flex-col sm:flex-row items-center gap-6 p-6 border-b border-[#222] last:border-b-0">
                    <div className="w-24 h-24 bg-[#1a1a1a] rounded overflow-hidden shrink-0">
                      <img 
                        src={item.imageUrl || "https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=800&q=60"} 
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    
                    <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between w-full">
                      <div className="mb-4 sm:mb-0">
                        <h3 className="text-lg font-medium text-white mb-1">{item.name}</h3>
                        <p className="text-[#f3d286] font-bold">₹{item.price.toFixed(2)}</p>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="flex items-center border border-[#333] rounded bg-[#0a0a0a]">
                          <button 
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="px-3 py-1 text-neutral-400 hover:text-white hover:bg-[#222] transition-colors"
                          >
                            -
                          </button>
                          <span className="px-4 py-1 font-medium border-x border-[#333]">
                            {item.quantity}
                          </span>
                          <button 
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="px-3 py-1 text-neutral-400 hover:text-white hover:bg-[#222] transition-colors"
                          >
                            +
                          </button>
                        </div>
                        
                        <button 
                          onClick={() => removeFromCart(item.id)}
                          className="text-neutral-500 hover:text-red-500 transition-colors uppercase text-xs font-bold tracking-wider"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Order Summary */}
            <div className="w-full lg:w-[350px] shrink-0">
              <div className="bg-[#111] rounded-xl border border-[#222] p-6 sticky top-24">
                <h2 className="text-xl font-semibold mb-6 uppercase tracking-wider text-neutral-300">Order Summary</h2>
                
                <div className="flex justify-between mb-4 text-neutral-400">
                  <span>Subtotal ({cartItems.length} items)</span>
                  <span>₹{cartTotal.toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between mb-6 text-neutral-400">
                  <span>Shipping</span>
                  <span className="text-green-500">Free</span>
                </div>
                
                <div className="border-t border-[#333] pt-4 mb-6 flex justify-between items-end">
                  <span className="text-lg font-medium">Total Amount</span>
                  <span className="text-2xl font-bold text-white">₹{cartTotal.toFixed(2)}</span>
                </div>

                <CartCheckoutButton />
                
                <div className="mt-4 text-center">
                  <p className="text-xs text-neutral-500">
                    Safe and Secure Payments. 100% Authentic products.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
