"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { SCENE_SIZE } from "@/lib/geo/frame";
import { AGE_CLASSES, markerRadius } from "@/components/scene/markers";
import { useUnitsPerPx } from "@/components/scene/useUnitsPerPx";
import type { LiveFire } from "./live";

const VIEW_BOX = [0, 0, SCENE_SIZE.width, SCENE_SIZE.depth];

/**
 * The home page's picture: the IGN aerial mosaic of the map's frame, turned to
 * a grey thermal-camera base, and the twelve months' fires on it in the thermal
 * ramp, the same markers as on the map. Real data; it opens the map.
 */
export function ThermalView({ fires }: { fires: readonly LiveFire[] | undefined }) {
  const { ref, unitsPerPx } = useUnitsPerPx(VIEW_BOX);
  // Coolest and largest first, so recent and small fires stay on top.
  const markers = useMemo(
    () => (fires ? [...fires].sort((a, b) => b.ageClass - a.ageClass || b.areaHa - a.areaHa) : []),
    [fires],
  );

  return (
    <figure className="relative m-0">
      <Link
        href="/carte"
        tabIndex={-1}
        aria-hidden
        className="group relative block overflow-hidden rounded-lg border border-rule-strong bg-sea"
        style={{ aspectRatio: `${SCENE_SIZE.width} / ${SCENE_SIZE.depth}` }}
      >
        <Image
          src="/data/fonds/ortho-france.jpg"
          alt=""
          width={2048}
          height={1924}
          priority
          sizes="(min-width: 1024px) 46vw, 100vw"
          className="absolute inset-0 size-full object-cover [filter:grayscale(1)_brightness(0.42)_contrast(1.3)] light:[filter:grayscale(1)_brightness(1.55)_contrast(0.62)] transition-[filter] duration-500 group-hover:[filter:grayscale(1)_brightness(0.5)_contrast(1.3)] light:group-hover:[filter:grayscale(1)_brightness(1.45)_contrast(0.7)]"
        />
        <svg ref={ref} viewBox={VIEW_BOX.join(" ")} className="absolute inset-0 size-full">
          {markers.map((fire) => (
            <circle
              key={fire.id}
              cx={fire.center[0] + SCENE_SIZE.width / 2}
              cy={fire.center[1] + SCENE_SIZE.depth / 2}
              r={markerRadius(fire.areaHa) * 0.8 * unitsPerPx}
              fill={`var(${AGE_CLASSES[fire.ageClass].token})`}
              fillOpacity={fire.ageClass === 2 ? 0.75 : 1}
              stroke="var(--marker-edge)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        {/* Targeting reticle, as in the mark. */}
        <span aria-hidden className="pointer-events-none absolute inset-3 sm:inset-4">
          <span className="absolute left-0 top-0 size-5 border-l-2 border-t-2 border-ink/70" />
          <span className="absolute right-0 top-0 size-5 border-r-2 border-t-2 border-ink/70" />
          <span className="absolute bottom-0 left-0 size-5 border-b-2 border-l-2 border-ink/70" />
          <span className="absolute bottom-0 right-0 size-5 border-b-2 border-r-2 border-ink/70" />
        </span>
      </Link>
      <figcaption className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-2">
        {AGE_CLASSES.map((c) => (
          <span key={c.token} className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-full" style={{ background: `var(${c.token})` }} />
            {c.label}
          </span>
        ))}
        <span className="text-ink-3">Fond : photographies aériennes IGN</span>
      </figcaption>
    </figure>
  );
}
