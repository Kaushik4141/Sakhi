"use client";

import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Header from "@/components/Header";

export default function ProfilePage() {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <main className="min-h-screen bg-black text-white">
        <Header />
        <div className="flex justify-center pt-32">
          <p className="text-neutral-500">Loading profile...</p>
        </div>
      </main>
    );
  }

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <Header />
      <div className="max-w-4xl mx-auto px-4 pt-16">
        <h1 className="text-4xl font-semibold mb-8 text-[#f3d286]">My Profile</h1>
        
        <div className="bg-[#0a0a0a] border border-[#222222] rounded-2xl p-8 mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold mb-1">{user.name}</h2>
            <p className="text-neutral-400">{user.email}</p>
          </div>
          <div className="h-16 w-16 bg-[#222222] rounded-full flex items-center justify-center text-xl font-bold text-[#f3d286]">
            {user.name.charAt(0).toUpperCase()}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#0a0a0a] border border-[#222222] rounded-2xl p-6">
            <h3 className="text-xl font-medium mb-4">Account Details</h3>
            <ul className="space-y-3 text-neutral-400">
              <li><strong className="text-neutral-300">Member ID:</strong> #{user.id}</li>
              <li><strong className="text-neutral-300">Status:</strong> Active</li>
            </ul>
          </div>

          <div className="bg-[#0a0a0a] border border-[#222222] rounded-2xl p-6">
            <h3 className="text-xl font-medium mb-4">Saved Location</h3>
            {user.city ? (
              <ul className="space-y-3 text-neutral-400">
                <li><strong className="text-neutral-300">Address:</strong> {user.address || 'N/A'}</li>
                <li><strong className="text-neutral-300">City:</strong> {user.city}</li>
                <li><strong className="text-neutral-300">State:</strong> {user.state}</li>
                <li><strong className="text-neutral-300">Pincode:</strong> {user.pincode}</li>
              </ul>
            ) : (
              <p className="text-neutral-500 italic">No location saved.</p>
            )}
          </div>

          <div className="bg-[#0a0a0a] border border-[#222222] rounded-2xl p-6 md:col-span-2">
            <h3 className="text-xl font-medium mb-4">Actions</h3>
            <button 
              onClick={handleLogout}
              className="px-6 py-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors w-full sm:w-auto"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
