export default function PassportLoading() {
  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Pet selector chips row */}
      <div className="flex justify-center gap-3 px-4 pt-6 pb-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <span className="skeleton rounded-full w-11 h-11" aria-hidden />
            <span className="skeleton rounded-full h-2 w-8" aria-hidden />
          </div>
        ))}
      </div>

      <div className="px-4 max-w-md mx-auto space-y-3">
        {/* Hero card skeleton */}
        <div className="bg-surface border border-border rounded-[24px] shadow-soft p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="skeleton rounded-full w-16 h-16" aria-hidden />
            <div className="flex-1 space-y-2">
              <span className="skeleton block rounded-full h-4 w-28" aria-hidden />
              <span className="skeleton block rounded-full h-3 w-20" aria-hidden />
              <span className="skeleton block rounded-full h-2.5 w-32" aria-hidden />
            </div>
          </div>
        </div>

        {/* Zone card skeletons (3 cards for vaccine, parasite, weight) */}
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-surface border border-border rounded-[24px] shadow-soft p-4">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="skeleton rounded-full w-7 h-7" aria-hidden />
              <div className="flex-1 space-y-1.5">
                <span className="skeleton block rounded-full h-3 w-24" aria-hidden />
                <span className="skeleton block rounded-full h-2 w-16" aria-hidden />
              </div>
            </div>
            <span className="skeleton block rounded-full h-2 w-full" aria-hidden />
          </div>
        ))}

        {/* About + Memories zone skeletons */}
        {[1, 2].map((i) => (
          <div
            key={`extra-${i}`}
            className="bg-surface border border-border rounded-[24px] shadow-soft p-4"
          >
            <span className="skeleton block rounded-full h-3 w-20 mb-3" aria-hidden />
            <div className="space-y-2">
              <span className="skeleton block rounded-full h-2 w-full" aria-hidden />
              <span className="skeleton block rounded-full h-2 w-3/4" aria-hidden />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
