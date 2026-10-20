"use client";

import { formatInteger, formatLatitude, formatLongitude } from "@/lib/format";
import { useMapStore } from "@/lib/store";

/**
 * Coordinates under the pointer (WGS84 and Lambert-93) with the BD ALTI value of
 * the DEM cell. Pointer-only and redundant with the map, so hidden from assistive tech.
 */
export function CursorReadout() {
  const cursor = useMapStore((state) => state.cursor);
  return (
    <div
      aria-hidden
      className="hidden w-[19rem] border border-ash-800 bg-ash-950 px-3 py-2 text-right font-mono text-[11px] leading-4 tabular text-bone-300 [@media(pointer:fine)]:block"
    >
      {cursor ? (
        <>
          <div>
            {formatLatitude(cursor.lat)} · {formatLongitude(cursor.lon)}
          </div>
          <div>
            Lambert-93 {formatInteger(cursor.x)} · {formatInteger(cursor.y)} m
          </div>
          <div className="text-ash-400">
            {!cursor.inFrance
              ? "Hors France métropolitaine"
              : cursor.altitudeM == null
                ? "Altitude non renseignée"
                : `Altitude ≈ ${formatInteger(cursor.altitudeM)} m (maille du relief)`}
          </div>
        </>
      ) : (
        <div className="text-ash-400">Survolez la carte pour lire les coordonnées</div>
      )}
    </div>
  );
}
