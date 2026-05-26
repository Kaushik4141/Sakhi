// DB imports removed
import SellClientForm from "./SellClientForm";

export const runtime = "edge";

export default async function SellPage() {
  // Fetch existing artisans for the dropdown from the API
  const res = await fetch('http://127.0.0.1:8787/api/artisans', { cache: 'no-store' });
  const artisans = res.ok ? await res.json() : [];

  return (
    <main className="min-h-screen bg-noise bg-[#000000] text-white relative">
      {/* Dynamic Header */}
      <header className="glass-nav sticky top-0 z-50 flex items-center justify-between px-8 py-4">
        <a href="/" className="text-xl font-serif font-bold text-gradient tracking-wide">Sakhi</a>
        <a href="/" className="text-sm font-medium text-stone-400 hover:text-white transition">← Back to Marketplace</a>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-16 animate-fade-in-up">
        <div className="mb-12">
          <h1 className="text-4xl font-serif font-bold mb-4">Become a Seller</h1>
          <p className="text-stone-400 text-lg">List your heritage crafts on the Sakhi marketplace and connect with buyers globally.</p>
        </div>

        <div className="bento-tile glass p-8">
          <SellClientForm artisans={artisans} />
        </div>
      </section>
    </main>
  );
}
