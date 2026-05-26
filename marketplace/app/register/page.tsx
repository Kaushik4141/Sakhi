"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Link from "next/link";
import Header from "@/components/Header";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://127.0.0.1:8787/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, address, city, state, pincode }),
      });
      const data = await res.json() as any;

      if (data.success) {
        login(data.token, data.user);
        router.push("/profile");
      } else {
        setError(data.error || "Registration failed");
      }
    } catch (err) {
      setError("Failed to connect to backend");
    } finally {
      setLoading(false);
    }
  };

  const handleLiveLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    setFetchingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          // Reverse geocoding using Nominatim (OpenStreetMap) with forced English language
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=en`);
          const data = await res.json() as any;
          
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

  return (
    <main className="min-h-screen bg-black text-white">
      <Header />
      <div className="flex flex-col items-center justify-center pt-24 px-4">
        <div className="w-full max-w-md bg-[#0a0a0a] border border-[#222222] rounded-2xl p-8">
          <h1 className="text-3xl font-semibold mb-2">Create Account</h1>
          <p className="text-neutral-400 mb-8">Join Sakhi to discover authentic crafts.</p>

          {error && <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg mb-6">{error}</div>}

          <form onSubmit={handleRegister} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Full Name</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-[#111] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#f3d286] transition-colors" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Email Address</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-[#111] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#f3d286] transition-colors" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-[#111] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#f3d286] transition-colors" 
              />
            </div>

            <div className="border-t border-[#333] pt-5 mt-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Delivery Address</h3>
                <button 
                  type="button" 
                  onClick={handleLiveLocation}
                  disabled={fetchingLocation}
                  className="text-xs bg-[#222] hover:bg-[#333] border border-[#444] px-3 py-1.5 rounded flex items-center gap-1 transition-colors disabled:opacity-50"
                >
                  {fetchingLocation ? "Locating..." : "📍 Use Live Location"}
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <input 
                    type="text" 
                    placeholder="Full Address / Street"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full bg-[#111] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#f3d286] transition-colors text-sm" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input 
                    type="text" 
                    placeholder="City"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-[#111] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#f3d286] transition-colors text-sm" 
                  />
                  <input 
                    type="text" 
                    placeholder="Pincode"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    className="w-full bg-[#111] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#f3d286] transition-colors text-sm" 
                  />
                </div>
                <div>
                  <input 
                    type="text" 
                    placeholder="State"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full bg-[#111] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#f3d286] transition-colors text-sm" 
                  />
                </div>
              </div>
            </div>
            
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-[#f3d286] text-black font-semibold py-3 rounded-lg hover:bg-white transition-colors mt-4 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Account"}
            </button>
          </form>

          <p className="mt-6 text-center text-neutral-400 text-sm">
            Already have an account? <Link href="/login" className="text-[#f3d286] hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
