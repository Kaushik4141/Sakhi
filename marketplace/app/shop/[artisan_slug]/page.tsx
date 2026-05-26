import { notFound } from "next/navigation";
import type { Metadata, ResolvingMetadata } from "next";
import CheckoutButton from "@/components/CheckoutButton";

export const runtime = "edge";

type StorefrontPageProps = {
  params: Promise<{
    artisan_slug: string;
  }>;
};

const formatPrice = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export async function generateMetadata(
  { params }: StorefrontPageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { artisan_slug } = await params;
  
  try {
    const res = await fetch(`http://127.0.0.1:8787/storefront/${artisan_slug}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.artisan) {
        return {
          title: `${data.artisan.name} | Authentic Indian Crafts`,
          description: data.artisan.bio || `Shop authentic handcrafted products directly from ${data.artisan.name}.`,
          openGraph: {
            title: `${data.artisan.name} | Sakhi Marketplace`,
            description: data.artisan.bio || `Shop authentic handcrafted products directly from ${data.artisan.name}.`,
            type: "website",
          },
        };
      }
    }
  } catch (error) {
    console.error("Failed to fetch artisan for metadata");
  }

  return { title: "Artisan Not Found" };
}

export default async function StorefrontPage({ params }: StorefrontPageProps) {
  const { artisan_slug } = await params;

  // ── Data Fetching ──────────────────────────────────────────────
  let artisan = null;
  let products: any[] = [];

  try {
    const res = await fetch(`http://127.0.0.1:8787/storefront/${artisan_slug}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.artisan) {
        artisan = data.artisan;
        products = data.products || [];
      }
    }
  } catch (error) {
    console.error("Backend is not running or unreachable.");
  }

  if (!artisan) {
    notFound();
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "mainEntity": {
      "@type": "Person",
      "name": artisan.name,
      "description": artisan.bio || "",
      "url": `http://localhost:3000/shop/${artisan_slug}`
    }
  };

  return (
    <main className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* ═══════════════════════════════════════════════════════════
          CINEMATIC HERO — Artisan Profile
          ═══════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-gradient-to-b from-stone-100 to-white">
        {/* Subtle decorative circles */}
        <div className="pointer-events-none absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-amber-100/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-32 h-[400px] w-[400px] rounded-full bg-stone-200/50 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-6 py-20 md:px-10 md:py-28 lg:py-36">
          {/* Kicker label */}
          <p
            className="mb-4 text-xs font-bold uppercase tracking-[0.25em] text-amber-700/80"
            style={{ animationDelay: "0.1s" }}
          >
            ✦&ensp;Artisan Storefront
          </p>

          {/* Artisan Name */}
          <h1
            className="text-4xl font-extrabold leading-[1.08] tracking-tight text-stone-900 md:text-6xl lg:text-7xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {artisan.name}
          </h1>

          {/* Bio */}
          {artisan.bio && (
            <p className="mt-6 max-w-2xl text-lg leading-8 text-stone-600 md:text-xl md:leading-9">
              {artisan.bio}
            </p>
          )}

          {/* Quick stats strip */}
          <div className="mt-10 flex flex-wrap items-center gap-6 border-t border-stone-200 pt-8">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-900 text-sm text-white">
                {products.length}
              </span>
              <span className="text-sm font-medium text-stone-500">
                {products.length === 1 ? "Product" : "Products"} Available
              </span>
            </div>

            {products.some((p) => p.isGiVerified) && (
              <div className="flex items-center gap-2 rounded-full border border-amber-300/50 bg-amber-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-amber-800">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-3.5 w-3.5"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.403 12.652a3 3 0 0 0 0-5.304 3 3 0 0 0-3.75-3.751 3 3 0 0 0-5.305 0 3 3 0 0 0-3.751 3.75 3 3 0 0 0 0 5.305 3 3 0 0 0 3.75 3.751 3 3 0 0 0 5.305 0 3 3 0 0 0 3.751-3.75Zm-2.546-4.46a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
                    clipRule="evenodd"
                  />
                </svg>
                GI Certified Artisan
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          IMMERSIVE PRODUCT GRID
          ═══════════════════════════════════════════════════════════ */}
      <section className="mx-auto max-w-6xl px-6 py-12 md:px-10 lg:py-16">
        {products.length > 0 ? (
          <>
            <h2
              className="mb-10 text-sm font-bold uppercase tracking-[0.2em] text-stone-400"
            >
              Collection&ensp;/&ensp;{products.length}{" "}
              {products.length === 1 ? "piece" : "pieces"}
            </h2>

            <div className="stagger-children grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <article
                  key={product.id}
                  id={`product-${product.id}`}
                  className="group overflow-hidden rounded-xl border border-stone-200 bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                >
                  {/* ── Product Image ──────────────────────────── */}
                  <div className="relative aspect-[4/5] overflow-hidden bg-stone-100">
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-3 px-8">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1}
                          stroke="currentColor"
                          className="h-12 w-12 text-stone-300"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
                          />
                        </svg>
                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-300">
                          No image
                        </span>
                      </div>
                    )}

                    {/* ── GI Verified Badge (frosted glass) ───── */}
                    {product.isGiVerified && (
                      <div className="absolute top-3 right-3 z-10">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-900 shadow-sm backdrop-blur-md">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 16 16"
                            fill="currentColor"
                            className="h-3 w-3"
                          >
                            <path
                              fillRule="evenodd"
                              d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14Zm3.844-8.791a.75.75 0 0 0-1.188-.918l-3.7 4.79-1.649-1.833a.75.75 0 1 0-1.114 1.004l2.25 2.5a.75.75 0 0 0 1.15-.043l4.25-5.5Z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Heritage Craft
                        </span>
                      </div>
                    )}

                    {/* Hover gradient overlay */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  </div>

                  {/* ── Product Details ────────────────────────── */}
                  <div className="flex flex-col gap-4 p-5">
                    <div>
                      <h3
                        className="text-xl font-semibold leading-7 tracking-tight text-stone-900"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        {product.name}
                      </h3>

                      {product.description && (
                        <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-stone-500">
                          {product.description}
                        </p>
                      )}
                    </div>

                    {/* Price row */}
                    <div className="flex items-center justify-between">
                      <p className="text-2xl font-bold tabular-nums tracking-tight text-stone-900">
                        {formatPrice.format(product.price)}
                      </p>

                      {product.isGiVerified && (
                        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 ring-1 ring-amber-200">
                          GI Verified
                        </span>
                      )}
                    </div>

                    {/* ── Razorpay Checkout ──────────────────────── */}
                    <CheckoutButton
                      productId={product.id}
                      productName={product.name}
                      price={product.price}
                      artisanName={artisan.name}
                    />
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
          /* ── Empty State ──────────────────────────────────────── */
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-6 py-20 text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1}
              stroke="currentColor"
              className="mb-4 h-16 w-16 text-stone-300"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
              />
            </svg>
            <h2
              className="text-2xl font-semibold text-stone-800"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              No products yet
            </h2>
            <p className="mt-2 max-w-md text-stone-500">
              This artisan's storefront is ready. Products will appear here once
              they are added to the database.
            </p>
          </div>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════════════════════════ */}
      <footer className="border-t border-stone-200 bg-stone-50">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-stone-400 sm:flex-row md:px-10">
          <p>
            &copy; {new Date().getFullYear()}{" "}
            <span className="font-semibold text-stone-600">Sakhi</span>{" "}
            &mdash; Heritage Craft Marketplace
          </p>
          <a
            href="/"
            className="font-medium text-stone-500 transition-colors hover:text-stone-900"
          >
            &larr; Browse All Artisans
          </a>
        </div>
      </footer>
    </main>
  );
}
