"use client";

import { useEffect, useMemo } from "react";
import { SCENE_SIZE } from "@/lib/geo/frame";
import { basemapById, farImagePath } from "@/lib/geo/basemaps";
import type { DecodedFire } from "@/lib/data/fires";
import { useDepartements2D, useEffisYears, useNeighbours, useRecentDetections } from "@/lib/data/queries";
import { useSpanFires } from "@/lib/data/span-fires";
import { recentToColumns } from "@/lib/data/firms-recent";
import { FIRST_YEAR, useMapStore } from "@/lib/store";
import { slugify } from "@/lib/slug";
import { AGE_CLASSES, ageClass, markerRadius } from "./markers";
import { useUnitsPerPx } from "./useUnitsPerPx";

const toSvg = (x: number, z: number) => [x + SCENE_SIZE.width / 2, z + SCENE_SIZE.depth / 2] as const;

/** Scene km → SVG user units (km from the north-west corner of the extent, y towards south). */
function ringsPath(rings: readonly ArrayLike<number>[], digits = 2): string {
  return rings
    .map((ring) => {
      const points: string[] = [];
      for (let k = 0; k < ring.length; k += 2) {
        const [x, y] = toSvg(ring[k], ring[k + 1]);
        points.push(`${x.toFixed(digits)} ${y.toFixed(digits)}`);
      }
      return `M${points.join("L")}Z`;
    })
    .join("");
}

/**
 * Fallback without WebGL: departments, the window's fires as markers over their
 * outlines (selectable), earlier years hatched, hotspots of the last 72 hours —
 * same frame and same colours as the 3D scene, no relief.
 */
export default function Map2D({ reason }: { reason: string }) {
  const { data, error } = useDepartements2D();
  const neighbours = useNeighbours();
  const neighbourPath = useMemo(
    () => ringsPath((neighbours.data?.countries ?? []).flatMap((country) => country.polygons.flat()), 1),
    [neighbours.data],
  );
  const setRenderMode = useMapStore((state) => state.setRenderMode);
  const showHistory = useMapStore((state) => state.showHistory);
  const selectedFireId = useMapStore((state) => state.selectedFireId);
  const hoverId = useMapStore((state) => state.hover?.id ?? null);
  const selectFire = useMapStore((state) => state.selectFire);
  const setHover = useMapStore((state) => state.setHover);
  const month = useMapStore((state) => state.month);
  const departementsMode = useMapStore((state) => state.departementsMode);
  const hoverDepartement = useMapStore((state) => (state.departementsMode ? (state.hoverDepartement?.index ?? 0) : 0));
  const setHoverDepartement = useMapStore((state) => state.setHoverDepartement);
  const chosenDepartement = useMapStore((state) => state.departement);
  const setDepartement = useMapStore((state) => state.setDepartement);
  const archiveYear = useMapStore((state) => state.archiveYear);
  const showLive = useMapStore((state) => state.showLive) && archiveYear === null;
  const live = useRecentDetections(showLive);
  // Imagery base maps in 2D: the whole-France image served by the site, clipped to the departments.
  const basemap = useMapStore((state) => basemapById(state.basemap));
  const imageUrl = basemap.ign ? `/data/${farImagePath(basemap.id)}` : null;
  useEffect(() => {
    setRenderMode("2d");
    return () => setRenderMode(null);
  }, [setRenderMode]);
  const { ref, unitsPerPx } = useUnitsPerPx(data?.viewBox);

  const { span, fires } = useSpanFires();
  const historyYears = useMemo(() => {
    if (!span) return [];
    const last = span.kind === "recent" ? span.months[0].year : span.year - 1;
    return Array.from({ length: Math.max(0, last - FIRST_YEAR + 1) }, (_, i) => FIRST_YEAR + i);
  }, [span]);
  const history = useEffisYears(historyYears, showHistory);
  const historyPath = useMemo(
    () => (showHistory && history.data ? history.data.flat().map((fire: DecodedFire) => ringsPath(fire.rings)).join("") : ""),
    [showHistory, history.data],
  );
  const shown = useMemo(
    () => (fires ?? []).filter((fire) => month === null || fire.monthIndex === month),
    [fires, month],
  );
  const outlines = useMemo(() => shown.map((fire) => ({ fire, d: ringsPath(fire.rings) })), [shown]);
  // Markers: largest first, so small fires stay on top.
  const markers = useMemo(() => [...shown].sort((a, b) => b.areaHa - a.areaHa), [shown]);
  const selected = shown.find((fire) => fire.id === selectedFireId);
  const livePoints = useMemo(() => {
    const columns = showLive ? recentToColumns(live.data) : null;
    if (!columns) return [];
    return Array.from({ length: columns.count }, (_, k) => {
      const [x, y] = toSvg(columns.positions[2 * k], columns.positions[2 * k + 1]);
      return { x, y, opacity: 1 + columns.day[k] / 3 };
    });
  }, [showLive, live.data]);

  return (
    <figure className="absolute inset-0 m-0 flex flex-col">
      <figcaption className="self-start px-3 pt-3">
        <span className="rounded bg-sheet/90 px-1.5 py-0.5 text-[11px] leading-4 text-ink-2">{reason}</span>
      </figcaption>
      <div className="relative min-h-0 flex-1 px-4 pb-14 pt-2">
        {data ? (
          <svg
            ref={ref}
            viewBox={data.viewBox.join(" ")}
            className="h-full w-full"
            role="img"
            aria-labelledby="carte-2d-titre"
            onClick={() => selectFire(null)}
          >
            <title id="carte-2d-titre">Départements de France métropolitaine et feux de la période (carte 2D)</title>
            <defs>
              <pattern id="carte-2d-hachures" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
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
            {neighbourPath && (
              <path d={neighbourPath} fill="var(--neighbour)" stroke="var(--neighbour-line)" strokeWidth={0.6} fillRule="evenodd" vectorEffect="non-scaling-stroke" />
            )}
            {imageUrl && (
              <image href={imageUrl} x={0} y={0} width={SCENE_SIZE.width} height={SCENE_SIZE.depth} preserveAspectRatio="none" clipPath="url(#carte-2d-france)" />
            )}
            {data.features.map((feature, k) => {
              const index = k + 1;
              const slug = slugify(feature.nom);
              const hovered = hoverDepartement === index;
              const chosen = chosenDepartement === slug;
              const dimmed = (departementsMode || chosenDepartement !== null) && !hovered && !chosen;
              return (
                <path
                  key={feature.code}
                  d={feature.d}
                  fill={imageUrl ? (hovered ? "var(--signal)" : "none") : hovered ? "color-mix(in oklab, var(--relief-flat) 80%, var(--signal))" : "var(--relief-flat)"}
                  fillOpacity={imageUrl && hovered ? 0.2 : dimmed ? 0.7 : 1}
                  stroke={hovered || chosen ? "var(--signal)" : "var(--boundary)"}
                  strokeWidth={hovered || chosen ? 2 : 0.75}
                  fillRule="evenodd"
                  vectorEffect="non-scaling-stroke"
                  className={departementsMode ? "cursor-pointer" : undefined}
                  {...(departementsMode
                    ? {
                        onMouseMove: (event) => setHoverDepartement({ index, x: event.clientX, y: event.clientY }),
                        onMouseLeave: () => setHoverDepartement(null),
                        onClick: (event) => {
                          event.stopPropagation();
                          setDepartement(slug);
                        },
                      }
                    : {})}
                >
                  <title>{`${feature.nom} (${feature.code})`}</title>
                </path>
              );
            })}
            {historyPath && <path d={historyPath} fill="url(#carte-2d-hachures)" fillRule="evenodd" />}
            {outlines.map(({ fire, d }) => (
              <path key={fire.id} d={d} fill="var(--scorch)" stroke="var(--scorch-ink)" strokeWidth={0.5} fillRule="evenodd" vectorEffect="non-scaling-stroke" pointerEvents="none" />
            ))}
            {!departementsMode && livePoints.map((point, k) => (
              <circle key={k} cx={point.x} cy={point.y} r={2.5 * unitsPerPx} fill="none" stroke="var(--amber)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" opacity={point.opacity} pointerEvents="none" />
            ))}
            {!departementsMode && markers.map((fire) => {
              const [cx, cy] = toSvg(fire.center[0], fire.center[1]);
              const ring = fire.id === selectedFireId ? 2.5 : fire.id === hoverId ? 2 : 1.5;
              return (
                <circle
                  key={fire.id}
                  cx={cx}
                  cy={cy}
                  r={markerRadius(fire.areaHa) * unitsPerPx}
                  fill={`var(${AGE_CLASSES[ageClass(fire.ageDays)].token})`}
                  stroke={ring > 1.5 ? "var(--ink)" : "var(--marker-edge)"}
                  strokeWidth={ring}
                  vectorEffect="non-scaling-stroke"
                  className="cursor-pointer"
                  onClick={(event) => {
                    event.stopPropagation();
                    selectFire(fire.id);
                  }}
                  onMouseMove={(event) => setHover({ id: fire.id, x: event.clientX, y: event.clientY })}
                  onMouseLeave={() => setHover(null)}
                >
                  <title>{`${fire.commune}, ${fire.province}, ${fire.areaHa} ha (EFFIS)`}</title>
                </circle>
              );
            })}
            {selected && (
              <path d={ringsPath(selected.rings)} fill="none" stroke="var(--ink)" strokeWidth={2} fillRule="evenodd" vectorEffect="non-scaling-stroke" pointerEvents="none" />
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
