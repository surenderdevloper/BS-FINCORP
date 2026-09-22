export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading…">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-6 w-40 animate-pulse rounded-lg bg-zinc-200" />
          <div className="h-3.5 w-56 animate-pulse rounded bg-zinc-200/70" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-28 animate-pulse rounded-lg bg-zinc-200" />
          <div className="h-10 w-32 animate-pulse rounded-lg bg-zinc-200" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm sm:p-4">
            <div className="h-3 w-24 animate-pulse rounded bg-zinc-200" />
            <div className="mt-2 h-6 w-16 animate-pulse rounded bg-zinc-200" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="h-64 animate-pulse rounded-xl border border-zinc-200 bg-white shadow-sm" />
        <div className="h-64 animate-pulse rounded-xl border border-zinc-200 bg-white shadow-sm" />
      </div>
    </div>
  );
}