export default function Loading() {
  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="px-4 max-w-md mx-auto pt-8 space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            role="status"
            aria-label="กำลังโหลด"
            className="bg-surface border border-border rounded-[24px] shadow-soft p-5 flex flex-col gap-3"
          >
            <span className="skeleton block rounded-full h-4 w-2/3" aria-hidden />
            <span className="skeleton block rounded-full h-3 w-full" aria-hidden />
            <span className="skeleton block rounded-full h-3 w-3/4" aria-hidden />
          </div>
        ))}
      </div>
    </div>
  );
}
