import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f8f5ef] px-6 py-16 text-[#181612]">
      <section className="mx-auto flex max-w-5xl flex-col gap-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#9b3d1f]">
            Sakhi Marketplace
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight sm:text-6xl">
            Heritage craft storefronts built for artisan-led commerce.
          </h1>
          <p className="mt-6 text-lg leading-8 text-[#5f584d]">
            Browse curated storefronts from independent makers, with authentic
            craft details and product collections ready for checkout.
          </p>
        </div>

        <Link
          href="/shop/pottery-jane"
          className="w-fit rounded-full bg-[#181612] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#3d352a]"
        >
          View sample storefront
        </Link>
      </section>
    </main>
  );
}
