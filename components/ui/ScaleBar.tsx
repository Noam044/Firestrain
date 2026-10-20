"use client";

import { niceLength } from "@/lib/geo/scale";
import { formatDistance } from "@/lib/format";
import { useMapStore } from "@/lib/store";

const MAX_WIDTH_PX = 120;

/** Scale bar valid at the centre of the view (the oblique view varies across the screen). */
export function ScaleBar() {
  const kmPer100px = useMapStore((state) => state.kmPer100px);
  if (kmPer100px == null || kmPer100px <= 0) return null;

  const lengthKm = niceLength((kmPer100px * MAX_WIDTH_PX) / 100);
  const widthPx = Math.round((lengthKm / kmPer100px) * 100);
  const label = formatDistance(lengthKm);

  return (
    <figure className="m-0" aria-label={`Échelle au centre de la vue : la barre représente ${label}`}>
      <div className="flex items-end gap-2">
        <div className="flex h-1.5 border border-bone-100" style={{ width: widthPx }} aria-hidden>
          <span className="h-full flex-1 bg-bone-100" />
          <span className="h-full flex-1" />
        </div>
        <span className="font-mono text-[11px] leading-none tabular text-bone-100">{label}</span>
      </div>
      <figcaption className="mt-1 text-[11px] leading-none text-ash-400">au centre de la vue</figcaption>
    </figure>
  );
}
