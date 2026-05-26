import Link from "next/link";

export default function ThemePreviewPage() {
  const previews = [
    {
      id: "terracotta",
      name: "Terracotta Theme",
      desc: "Warm, earthy, clay pottery feel",
      url: "/shop/meena-devi-demo?theme_preview=terracotta",
    },
    {
      id: "indigo",
      name: "Indigo Theme",
      desc: "Rich, silk saree, royal Karnataka feel",
      url: "/shop/savitha-silks?theme_preview=indigo",
    },
    {
      id: "forest",
      name: "Forest Theme",
      desc: "Fresh, bamboo craft, natural materials feel",
      url: "/shop/prakruthi-crafts?theme_preview=forest",
    },
  ];

  return (
    <main className="min-h-screen bg-neutral-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto mb-8 text-center">
        <h1 className="text-3xl font-bold text-neutral-900 mb-2">Artisan Storefront Themes</h1>
        <p className="text-neutral-600">Side-by-side preview of dynamic styling capabilities</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
        {previews.map((preview) => (
          <div key={preview.id} className="flex flex-col bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
            <div className="p-4 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/50">
              <div>
                <h2 className="font-semibold text-neutral-800">{preview.name}</h2>
                <p className="text-xs text-neutral-500 mt-0.5">{preview.desc}</p>
              </div>
              <Link 
                href={preview.url} 
                target="_blank"
                className="text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-full transition-colors"
              >
                Open full
              </Link>
            </div>
            
            <div className="relative w-full h-[800px] overflow-hidden bg-neutral-200">
              {/* 
                We use CSS transform scale to fit a full desktop view into the column.
                A scale of 0.6 means the iframe acts like it is 1 / 0.6 = 1.66x wider.
                So an 800px iframe container effectively simulates a 1333px screen width inside it.
              */}
              <div 
                className="absolute top-0 left-0 origin-top-left"
                style={{ 
                  width: 'calc(100% / 0.65)', 
                  height: 'calc(100% / 0.65)', 
                  transform: 'scale(0.65)' 
                }}
              >
                <iframe 
                  src={preview.url} 
                  className="w-full h-full border-0 bg-white"
                  title={`${preview.name} Preview`}
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
