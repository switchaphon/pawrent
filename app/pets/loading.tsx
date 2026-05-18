export default function PetsLoading() {
  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 bg-surface/80 backdrop-blur-md border-b border-border px-4 py-3">
        <span className="skeleton block rounded-full h-6 w-32" aria-hidden />
      </header>
      <main className="px-4 py-6 max-w-md mx-auto space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            role="status"
            aria-label="กำลังโหลด"
            className="bg-surface border border-border rounded-[24px] shadow-soft p-4"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="skeleton rounded-full w-14 h-14" aria-hidden />
              <div className="flex-1 space-y-2">
                <span className="skeleton block rounded-full h-3.5 w-28" aria-hidden />
                <span className="skeleton block rounded-full h-2.5 w-20" aria-hidden />
              </div>
            </div>
            <span className="skeleton block rounded-full h-2 w-full" aria-hidden />
          </div>
        ))}
      </main>
    </div>
  );
}
