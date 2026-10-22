import type { ReactNode } from "react";

/** Plain status line over the map area (loading, errors) — no fake progress. */
export function MapStatus({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center tabular text-xs text-ink-3"
    >
      {children}
    </div>
  );
}
