"use client";

import { useState, useCallback } from "react";
import { useCart } from "./CartProvider";

/**
 * Dynamically loads the Razorpay checkout.js script once.
 */
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }

    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function CartCheckoutButton() {
  const { cartItems, cartTotal } = useCart();
  const [loading, setLoading] = useState(false);

  const handleCheckout = useCallback(async () => {
    if (cartItems.length === 0) return;
    
    setLoading(true);

    const loaded = await loadRazorpayScript();
    if (!loaded) {
      alert("Failed to load Razorpay. Please check your connection.");
      setLoading(false);
      return;
    }

    // Razorpay expects amount in paise (INR × 100)
    const amountInPaise = Math.round(cartTotal * 100);

    // Create a generic product name listing
    const productNames = cartItems.map(item => `${item.quantity}x ${item.name}`).join(", ");
    
    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY || "YOUR_RAZORPAY_KEY", 
      amount: amountInPaise,
      currency: "INR",
      name: "Sakhi Marketplace",
      description: `Cart Checkout: ${cartItems.length} items`,
      image: "/favicon.ico",
      handler: async function (response: any) {
        // POST payment details to our webhook endpoint
        try {
          const res = await fetch("/api/webhooks/razorpay", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              productId: "bulk_cart",
              productName: productNames,
              amount: cartTotal,
              paymentId: response.razorpay_payment_id,
              orderId: response.razorpay_order_id ?? null,
              signature: response.razorpay_signature ?? null,
              cartItems: cartItems
            }),
          });

          if (res.ok) {
            alert(
              `✅ Payment successful!\n\nThank you for supporting artisans!\nPayment ID: ${response.razorpay_payment_id}`
            );
            // Ideally, you'd clear the cart here!
          } else {
            alert("Payment went through but webhook confirmation failed.");
          }
        } catch {
          alert("Payment succeeded but failed to notify server.");
        }
      },
      prefill: {
        name: "",
        email: "",
        contact: "",
      },
      theme: {
        color: "#f3d286", 
      },
      modal: {
        ondismiss: () => {
          setLoading(false);
        },
      },
    };

    const razorpay = new (window as any).Razorpay(options);
    razorpay.open();
    setLoading(false);
  }, [cartTotal, cartItems]);

  return (
    <button
      onClick={handleCheckout}
      disabled={loading || cartItems.length === 0}
      className="w-full flex items-center justify-center gap-2 bg-[#f3d286] hover:bg-white hover:scale-[1.02] text-black font-bold py-4 rounded transition-all shadow-lg text-sm tracking-wide uppercase disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <>
          <svg className="h-5 w-5 animate-spin text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          Processing...
        </>
      ) : (
        "Proceed to Razorpay Checkout"
      )}
    </button>
  );
}
