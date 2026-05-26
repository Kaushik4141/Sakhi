"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Link from "next/link";
import Header from "@/components/Header";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://127.0.0.1:8787/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (data.success) {
        login(data.token, data.user);
        router.push("/profile");
      } else {
        setError(data.error || "Login failed");
      }
    } catch (err) {
      setError("Failed to connect to backend");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <Header />
      <div className="flex flex-col items-center justify-center pt-24 px-4">
        <div className="w-full max-w-md bg-[#0a0a0a] border border-[#222222] rounded-2xl p-8">
          <h1 className="text-3xl font-semibold mb-2">Welcome Back</h1>
          <p className="text-neutral-400 mb-8">Sign in to your Sakhi account.</p>

          {error && <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg mb-6">{error}</div>}

          <form onSubmit={handleLogin} className="space-y-5">
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
                className="w-full bg-[#111] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#f3d286] transition-colors" 
              />
            </div>
            
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-[#f3d286] text-black font-semibold py-3 rounded-lg hover:bg-white transition-colors mt-4 disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="mt-6 text-center text-neutral-400 text-sm">
            Don't have an account? <Link href="/register" className="text-[#f3d286] hover:underline">Create one</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
