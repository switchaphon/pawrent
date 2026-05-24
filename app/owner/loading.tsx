export default function OwnerLoading() {
  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="px-4 max-w-md mx-auto pt-8">
        {/* Avatar + badge */}
        <div className="flex flex-col items-center gap-3 mb-6">
          <span className="skeleton rounded-full w-20 h-20" aria-hidden />
          <span className="skeleton rounded-full h-3 w-24" aria-hidden />
          <span className="skeleton rounded-full h-2.5 w-16" aria-hidden />
        </div>

        {/* สมุดพก completion card */}
        <div className="bg-surface border border-border rounded-[24px] shadow-soft p-5 mb-4">
          <span className="skeleton block rounded-full h-3 w-20 mb-4" aria-hidden />
          <div className="flex justify-center gap-4 mb-3">
            {[1, 2].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <span className="skeleton rounded-full w-12 h-12" aria-hidden />
                <span className="skeleton rounded-full h-2 w-10" aria-hidden />
              </div>
            ))}
          </div>
          <span className="skeleton block rounded-full h-2 w-full" aria-hidden />
        </div>

        {/* Notification toggle rows */}
        <div className="bg-surface border border-border rounded-[24px] shadow-soft p-4 space-y-3">
          <span className="skeleton block rounded-full h-3 w-28 mb-2" aria-hidden />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="skeleton block rounded-full h-2.5 w-24" aria-hidden />
              <span className="skeleton rounded-full w-10 h-5" aria-hidden />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
