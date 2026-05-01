export default function Loading({ label = "Loading…" }) {
  return (
    <div className="lc-loading" role="status">
      <span className="lc-loading-dot" aria-hidden />
      <span>{label}</span>
    </div>
  );
}
