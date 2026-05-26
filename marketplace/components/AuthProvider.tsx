"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

type User = {
  id: number;
  name: string;
  email: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
};

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load from localStorage on mount
    const storedToken = localStorage.getItem("sakhi_token");
    if (storedToken) {
      // Validate token with backend
      fetch('http://127.0.0.1:8787/api/auth/me', {
        headers: { Authorization: `Bearer ${storedToken}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setToken(storedToken);
          setUser(data.user);
        } else {
          localStorage.removeItem("sakhi_token");
        }
      })
      .catch(() => {
        console.error("Failed to validate token");
      })
      .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem("sakhi_token", newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem("sakhi_token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
