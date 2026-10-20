"use client";

import { useMapStore } from "@/lib/store";

/** North indicator: rotates with the camera azimuth. */
export function NorthArrow() {
  const northDeg = useMapStore((state) => state.northDeg);
  const rounded = ((Math.round(northDeg) % 360) + 360) % 360;
  return (
    <svg
      width="22"
      height="40"
      viewBox="-11 -20 22 40"
      role="img"
      aria-label={rounded === 0 ? "Nord vers le haut" : `Nord à ${rounded}° dans le sens horaire`}
      className="overflow-visible"
    >
      <g transform={`rotate(${northDeg})`}>
        <text
          x="0"
          y="-10"
          textAnchor="middle"
          className="fill-bone-100 font-sans text-[10px] font-medium tracking-wider"
        >
          N
        </text>
        <path d="M0 -6 L5 16 L0 12 Z" fill="var(--bone-100)" />
        <path d="M0 -6 L-5 16 L0 12 Z" fill="none" stroke="var(--bone-100)" strokeWidth="1" />
      </g>
    </svg>
  );
}
