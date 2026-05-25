"use client";

type BuyNowButtonProps = {
  productId: number;
  productName: string;
  price: number;
};

export default function BuyNowButton({
  productId,
  productName,
  price,
}: BuyNowButtonProps) {
  return (
    <button
      id={`buy-now-${productId}`}
      onClick={() => {
        // TODO: integrate Razorpay / payment gateway
        console.log(`Buy now: ${productName} (₹${price})`);
      }}
      className="group relative w-full cursor-pointer overflow-hidden rounded-xl bg-gradient-to-r from-[#c4501a] to-[#e06b2d] px-6 py-3 text-sm font-semibold tracking-wide text-white shadow-md transition-all duration-300 hover:shadow-lg hover:shadow-orange-900/20 active:scale-[0.97]"
    >
      {/* shimmer overlay */}
      <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      <span className="relative flex items-center justify-center gap-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4"
        >
          <path d="M1 1.75A.75.75 0 0 1 1.75 1h1.628a1.75 1.75 0 0 1 1.734 1.51L5.18 3H17.25a.75.75 0 0 1 .729.927l-1.578 6.316A2.25 2.25 0 0 1 14.218 12H6.782a2.25 2.25 0 0 1-2.183-1.757L3.024 2.5H1.75A.75.75 0 0 1 1 1.75ZM6 17.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3ZM15.5 17.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" />
        </svg>
        Buy Now
      </span>
    </button>
  );
}
