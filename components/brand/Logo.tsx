/**
 * FireStrain's mark: a flame drawn as three nested contour lines, like a summit
 * on a topographic map — fire read on the relief, which is what the site does.
 * Plain SVG, no client code: usable in server components and in the favicon.
 */

/** Outer contour; the inner ones are the same shape scaled towards its base. */
const FLAME =
  "M16 3C17.5 7.5 23.5 11 23.5 18.5C23.5 24 20.2 28 16 28C11.8 28 8.5 24 8.5 18.5C8.5 14.5 10.8 11.6 12.6 9.6C12.8 12.4 13.8 14 15.2 14.6C14.6 10.6 15 6.4 16 3Z";

export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className={className}>
      <path d={FLAME} fill="none" stroke="var(--fire-month)" strokeWidth="2" strokeLinejoin="round" />
      <path
        d={FLAME}
        transform="translate(16 22.5) scale(0.6) translate(-16 -22.5)"
        fill="none"
        stroke="var(--fire-new)"
        strokeWidth="3.3"
        strokeLinejoin="round"
      />
      <path d={FLAME} transform="translate(16 24) scale(0.24) translate(-16 -24)" fill="var(--fire-new)" />
    </svg>
  );
}

/** Mark and name; `tagline` adds the one-line description under the name. */
export function Logo({ tagline = false, size = 28 }: { tagline?: boolean; size?: number }) {
  return (
    <span className="flex items-center gap-2">
      <LogoMark size={size} className="shrink-0" />
      <span className="leading-none">
        <span className="block text-[1.0625rem] font-bold tracking-[-0.01em] text-ink">FireStrain</span>
        {tagline && <span className="mt-0.5 block text-xs font-normal text-ink-3">Feux de forêt en France</span>}
      </span>
    </span>
  );
}
