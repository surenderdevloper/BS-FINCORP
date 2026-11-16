export default function GenericAppLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading…">
      <div className="space-y-2">
        <div className="h-7 w-48 animate-pulse rounded-lg bg-zinc-200" />
        <div className="h-4 w-72 animate-pulse rounded bg-zinc-200/70" />
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          <div className="h-10 w-full animate-pulse rounded-lg bg-zinc-100" />
          <div className="h-32 w-full animate-pulse rounded-lg bg-zinc-50" />
          <div className="h-32 w-full animate-pulse rounded-lg bg-zinc-50" />
        </div>
      </div>
    </div>
  );
}
