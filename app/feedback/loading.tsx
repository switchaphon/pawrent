export default function FeedbackLoading() {
  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="px-4 max-w-md mx-auto pt-8">
        {/* Header */}
        <span className="skeleton block rounded-full h-4 w-32 mb-6" aria-hidden />

        {/* Textarea placeholder */}
        <div className="bg-surface border border-border rounded-[24px] shadow-soft p-5 mb-4">
          <div className="space-y-2">
            <span className="skeleton block rounded-full h-2.5 w-full" aria-hidden />
            <span className="skeleton block rounded-full h-2.5 w-full" aria-hidden />
            <span className="skeleton block rounded-full h-2.5 w-3/4" aria-hidden />
            <span className="skeleton block rounded-full h-2.5 w-1/2" aria-hidden />
          </div>
        </div>

        {/* Submit button placeholder */}
        <span className="skeleton block rounded-full h-12 w-full" aria-hidden />
      </div>
    </div>
  );
}
