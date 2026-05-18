export default function DiaryLoading() {
  return (
    <div className="min-h-dvh pb-10">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pb-4 pt-1">
        <div className="space-y-1.5">
          <span className="skeleton block rounded-full h-2.5 w-16" aria-hidden />
          <span className="skeleton block rounded-full h-5 w-36" aria-hidden />
        </div>
        <span className="skeleton rounded-full w-[42px] h-[42px]" aria-hidden />
      </div>

      {/* Pet filter chips */}
      <div className="flex gap-2 overflow-hidden px-5 pb-4">
        {[1, 2, 3].map((i) => (
          <span key={i} className="skeleton rounded-full h-8 w-20 flex-shrink-0" aria-hidden />
        ))}
      </div>

      <div className="px-4 max-w-md mx-auto space-y-3">
        {/* Urgent card skeleton */}
        <div className="bg-surface border border-border rounded-2xl shadow-soft p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="skeleton rounded-full w-6 h-6" aria-hidden />
            <span className="skeleton block rounded-full h-3 w-24" aria-hidden />
          </div>
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 py-2.5 border-t border-border-subtle">
              <span className="skeleton rounded-full w-10 h-10 flex-shrink-0" aria-hidden />
              <div className="flex-1 space-y-1.5">
                <span className="skeleton block rounded-full h-3 w-40" aria-hidden />
                <span className="skeleton block rounded-full h-2 w-24" aria-hidden />
              </div>
              <span className="skeleton rounded-full h-8 w-16 flex-shrink-0" aria-hidden />
            </div>
          ))}
        </div>

        {/* Day group label */}
        <span className="skeleton block rounded-full h-2.5 w-28 ml-1" aria-hidden />

        {/* Timeline card skeletons */}
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-surface border border-border rounded-2xl shadow-soft p-4"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="skeleton rounded-full w-9 h-9 flex-shrink-0" aria-hidden />
              <div className="flex-1 space-y-1.5">
                <span className="skeleton block rounded-full h-3 w-32" aria-hidden />
                <span className="skeleton block rounded-full h-2 w-20" aria-hidden />
              </div>
            </div>
            {i === 1 && (
              <span className="skeleton block rounded-xl h-[160px] w-full" aria-hidden />
            )}
          </div>
        ))}

        {/* Another day group */}
        <span className="skeleton block rounded-full h-2.5 w-20 ml-1 mt-2" aria-hidden />

        {[4, 5].map((i) => (
          <div
            key={i}
            className="bg-surface border border-border rounded-2xl shadow-soft p-4"
          >
            <div className="flex items-center gap-3">
              <span className="skeleton rounded-full w-9 h-9 flex-shrink-0" aria-hidden />
              <div className="flex-1 space-y-1.5">
                <span className="skeleton block rounded-full h-3 w-28" aria-hidden />
                <span className="skeleton block rounded-full h-2 w-16" aria-hidden />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
