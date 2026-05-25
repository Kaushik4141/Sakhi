import Header from "@/components/Header";
import BecomeSellerForm from "./BecomeSellerForm";

export const runtime = "edge";

export default function BecomeSellerPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <Header />

      <section className="mx-auto max-w-3xl px-6 py-16 animate-fade-in-up">
        <div className="mb-12">
          <h1 className="text-4xl font-serif font-bold mb-4 tracking-wide text-white">Become a Seller</h1>
          <p className="text-neutral-400 text-lg">
            Join the Sakhi marketplace as an artisan. Share your heritage crafts with the world and connect directly with buyers who value authenticity.
          </p>
        </div>

        <div className="bg-[#111] border border-[#222] p-8 rounded-xl shadow-2xl">
          <BecomeSellerForm />
        </div>
      </section>
      
      {/* Footer / Trust badges */}
      <div className="border-t border-[#222222] bg-[#0a0a0a] mt-12 py-12">
        <div className="mx-auto max-w-[1400px] px-6 grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
          <div>
            <h4 className="text-white font-bold mb-3 uppercase tracking-wider text-sm">Empowerment</h4>
            <p className="text-sm text-neutral-400">Keep 100% of your listed price. We don't charge listing fees.</p>
          </div>
          <div>
            <h4 className="text-white font-bold mb-3 uppercase tracking-wider text-sm">Global Reach</h4>
            <p className="text-sm text-neutral-400">Connect with conscious buyers worldwide.</p>
          </div>
          <div>
            <h4 className="text-white font-bold mb-3 uppercase tracking-wider text-sm">Heritage Focus</h4>
            <p className="text-sm text-neutral-400">A platform dedicated to authentic traditional crafts.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
