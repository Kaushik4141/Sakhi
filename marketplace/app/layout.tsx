import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sakhi Marketplace",
  description:
    "Heritage craft storefronts for independent artisans. Discover authentic, handcrafted products from India's finest makers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
