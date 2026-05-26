"use client";

import Link from 'next/link';
import { useState } from 'react';
import { useCart } from './CartProvider';
import { useAuth } from './AuthProvider';

export default function Header() {
  const { cartCount } = useCart();
  const { user, logout } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full bg-[#0a0a0a] border-b border-[#333333] shadow-md">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
        
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl font-bold italic tracking-wide text-[#f3d286]">
            Sakhi
          </span>
        </Link>

        {/* Search Bar */}
        <div className="hidden md:flex flex-1 mx-8 lg:mx-16">
          <div className="relative w-full max-w-3xl">
            <input
              type="text"
              placeholder="Search for artisan products, crafts, and more..."
              className="w-full rounded-sm bg-[#1a1a1a] px-4 py-2.5 text-sm text-white placeholder-neutral-500 border border-[#333333] focus:outline-none focus:border-[#f3d286] transition-colors"
            />
            <button className="absolute right-0 top-0 h-full px-4 text-[#f3d286] hover:bg-[#222222] transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-6">
          <Link href="/become-seller" className="hidden sm:block text-sm font-medium text-white hover:text-[#f3d286] transition-colors">
            Become a Seller
          </Link>
          
          {/* Cart Icon */}
          <Link href="/cart" className="flex items-center gap-2 text-white hover:text-[#f3d286] transition-colors relative">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
            </svg>
            <span className="hidden sm:block text-sm font-medium">Cart</span>
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 sm:-right-4 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow">
                {cartCount}
              </span>
            )}
          </Link>

          {/* User Profile / Login */}
          {user ? (
            <div className="relative">
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="hidden sm:flex items-center gap-2 text-sm font-semibold text-[#f3d286] hover:text-white transition-colors focus:outline-none"
              >
                <div className="h-8 w-8 rounded-full bg-[#333333] flex items-center justify-center text-white border border-[#f3d286]">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                Hi, {user.name}
              </button>
              
              {isDropdownOpen && (
                <div className="absolute right-0 mt-3 w-48 bg-[#111111] border border-[#333333] rounded-lg shadow-xl overflow-hidden z-50">
                  <Link 
                    href="/profile" 
                    onClick={() => setIsDropdownOpen(false)}
                    className="block px-4 py-3 text-sm text-white hover:bg-[#222222] transition-colors"
                  >
                    My Profile
                  </Link>
                  <button 
                    onClick={() => {
                      setIsDropdownOpen(false);
                      logout();
                    }}
                    className="block w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-[#222222] transition-colors border-t border-[#333333]"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/login" className="hidden sm:block text-sm font-semibold text-white hover:text-[#f3d286] transition-colors">
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
