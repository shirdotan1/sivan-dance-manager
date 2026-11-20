/** Shown instantly while a page's data (behind the login) loads. */
export default function Loading() {
  return (
    <div aria-busy="true" className="grid gap-4">
      <p className="text-muted" role="status">
        טוען…
      </p>
      <div className="card h-24 animate-pulse" />
      <div className="card h-40 animate-pulse" />
    </div>
  );
}
