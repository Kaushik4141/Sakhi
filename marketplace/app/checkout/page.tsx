"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useCart } from "@/components/CartProvider";
import Header from "@/components/Header";

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

export default function CheckoutPage() {
  const { user } = useAuth();
  const { cartItems, cartTotal } = useCart();
  const router = useRouter();

  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Pre-fill with user's saved address
  useEffect(() => {
    if (user) {
      setAddress(user.address || "");
      setCity(user.city || "");
      setState(user.state || "");
      setPincode(user.pincode || "");
    } else {
      router.push('/login');
    }
  }, [user, router]);

  // Redirect to cart if empty
  useEffect(() => {
    if (cartItems.length === 0) {
      router.push('/cart');
    }
  }, [cartItems, router]);

  const handleLiveLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    setFetchingLocation(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=en`);
          const data = await res.json();
          
          if (data.address) {
            setAddress(data.display_name || "");
            setCity(data.address.city || data.address.town || data.address.village || "");
            setState(data.address.state || "");
            setPincode(data.address.postcode || "");
          }
        } catch (err) {
          setError("Failed to fetch address from coordinates");
        } finally {
          setFetchingLocation(false);
        }
      },
      () => {
        setError("Unable to retrieve your location. Please check browser permissions.");
        setFetchingLocation(false);
      }
    );
  };

  const handlePayment = useCallback(async () => {
    if (!address || !city || !state || !pincode) {
      setError("Please complete your delivery address before proceeding to payment.");
      return;
    }

    setLoading(true);

    const loaded = await loadRazorpayScript();
    if (!loaded) {
      setError("Failed to load Razorpay. Please check your connection.");
      setLoading(false);
      return;
    }

    const amountInPaise = Math.round(cartTotal * 100);
    const productNames = cartItems.map(item => `${item.quantity}x ${item.name}`).join(", ");
    
    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY || "YOUR_RAZORPAY_KEY", 
      amount: amountInPaise,
      currency: "INR",
      name: "Sakhi Marketplace",
      description: `Cart Checkout: ${cartItems.length} items`,
      image: "/favicon.ico",
      handler: async function (response: any) {
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
              cartItems: cartItems,
              shippingAddress: { address, city, state, pincode }
            }),
          });

          if (res.ok) {
            alert(`✅ Payment successful!\n\nThank you for supporting artisans!\nPayment ID: ${response.razorpay_payment_id}`);
            router.push('/'); // Or a success page
          } else {
            alert("Payment went through but webhook confirmation failed.");
          }
        } catch {
          alert("Payment succeeded but failed to notify server.");
        }
      },
      prefill: {
        name: user?.name || "",
        email: user?.email || "",
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
  }, [cartTotal, cartItems, user, router, address, city, state, pincode]);

  if (!user || cartItems.length === 0) return null;

  return (
    <main className="min-h-screen bg-black text-white">
      <Header />
      
      <div className="mx-auto max-w-[1000px] px-4 py-12">
        <h1 className="text-3xl font-semibold mb-8 border-b border-[#222] pb-4">Checkout</h1>
        
        <div className="flex flex-col lg:flex-row gap-10">
          
          {/* Address Section */}
          <div className="flex-1">
            <div className="bg-[#0a0a0a] border border-[#222222] rounded-2xl p-6 md:p-8">
              <div className="flex items-center justify-between mb-6 border-b border-[#222] pb-4">
                <h2 className="text-xl font-medium">Delivery Address</h2>
                <button 
                  type="button" 
                  onClick={handleLiveLocation}
                  disabled={fetchingLocation}
                  className="text-xs bg-[#222] hover:bg-[#333] border border-[#444] px-3 py-2 rounded flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {fetchingLocation ? "Locating..." : "📍 Use Live Location"}
                </button>
              </div>

              {error && <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg mb-6">{error}</div>}

              <div className="space-y-5">
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Full Address / Street</label>
                  <input 
                    type="text" 
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full bg-[#111] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#f3d286] transition-colors" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-neutral-400 mb-1">City</label>
                    <input 
                      type="text" 
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full bg-[#111] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#f3d286] transition-colors" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-neutral-400 mb-1">Pincode</label>
                    <input 
                      type="text" 
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      className="w-full bg-[#111] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#f3d286] transition-colors" 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">State</label>
                  <input 
                    type="text" 
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full bg-[#111] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#f3d286] transition-colors" 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Order Summary & Payment */}
          <div className="w-full lg:w-[380px] shrink-0">
            <div className="bg-[#111] rounded-2xl border border-[#222] p-6 sticky top-24">
              <h2 className="text-xl font-medium mb-6 border-b border-[#222] pb-4">Order Summary</h2>
              
              <div className="space-y-3 mb-6 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {cartItems.map(item => (
                  <div key={item.id} className="flex justify-between items-center text-sm">
                    <span className="text-neutral-400 line-clamp-1 pr-4">{item.quantity}x {item.name}</span>
                    <span className="text-white shrink-0">₹{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              
              <div className="border-t border-[#333] pt-4 mb-6">
                <div className="flex justify-between mb-2 text-sm text-neutral-400">
                  <span>Subtotal</span>
                  <span>₹{cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between mb-4 text-sm text-neutral-400">
                  <span>Shipping</span>
                  <span className="text-green-500">Free</span>
                </div>
                <div className="flex justify-between items-end">
                  <span className="text-lg font-medium text-white">Total Amount</span>
                  <span className="text-2xl font-bold text-[#f3d286]">₹{cartTotal.toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={handlePayment}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-[#f3d286] hover:bg-white text-black font-bold py-4 rounded-xl transition-all shadow-lg uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Processing..." : "Pay Securely"}
              </button>
              
              <p className="mt-4 text-center text-xs text-neutral-500">
                100% Secure Razorpay Checkout.
              </p>
            </div>
          </div>
          
        </div>
      </div>
    </main>
  );
}
