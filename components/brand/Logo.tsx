/**
 * FireStrain's mark: a flame in three filled isotherms (signal orange, hot
 * yellow, white-hot core), the way a fire reads on an infrared image, held in a
 * satellite targeting reticle. Plain SVG, no client code: usable in server
 * components; app/icon.svg is the same drawing on a dark tile.
 */

const FLAME =
  "M16 3C17.5 7.5 23.5 11 23.5 18.5C23.5 24 20.2 28 16 28C11.8 28 8.5 24 8.5 18.5C8.5 14.5 10.8 11.6 12.6 9.6C12.8 12.4 13.8 14 15.2 14.6C14.6 10.6 15 6.4 16 3Z";
/** The flame, fitted inside the reticle. */
const FIT = "translate(16 17.5) scale(0.7) translate(-16 -17.5)";

export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className={className}>
      <path
        d="M3 9.5V3h6.5M22.5 3H29v6.5M29 22.5V29h-6.5M9.5 29H3v-6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="square"
      />
      <g transform={FIT}>
        <path d={FLAME} fill="var(--signal)" />
        <path d={FLAME} transform="translate(16 24) scale(0.62) translate(-16 -24)" fill="#ffc94a" />
        <path d={FLAME} transform="translate(16 25.5) scale(0.28) translate(-16 -25.5)" fill="#fff4d6" />
      </g>
    </svg>
  );
}

/** Mark and name; `tagline` adds the one-line description under the name. */
export function Logo({ tagline = false, size = 28 }: { tagline?: boolean; size?: number }) {
  return (
    <span className="flex items-center gap-2.5 text-ink">
      <LogoMark size={size} className="shrink-0" />
      <span className="leading-none">
        <span className="block font-display text-[1.125rem] font-bold tracking-[-0.03em]">FireStrain</span>
        {tagline && <span className="label mt-1 block">Feux de forêt · France</span>}
      </span>
    </span>
  );
}
