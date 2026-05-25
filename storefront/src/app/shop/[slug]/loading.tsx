export default function Loading() {
  return (
    <main className="min-h-screen p-4 md:p-8 max-w-5xl mx-auto animate-pulse">
      {/* Header Skeleton */}
      <section className="bg-white rounded-2xl p-6 md:p-10 shadow-sm border border-terracotta-100 mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="h-10 bg-terracotta-100 rounded-md w-64 mb-4"></div>
          <div className="h-6 bg-terracotta-50 rounded-md w-40"></div>
        </div>
        
        <div className="h-10 bg-terracotta-100 rounded-full w-48 self-start md:self-auto"></div>
      </section>

      {/* Products Grid Skeleton */}
      <section>
        <div className="h-8 bg-terracotta-100 rounded-md w-56 mb-6"></div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <article 
              key={i} 
              className="bg-white rounded-2xl overflow-hidden shadow-sm border border-terracotta-100 flex flex-col h-full"
            >
              <div className="bg-terracotta-100 h-48 w-full"></div>
              
              <div className="p-6 flex flex-col flex-grow">
                <div className="h-6 bg-terracotta-100 rounded-md w-3/4 mb-3"></div>
                <div className="h-4 bg-terracotta-50 rounded-md w-full mb-2"></div>
                <div className="h-4 bg-terracotta-50 rounded-md w-5/6 mb-6"></div>
                
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-terracotta-50">
                  <div className="h-6 bg-terracotta-100 rounded-md w-16"></div>
                  <div className="h-9 bg-terracotta-100 rounded-full w-24"></div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
