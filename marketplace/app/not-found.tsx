import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center text-white px-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-8xl font-bold text-[#f3d286] mb-4">404</h1>
        <h2 className="text-2xl font-medium mb-6">Page Not Found</h2>
        <p className="text-neutral-400 mb-8">
          Sorry, we couldn't find the page or product you were looking for. It might have been removed or the link is incorrect.
        </p>
        <Link 
          href="/" 
          className="inline-flex items-center justify-center bg-[#f3d286] hover:bg-white hover:-translate-y-0.5 text-black font-bold px-8 py-3 rounded transition-all shadow-lg text-sm tracking-wide uppercase"
        >
          Return to Homepage
        </Link>
      </div>
    </div>
  );
}
