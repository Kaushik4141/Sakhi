"use client";

import { useState, useCallback } from "react";

type CheckoutButtonProps = {
  productId: number;
  productName: string;
  price: number; // in INR (e.g. 5000)
  artisanName: string;
};

/**
 * Dynamically loads the Razorpay checkout.js script once,
 * then resolves when it's ready.
 */
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }

    // Already loaded
    if ((window as unknown as Record<string, unknown>).Razorpay) {
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

export default function CheckoutButton({
  productId,
  productName,
  price,
  artisanName,
}: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleCheckout = useCallback(async () => {
    setLoading(true);

    const loaded = await loadRazorpayScript();
    if (!loaded) {
      alert("Failed to load Razorpay. Please check your connection.");
      setLoading(false);
      return;
    }

    // Razorpay expects amount in paise (INR × 100)
    const amountInPaise = price * 100;

    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY!,
      amount: amountInPaise,
      currency: "INR",
      name: "Sakhi Marketplace",
      description: `${productName} by ${artisanName}`,
      image: "/favicon.ico",
      // Note: In production, you'd create an order server-side first
      // and pass the order_id here. For test mode, we skip that.
      handler: async function (response: {
        razorpay_payment_id: string;
        razorpay_order_id?: string;
        razorpay_signature?: string;
      }) {
        // POST payment details to our webhook endpoint
        try {
          const res = await fetch("/api/webhooks/razorpay", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              productId,
              productName,
              amount: price,
              paymentId: response.razorpay_payment_id,
              orderId: response.razorpay_order_id ?? null,
              signature: response.razorpay_signature ?? null,
            }),
          });

          if (res.ok) {
            alert(
              `✅ Payment successful!\n\nPayment ID: ${response.razorpay_payment_id}`
            );
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
        color: "#292524", // stone-800
      },
      modal: {
        ondismiss: () => {
          setLoading(false);
        },
      },
    };

    const razorpay = new (
      window as unknown as {
        Razorpay: new (opts: typeof options) => { open: () => void };
      }
    ).Razorpay(options);

    razorpay.open();
    setLoading(false);
  }, [productId, productName, price, artisanName]);

  return (
    <button
      id={`checkout-${productId}`}
      onClick={handleCheckout}
      disabled={loading}
      className="group relative w-full cursor-pointer overflow-hidden rounded-lg bg-stone-900 px-6 py-3 text-sm font-semibold tracking-wide text-white shadow-md transition-all duration-300 hover:bg-stone-800 hover:shadow-lg active:scale-[0.97] disabled:cursor-wait disabled:opacity-70"
    >
      {/* Shimmer overlay */}
      <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

      <span className="relative flex items-center justify-center gap-2">
        {loading ? (
          <>
            <svg
              className="h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Loading…
          </>
        ) : (
          <>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path
                fillRule="evenodd"
                d="M6 5v1H4.667a1.75 1.75 0 0 0-1.743 1.598l-.826 9.5A1.75 1.75 0 0 0 3.84 19H16.16a1.75 1.75 0 0 0 1.743-1.902l-.826-9.5A1.75 1.75 0 0 0 15.333 6H14V5a4 4 0 0 0-8 0Zm4-2.5A2.5 2.5 0 0 0 7.5 5v1h5V5A2.5 2.5 0 0 0 10 2.5ZM7.5 10a2.5 2.5 0 0 0 5 0V8.75a.75.75 0 0 1 1.5 0V10a4 4 0 0 1-8 0V8.75a.75.75 0 0 1 1.5 0V10Z"
                clipRule="evenodd"
              />
            </svg>
            Buy Now
          </>
        )}
      </span>
    </button>
  );
}
