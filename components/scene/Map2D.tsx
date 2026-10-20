"use client";

import { useEffect, useMemo } from "react";
import { L93_EXTENT, SCENE_SIZE } from "@/lib/geo/frame";
import { basemapById, wmsUrl } from "@/lib/geo/basemaps";
import { fireTimelineDay, type DecodedFire } from "@/lib/data/fires";
import { useDepartements2D, useDetections, useEffisYear, useEffisYears, useRecentDetections } from "@/lib/data/queries";
import { recentToColumns } from "@/lib/data/firms-recent";
import { FIRST_YEAR, useMapStore } from "@/lib/store";
import { monthRange } from "@/lib/timeline";

/** Scene km → SVG user units (km from the north-west corner of the extent, y towards south). */
function firePath(fire: DecodedFire): string {
  return fire.rings
    .map((ring) => {
      const points: string[] = [];
      for (let k = 0; k < ring.length; k += 2) {
        points.push(`${(ring[k] + SCENE_SIZE.width / 2).toFixed(2)} ${(ring[k + 1] + SCENE_SIZE.depth / 2).toFixed(2)}`);
      }
      return `M${points.join("L")}Z`;
    })
    .join("");
}

/**
 * Fallback without WebGL: departments, burnt areas of the year shown (selectable)
 * and earlier years hatched — same frame, same panel as the 3D scene, no relief.
 */
export default function Map2D({ reason }: { reason: string }) {
  const { data, error } = useDepartements2D();
  const setRenderMode = useMapStore((state) => state.setRenderMode);
  const year = useMapStore((state) => state.year);
  const showHistory = useMapStore((state) => state.showHistory);
  const selectedFireId = useMapStore((state) => state.selectedFireId);
  const selectFire = useMapStore((state) => state.selectFire);
  // Whole days only: redrawing the SVG at every animation frame would be wasted.
  const timelineDay = useMapStore((state) => (state.timelineDay === null ? null : Math.floor(state.timelineDay)));
  const detections = useDetections(year);
  const month = useMapStore((state) => state.month);
  const setHover = useMapStore((state) => state.setHover);
  // Imagery base maps in 2D: one whole-France image, clipped to the departments.
  const basemap = useMapStore((state) => basemapById(state.basemap));
  const imageUrl =
    basemap.layer
      ? wmsUrl(basemap, [L93_EXTENT.xmin, L93_EXTENT.ymin], [L93_EXTENT.xmax, L93_EXTENT.ymax], 1600, Math.round((1600 * SCENE_SIZE.depth) / SCENE_SIZE.width))
      : null;
  const showRecent = useMapStore((state) => state.showRecent);
  const recent = useRecentDetections(showRecent);
  useEffect(() => {
    setRenderMode("2d");
    return () => setRenderMode(null);
  }, [setRenderMode]);

  const current = useEffisYear(year);
  const historyYears = useMemo(
    () => Array.from({ length: Math.max(0, year - FIRST_YEAR) }, (_, i) => FIRST_YEAR + i),
    [year],
  );
  const history = useEffisYears(historyYears, showHistory);
  const currentPaths = useMemo(
    () =>
      (current.data?.fires ?? []).map((fire) => ({
        id: fire.id,
        d: firePath(fire),
        fire,
        day: fireTimelineDay(fire),
      })),
    [current.data],
  );
  const historyPath = useMemo(
    () => (showHistory && history.data ? history.data.flat().map(firePath).join("") : ""),
    [showHistory, history.data],
  );
  const selected = currentPaths.find((p) => p.id === selectedFireId);
  // Same timeline as the 3D scene: fires from their first detection, hotspots of the last 3 days
  // (of the timeline day, or of now for the last 72 hours).
  const [shownFrom, shownTo] = month ? monthRange(year, month) : [0, timelineDay ?? Infinity];
  const activePoints = useMemo(() => {
    const data = showRecent ? recentToColumns(recent.data) : detections.data;
    const today = showRecent ? 0 : timelineDay;
    if (!data || today === null) return [];
    const points: { x: number; y: number; r: number; opacity: number }[] = [];
    for (let k = 0; k < data.count; k++) {
      const age = today - data.day[k];
      if (age < 0 || age > 3) continue;
      points.push({
        x: data.positions[2 * k] + SCENE_SIZE.width / 2,
        y: data.positions[2 * k + 1] + SCENE_SIZE.depth / 2,
        r: Math.min(3, 0.8 + 0.12 * Math.sqrt(data.frp[k] / 10)),
        opacity: 1 - age / 3,
      });
    }
    return points;
  }, [detections.data, timelineDay, showRecent, recent.data]);

  return (
    <figure className="absolute inset-0 m-0 flex flex-col">
      <figcaption className="self-start px-3 pt-3">
        <span className="rounded bg-white/85 px-1.5 py-0.5 text-[11px] leading-4 text-ink-2">{reason}</span>
      </figcaption>
      <div className="relative min-h-0 flex-1 px-4 pb-14 pt-2">
        {data ? (
          <svg
            viewBox={data.viewBox.join(" ")}
            className="h-full w-full"
            role="img"
            aria-labelledby="carte-2d-titre"
            onClick={() => selectFire(null)}
          >
            <title id="carte-2d-titre">
              {`Départements de France métropolitaine et surfaces brûlées en ${year} (carte 2D)`}
            </title>
            <defs>
              <pattern
                id="carte-2d-hachures"
                width="2"
                height="2"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <line x1="0" y1="0" x2="0" y2="2" stroke="var(--cendre)" strokeWidth="0.6" />
              </pattern>
              {imageUrl && (
                <clipPath id="carte-2d-france">
                  {data.features.map((feature) => (
                    <path key={feature.code} d={feature.d} />
                  ))}
                </clipPath>
              )}
            </defs>
            {imageUrl && (
              <image
                href={imageUrl}
                x={0}
                y={0}
                width={SCENE_SIZE.width}
                height={SCENE_SIZE.depth}
                preserveAspectRatio="none"
                clipPath="url(#carte-2d-france)"
              />
            )}
            {data.features.map((feature) => (
              <path
                key={feature.code}
                d={feature.d}
                fill={imageUrl ? "none" : "var(--relief-flat)"}
                stroke="var(--boundary)"
                strokeWidth={0.75}
                fillRule="evenodd"
                vectorEffect="non-scaling-stroke"
              >
                <title>{`${feature.nom} (${feature.code})`}</title>
              </path>
            ))}
            {historyPath && <path d={historyPath} fill="url(#carte-2d-hachures)" fillRule="evenodd" />}
            {currentPaths.filter((path) => path.day >= shownFrom && path.day <= shownTo).map(({ id, d, fire }) => (
              <path
                key={id}
                d={d}
                fill="var(--scorch)"
                stroke="var(--scorch-ink)"
                strokeWidth={0.75}
                fillRule="evenodd"
                vectorEffect="non-scaling-stroke"
                className="cursor-pointer"
                onClick={(event) => {
                  event.stopPropagation();
                  selectFire(id);
                }}
                onMouseMove={(event) => setHover({ id, x: event.clientX, y: event.clientY })}
                onMouseLeave={() => setHover(null)}
              >
                <title>{`${fire.commune}, ${fire.province} — ${fire.areaHa} ha (EFFIS)`}</title>
              </path>
            ))}
            {activePoints.map((point, k) => (
              <circle key={k} cx={point.x} cy={point.y} r={point.r} fill="none" stroke="var(--amber)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" opacity={point.opacity * 0.9} pointerEvents="none" />
            ))}
            {selected && (
              <path
                d={selected.d}
                fill="none"
                stroke="var(--ink)"
                strokeWidth={2}
                fillRule="evenodd"
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            )}
          </svg>
        ) : (
          <p role="status" className="grid h-full place-items-center text-xs text-ink-3">
            {error ? "Les limites départementales n’ont pas pu être chargées." : "Chargement de la carte 2D…"}
          </p>
        )}
      </div>
    </figure>
  );
}
