"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { DecodedFire } from "@/lib/data/fires";
import { useFranceOutline } from "@/lib/data/queries";
import { ringsBBox } from "@/lib/geo/polygon";
import { daysBetween } from "@/lib/span";
import { AGE_CLASSES, ageClass, markerRadius } from "@/components/scene/markers";
import { useUnitsPerPx } from "@/components/scene/useUnitsPerPx";

/**
 * The home page's picture: France and the fires of the last twelve months as
 * on the map (same markers, same colours), drawn flat from the live data.
 * A preview, not the map: it leads to /carte.
 */
export function LiveMap({ fires, asOf }: { fires: readonly DecodedFire[] | undefined; asOf: string | undefined }) {
  const outline = useFranceOutline();
  const shape = useMemo(() => {
    if (!outline.data) return null;
    const [x0, z0, x1, z1] = ringsBBox(outline.data.rings);
    const margin = 12;
    const d = outline.data.rings
      .map((ring) => {
        const points: string[] = [];
        for (let k = 0; k < ring.length; k += 2) points.push(`${ring[k].toFixed(1)} ${ring[k + 1].toFixed(1)}`);
        return `M${points.join("L")}Z`;
      })
      .join("");
    return { d, viewBox: [x0 - margin, z0 - margin, x1 - x0 + 2 * margin, z1 - z0 + 2 * margin] };
  }, [outline.data]);
  const { ref, unitsPerPx } = useUnitsPerPx(shape?.viewBox);
  // Older first and largest first, so recent and small fires stay on top.
  const markers = useMemo(
    () =>
      fires && asOf
        ? fires
            .map((fire) => ({ fire, age: ageClass(Math.max(0, daysBetween(fire.firedate, asOf))) }))
            .sort((a, b) => b.age - a.age || b.fire.areaHa - a.fire.areaHa)
        : [],
    [fires, asOf],
  );

  return (
    <figure className="m-0 rounded-lg border border-rule bg-sea p-3 sm:p-4">
      {/* The picture itself also opens the map, for the pointer; the keyboard has the link below. */}
      <Link href="/carte" tabIndex={-1} aria-hidden className="block aspect-square w-full">
        {shape && (
          <svg ref={ref} viewBox={shape.viewBox.join(" ")} className="h-full w-full">
            <path d={shape.d} fill="var(--relief-flat)" stroke="var(--coast)" strokeWidth={1} fillRule="evenodd" vectorEffect="non-scaling-stroke" />
            {markers.map(({ fire, age }) => (
              <circle
                key={fire.id}
                cx={fire.center[0]}
                cy={fire.center[1]}
                r={markerRadius(fire.areaHa) * 0.7 * unitsPerPx}
                fill={`var(${AGE_CLASSES[age].token})`}
                stroke="#ffffff"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
        )}
      </Link>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-2">
        {AGE_CLASSES.map((c) => (
          <span key={c.token} className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-full ring-1 ring-white" style={{ background: `var(${c.token})` }} />
            {c.label}
          </span>
        ))}
        <Link href="/carte" className="ml-auto font-bold text-ink hover:underline">
          Ouvrir la carte →
        </Link>
      </figcaption>
    </figure>
  );
}
