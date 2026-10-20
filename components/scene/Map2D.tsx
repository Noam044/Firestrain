"use client";

import { useEffect, useMemo } from "react";
import { SCENE_SIZE } from "@/lib/geo/frame";
import { fireTimelineDay, type DecodedFire } from "@/lib/data/fires";
import { useDepartements2D, useDetections, useEffisYear, useEffisYears, useRecentDetections } from "@/lib/data/queries";
import { recentToColumns } from "@/lib/data/firms-recent";
import { FIRST_YEAR, useMapStore } from "@/lib/store";

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
export default function Map2D({ reason, showFires = false }: { reason: string; showFires?: boolean }) {
  const { data, error } = useDepartements2D();
  const setRenderMode = useMapStore((state) => state.setRenderMode);
  const year = useMapStore((state) => state.year);
  const showHistory = useMapStore((state) => state.showHistory);
  const selectedFireId = useMapStore((state) => state.selectedFireId);
  const selectFire = useMapStore((state) => state.selectFire);
  const timelineDay = useMapStore((state) => state.timelineDay);
  const detections = useDetections(year, showFires);
  const showRecent = useMapStore((state) => state.showRecent);
  const recent = useRecentDetections(showFires && showRecent);
  useEffect(() => {
    setRenderMode("2d");
    return () => setRenderMode(null);
  }, [setRenderMode]);

  const current = useEffisYear(year, showFires);
  const historyYears = useMemo(
    () => Array.from({ length: Math.max(0, year - FIRST_YEAR) }, (_, i) => FIRST_YEAR + i),
    [year],
  );
  const history = useEffisYears(historyYears, showFires && showHistory);
  const currentPaths = useMemo(
    () =>
      (showFires ? (current.data?.fires ?? []) : []).map((fire) => ({
        id: fire.id,
        d: firePath(fire),
        fire,
        day: fireTimelineDay(fire),
      })),
    [showFires, current.data],
  );
  const historyPath = useMemo(
    () => (showFires && showHistory && history.data ? history.data.flat().map(firePath).join("") : ""),
    [showFires, showHistory, history.data],
  );
  const selected = currentPaths.find((p) => p.id === selectedFireId);
  // Same timeline as the 3D scene: fires from their first detection, hotspots of the last 3 days
  // (of the timeline day, or of now for the last 72 hours).
  const shownDay = timelineDay ?? Infinity;
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
      <div className="relative min-h-0 flex-1 px-4 pb-2 pt-24 md:px-10 md:pt-10">
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
                <line x1="0" y1="0" x2="0" y2="2" stroke="var(--bone-300)" strokeWidth="0.5" />
              </pattern>
            </defs>
            {data.features.map((feature) => (
              <path
                key={feature.code}
                d={feature.d}
                fill="var(--ash-700)"
                stroke="var(--ash-400)"
                strokeWidth={0.75}
                fillRule="evenodd"
                vectorEffect="non-scaling-stroke"
              >
                <title>{`${feature.nom} (${feature.code})`}</title>
              </path>
            ))}
            {historyPath && <path d={historyPath} fill="url(#carte-2d-hachures)" fillRule="evenodd" />}
            {currentPaths.filter((path) => path.day <= shownDay).map(({ id, d, fire }) => (
              <path
                key={id}
                d={d}
                fill="var(--char)"
                stroke="var(--bone-300)"
                strokeOpacity={0.6}
                strokeWidth={0.75}
                fillRule="evenodd"
                vectorEffect="non-scaling-stroke"
                className="cursor-pointer"
                onClick={(event) => {
                  event.stopPropagation();
                  selectFire(id);
                }}
              >
                <title>{`${fire.commune}, ${fire.province} — ${fire.areaHa} ha (EFFIS)`}</title>
              </path>
            ))}
            {activePoints.map((point, k) => (
              <circle key={k} cx={point.x} cy={point.y} r={point.r} fill="none" stroke="var(--ember)" strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={point.opacity * 0.85} pointerEvents="none" />
            ))}
            {selected && (
              <path
                d={selected.d}
                fill="none"
                stroke="var(--ember)"
                strokeWidth={1.5}
                fillRule="evenodd"
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            )}
          </svg>
        ) : (
          <p role="status" className="grid h-full place-items-center font-mono text-xs text-ash-400">
            {error ? "Les limites départementales n’ont pas pu être chargées." : "Chargement de la carte 2D…"}
          </p>
        )}
      </div>
      <figcaption className="px-4 pb-28 font-mono text-[11px] text-bone-300 md:px-10">{reason}</figcaption>
    </figure>
  );
}
