import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb, schema } from "@/db";
import BuyNowButton from "./BuyNowButton";

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

export default async function StorefrontPage({ params }: StorefrontPageProps) {
  const { artisan_slug } = await params;
  const db = getDb();

  const artisan = await db.query.artisans.findFirst({
    where: eq(schema.artisans.slug, artisan_slug),
  });

  if (!artisan) {
    notFound();
  }

  const products = await db.query.products.findMany({
    where: eq(schema.products.artisanId, artisan.id),
    orderBy: (products, { asc }) => [asc(products.name)],
  });

  return (
    <main className="min-h-screen bg-[#f8f5ef]">
      {/* ── Artisan Header ────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-[#e2dcd2] bg-gradient-to-br from-[#fffaf0] via-[#f8f5ef] to-[#f0ebe1]">
        {/* Decorative background shapes */}
        <div className="pointer-events-none absolute -top-32 -right-32 h-80 w-80 rounded-full bg-[#c4501a]/[0.04] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-[#c4501a]/[0.03] blur-2xl" />

        <div className="relative mx-auto max-w-7xl px-6 py-14 md:px-10 lg:py-20">
          <div className="animate-fade-in-up">
            {/* Breadcrumb */}
            <nav className="mb-8 flex items-center gap-2 text-sm text-[#84786a]">
              <a
                href="/"
                className="transition-colors hover:text-[#c4501a]"
              >
                Home
              </a>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                fill="currentColor"
                className="h-3 w-3"
              >
                <path
                  fillRule="evenodd"
                  d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="font-medium text-[#5f584d]">
                {artisan.name}
              </span>
            </nav>

            {/* Artisan info */}
            <div className="grid gap-10 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#e2dcd2] bg-white/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#c4501a] shadow-sm backdrop-blur-sm">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-3.5 w-3.5"
                  >
                    <path d="M15.98 1.804a1 1 0 0 0-1.96 0l-.24 1.192a1 1 0 0 1-.784.785l-1.192.238a1 1 0 0 0 0 1.962l1.192.238a1 1 0 0 1 .785.785l.238 1.192a1 1 0 0 0 1.962 0l.238-1.192a1 1 0 0 1 .785-.785l1.192-.238a1 1 0 0 0 0-1.962l-1.192-.238a1 1 0 0 1-.785-.785l-.238-1.192ZM6.949 5.684a1 1 0 0 0-1.898 0l-.683 2.051a1 1 0 0 1-.633.633l-2.051.683a1 1 0 0 0 0 1.898l2.051.684a1 1 0 0 1 .633.632l.683 2.051a1 1 0 0 0 1.898 0l.683-2.051a1 1 0 0 1 .633-.633l2.051-.683a1 1 0 0 0 0-1.898l-2.051-.683a1 1 0 0 1-.633-.633L6.95 5.684ZM13.949 13.684a1 1 0 0 0-1.898 0l-.184.551a1 1 0 0 1-.632.633l-.551.183a1 1 0 0 0 0 1.898l.551.183a1 1 0 0 1 .633.633l.183.551a1 1 0 0 0 1.898 0l.184-.551a1 1 0 0 1 .632-.633l.551-.183a1 1 0 0 0 0-1.898l-.551-.184a1 1 0 0 1-.633-.632l-.183-.551Z" />
                  </svg>
                  Artisan Storefront
                </div>

                <h1
                  className="mt-5 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {artisan.name}
                </h1>

                {artisan.bio && (
                  <p className="mt-5 max-w-2xl text-lg leading-8 text-[#5f584d]">
                    {artisan.bio}
                  </p>
                )}
              </div>

              {/* Stats card */}
              <div className="w-full rounded-2xl border border-[#e2dcd2] bg-white/80 p-6 shadow-sm backdrop-blur-sm md:max-w-xs">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#c4501a] to-[#e06b2d] text-white shadow-md">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-5 w-5"
                    >
                      <path
                        fillRule="evenodd"
                        d="M6 5v1H4.667a1.75 1.75 0 0 0-1.743 1.598l-.826 9.5A1.75 1.75 0 0 0 3.84 19H16.16a1.75 1.75 0 0 0 1.743-1.902l-.826-9.5A1.75 1.75 0 0 0 15.333 6H14V5a4 4 0 0 0-8 0Zm4-2.5A2.5 2.5 0 0 0 7.5 5v1h5V5A2.5 2.5 0 0 0 10 2.5ZM7.5 10a2.5 2.5 0 0 0 5 0V8.75a.75.75 0 0 1 1.5 0V10a4 4 0 0 1-8 0V8.75a.75.75 0 0 1 1.5 0V10Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#84786a]">
                      Collection
                    </p>
                    <p className="text-2xl font-bold tabular-nums">
                      {products.length}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 border-t border-[#e2dcd2] pt-4 text-sm text-[#84786a]">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {products.length === 1
                    ? "1 product available"
                    : `${products.length} products available`}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Product Grid ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-12 md:px-10 lg:py-16">
        {products.length > 0 ? (
          <>
            <h2
              className="animate-fade-in-up mb-8 text-2xl font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Products
            </h2>

            <div className="stagger-children grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <article
                  key={product.id}
                  id={`product-${product.id}`}
                  className="group overflow-hidden rounded-2xl border border-[#e2dcd2] bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/[0.06]"
                >
                  {/* Image */}
                  <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-[#ede8de] to-[#ddd6c8]">
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center px-8 text-center">
                        <span className="text-sm font-semibold uppercase tracking-[0.2em] text-[#84786a]/60">
                          Sakhi Craft
                        </span>
                      </div>
                    )}

                    {/* GI Badge overlay on image */}
                    {product.isGiVerified && (
                      <div className="absolute top-3 right-3">
                        <div className="animate-badge-glow flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white/90 px-3 py-1.5 shadow-md backdrop-blur-sm">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="h-4 w-4 text-emerald-600"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.403 12.652a3 3 0 0 0 0-5.304 3 3 0 0 0-3.75-3.751 3 3 0 0 0-5.305 0 3 3 0 0 0-3.751 3.75 3 3 0 0 0 0 5.305 3 3 0 0 0 3.75 3.751 3 3 0 0 0 5.305 0 3 3 0 0 0 3.751-3.75Zm-2.546-4.46a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                            GI Verified
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card body */}
                  <div className="flex flex-col p-6">
                    <div className="flex-1">
                      <h3
                        className="text-xl font-semibold leading-7 tracking-tight"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        {product.name}
                      </h3>

                      {product.description && (
                        <p className="mt-2.5 line-clamp-2 text-sm leading-6 text-[#665f55]">
                          {product.description}
                        </p>
                      )}
                    </div>

                    {/* Price + Badge */}
                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <p className="text-2xl font-bold tabular-nums tracking-tight">
                        {formatPrice.format(product.price)}
                      </p>

                      {product.isGiVerified && (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
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
                          Verified Authentic Heritage Craft
                        </span>
                      )}
                    </div>

                    {/* Buy Now button slot */}
                    <div className="mt-5">
                      <BuyNowButton
                        productId={product.id}
                        productName={product.name}
                        price={product.price}
                      />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="animate-fade-in-up rounded-2xl border border-dashed border-[#cfc4b1] bg-white px-6 py-16 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#f0ebe1]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-6 w-6 text-[#84786a]"
              >
                <path d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625Z" />
                <path d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 0 1 3.434 1.279 9.768 9.768 0 0 0-6.963-6.963Z" />
              </svg>
            </div>
            <h2
              className="text-2xl font-semibold"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              No products yet
            </h2>
            <p className="mt-3 text-[#665f55]">
              This artisan storefront is ready — products can be added from the
              D1 database.
            </p>
          </div>
        )}
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-[#e2dcd2] bg-[#fffaf0]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 text-sm text-[#84786a] md:px-10">
          <p>
            &copy; {new Date().getFullYear()}{" "}
            <span className="font-semibold text-[#5f584d]">Sakhi</span>{" "}
            — Heritage Craft Marketplace
          </p>
          <a
            href="/"
            className="font-medium text-[#c4501a] transition-colors hover:text-[#8b3517]"
          >
            ← All Artisans
          </a>
        </div>
      </footer>
    </main>
  );
}
