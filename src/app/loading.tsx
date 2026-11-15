// Shown instantly while the next page loads, so every click gets immediate feedback.
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="flex min-h-[40vh] flex-col items-center justify-center gap-4">
      <span className="h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-700" />
      <span className="font-serif text-lg text-violet-900">Loading…</span>
    </div>
  );
}
