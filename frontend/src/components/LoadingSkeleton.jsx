// Shimmering placeholders shown while a card's data loads, shaped like the
// content that will replace them (rows of text, or a chart), so the page
// does not jump when it arrives. Uses the .skeleton class in styles.css.

function SkeletonRows({ rows = 3, className = "" }) {
  return (
    <div className={`space-y-3 py-2 ${className}`} role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="skeleton h-9 w-9 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3" style={{ width: `${72 - ((i * 17) % 30)}%` }} />
            <div className="skeleton h-2.5" style={{ width: `${46 - ((i * 11) % 18)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function SkeletonChart({ className = "" }) {
  const bars = [46, 68, 38, 82, 57, 74, 50, 64];
  return (
    <div className={`h-full w-full flex items-end gap-2 px-2 pb-2 ${className}`} role="status" aria-label="Loading">
      {bars.map((h, i) => (
        <div key={i} className="skeleton flex-1 rounded-md" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

export { SkeletonChart, SkeletonRows };
