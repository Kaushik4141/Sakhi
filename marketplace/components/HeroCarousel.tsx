import Image from 'next/image';

export default function HeroCarousel() {
  return (
    <div className="w-full bg-black py-4">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
        <div className="relative w-full h-[250px] sm:h-[350px] md:h-[400px] bg-[#1a1a1a] overflow-hidden">
          {/* Banner Content Overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent z-10 flex flex-col justify-center px-8 md:px-16">
            <p className="text-[#f3d286] font-bold tracking-widest uppercase text-sm mb-2">Featured Collection</p>
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-4 leading-tight">
              Authentic <br /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#f3d286] to-[#e05b33]">Heritage Crafts</span>
            </h2>
            <p className="text-sm md:text-base text-neutral-300 max-w-md mb-8 leading-relaxed">
              Support local artisans by purchasing directly from the makers. 100% genuine craftsmanship delivered to your doorstep.
            </p>
            <button className="w-fit bg-[#f3d286] text-black font-bold px-8 py-3 uppercase tracking-wider text-sm hover:bg-white hover:scale-105 transition-all">
              Shop Now
            </button>
          </div>
          {/* Background Image */}
          <Image
            src="https://images.unsplash.com/photo-1513519245088-0e12902e5a38?q=80&w=2000&auto=format&fit=crop"
            alt="Artisan crafts banner"
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-60 object-right"
          />
        </div>
      </div>
    </div>
  );
}
