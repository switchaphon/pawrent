"use client";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-8 text-center">
      <h1 className="text-2xl font-bold mb-2">You are offline</h1>
      <p className="text-muted-foreground mb-4">
        Please check your internet connection and try again.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-primary text-white rounded-lg"
      >
        Retry
      </button>
    </div>
  );
}
