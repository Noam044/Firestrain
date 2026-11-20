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
 * ramp, the same markers as on the map. Real data; it opens the map. The
 * markers fade in from the oldest to the most recent.
 */
export function ThermalView({ fires }: { fires: readonly LiveFire[] | undefined }) {
  const { ref, unitsPerPx } = useUnitsPerPx(VIEW_BOX);
  // Largest first inside each age group, so small fires stay on top.
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
          className="absolute inset-0 size-full object-cover [filter:grayscale(1)_brightness(0.42)_contrast(1.3)] light:[filter:grayscale(1)_brightness(1.55)_contrast(0.62)] transition-transform duration-700 ease-out group-hover:scale-[1.015]"
        />
        <svg
          ref={ref}
          viewBox={VIEW_BOX.join(" ")}
          className="absolute inset-0 size-full transition-transform duration-700 ease-out group-hover:scale-[1.015]"
        >
          {/* One group per age class, oldest first: three fades, not one per fire (1 700+ animations
              cost a second of style work). The picture fills in the order fires were detected. */}
          {[2, 1, 0].map((ageClass) => (
            <g key={ageClass} className="animate-fade-in" style={{ animationDelay: `${(2 - ageClass) * 260}ms` }}>
              {markers
                .filter((fire) => fire.ageClass === ageClass)
                .map((fire) => (
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
            </g>
          ))}
        </svg>
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
