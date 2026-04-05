export default function PetsLoading() {
  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="h-6 w-32 bg-muted rounded animate-pulse" />
      </header>
      <main className="px-4 py-6 max-w-md mx-auto space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-muted rounded-2xl animate-pulse" />
        ))}
      </main>
    </div>
  );
}
