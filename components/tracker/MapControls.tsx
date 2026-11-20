"use client";

import Link from "next/link";
import { Popover } from "radix-ui";
import type { ReactNode } from "react";
import { BASEMAPS, basemapById } from "@/lib/geo/basemaps";
import { niceLength } from "@/lib/geo/scale";
import { formatDistance } from "@/lib/format";
import { useMapStore } from "@/lib/store";
import { AGE_CLASSES } from "@/components/scene/markers";

/** Swatches standing for each base map in the picker. */
const SWATCH: Record<string, string> = {
  relief: "linear-gradient(135deg, #ffffff 0%, #efefec 45%, #a9b0b4 100%)",
  plan: "linear-gradient(135deg, #f6f2e8 0%, #f6f2e8 55%, #f0a64a 55%, #f0a64a 62%, #dfe8d2 62%)",
  ortho: "linear-gradient(135deg, #5f7a4a 0%, #9ba77a 45%, #c9c2a7 100%)",
};

function Key({
  label,
  onClick,
  children,
  touch = true,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  /** False for buttons that touch screens replace with a gesture (pinch to zoom). */
  touch?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`grid size-9 place-items-center text-ink hover:bg-paper ${touch ? "" : "[@media(pointer:coarse)]:hidden"}`}
    >
      {children}
    </button>
  );
}

function ScaleBar() {
  const kmPer100px = useMapStore((state) => state.kmPer100px);
  if (kmPer100px == null || kmPer100px <= 0) return null;
  const lengthKm = niceLength((kmPer100px * 110) / 100);
  const widthPx = Math.round((lengthKm / kmPer100px) * 100);
  const label = formatDistance(lengthKm);
  return (
    <div className="map-key px-2 py-1.5" role="img" aria-label={`Échelle au centre de la vue : ${label}`}>
      <div className="flex items-center gap-2">
        <span aria-hidden className="block h-[5px] border-x-2 border-b-2 border-ink" style={{ width: widthPx }} />
        <span className="text-xs tabular text-ink">{label}</span>
      </div>
    </div>
  );
}

/** Same 45° hatching as the map. */
function HatchSwatch() {
  return (
    <svg width="16" height="12" aria-hidden className="shrink-0 rounded-[2px]">
      <defs>
        <pattern id="cle-hachures" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="4" stroke="var(--cendre)" strokeWidth="1.6" />
        </pattern>
      </defs>
      <rect width="16" height="12" fill="#efefec" />
      <rect width="16" height="12" fill="url(#cle-hachures)" />
    </svg>
  );
}

/** What the markers and colours mean, at the top left of the map. */
function MapLegend() {
  const archiveYear = useMapStore((state) => state.archiveYear);
  const showLive = useMapStore((state) => state.showLive);
  const showHistory = useMapStore((state) => state.showHistory);
  return (
    <div className="map-key pointer-events-auto absolute left-3 top-3 hidden px-2.5 py-2 text-xs leading-4 text-ink-2 sm:block">
      <p className="label">Feux {archiveYear === null ? "détectés" : `de ${archiveYear}`}</p>
      <ul className="mt-1 space-y-0.5">
        {archiveYear === null ? (
          AGE_CLASSES.map((c) => (
            <li key={c.token} className="flex items-center gap-2">
              <span aria-hidden className="size-2.5 rounded-full ring-1 ring-white" style={{ background: `var(${c.token})` }} />
              {c.label}
            </li>
          ))
        ) : (
          <li className="flex items-center gap-2">
            <span aria-hidden className="size-2.5 rounded-full bg-fire-month" />
            Surface brûlée
          </li>
        )}
        <li className="flex items-center gap-2 text-ink-3">
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
            <circle cx="3" cy="7" r="2" fill="currentColor" />
            <circle cx="7" cy="5" r="3" fill="none" stroke="currentColor" strokeWidth="1" />
          </svg>
          Taille : surface ; contour au zoom
        </li>
        {archiveYear === null && showLive && (
          <li className="flex items-center gap-2">
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
              <circle cx="5" cy="5" r="3" fill="none" stroke="var(--amber)" strokeWidth="1.8" />
            </svg>
            Point chaud, 72 dernières heures
          </li>
        )}
        {showHistory && (
          <li className="flex items-center gap-2">
            <HatchSwatch />
            Brûlé avant, depuis 2006
          </li>
        )}
      </ul>
    </div>
  );
}

/** Zoom, overview, base map and layers at the bottom right of the map; legend, scale and attribution on the left. */
export function MapControls() {
  const requestCamera = useMapStore((state) => state.requestCamera);
  const basemap = useMapStore((state) => state.basemap);
  const setBasemap = useMapStore((state) => state.setBasemap);
  const renderMode = useMapStore((state) => state.renderMode);
  const current = basemapById(basemap);
  const archiveYear = useMapStore((state) => state.archiveYear);
  const showHistory = useMapStore((state) => state.showHistory);
  const setShowHistory = useMapStore((state) => state.setShowHistory);
  const showLive = useMapStore((state) => state.showLive);
  const setShowLive = useMapStore((state) => state.setShowLive);

  return (
    <>
      <MapLegend />
      <div className="pointer-events-auto absolute bottom-3 left-3 flex flex-col items-start gap-1.5">
        {renderMode === "3d" && <ScaleBar />}
        <p className="rounded bg-white/85 px-1.5 py-0.5 text-[11px] leading-4 text-ink-2">
          EFFIS · IGN · NASA FIRMS ·{" "}
          <Link href="/methode" className="underline decoration-rule-strong underline-offset-2 hover:text-ink">
            sources
          </Link>
        </p>
      </div>

      <div className="pointer-events-auto absolute bottom-3 right-3 flex flex-col items-end gap-2">
        {renderMode === "3d" && (
          <div className="map-key flex flex-col divide-y divide-rule overflow-hidden">
            <Key label="Zoomer" touch={false} onClick={() => requestCamera({ kind: "zoom", factor: 1.8 })}>
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </Key>
            <Key label="Dézoomer" touch={false} onClick={() => requestCamera({ kind: "zoom", factor: 1 / 1.8 })}>
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                <path d="M2 7h10" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </Key>
            <Key label="Revenir à la France entière" onClick={() => requestCamera({ kind: "preset", preset: "france" })}>
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </Key>
          </div>
        )}

        <Popover.Root>
          <Popover.Trigger
            className="map-key flex items-center gap-2 py-1 pl-1 pr-2.5 text-left hover:bg-paper"
          >
            <span aria-hidden className="size-8 rounded" style={{ background: SWATCH[current.id] }} />
            <span className="text-xs leading-4">
              <span className="block text-ink-3">Fond et calques</span>
              <span className="block font-medium text-ink">{current.label}</span>
            </span>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content side="top" align="end" sideOffset={8} className="map-key z-50 w-60 p-1.5">
              <p className="px-1.5 pb-1 pt-0.5 text-xs text-ink-3">Fond de carte</p>
              <div role="radiogroup" aria-label="Fond de carte" className="grid grid-cols-2 gap-1.5">
                {BASEMAPS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={basemap === option.id}
                    onClick={() => setBasemap(option.id)}
                    className={`rounded-md p-1 text-left text-xs ${
                      basemap === option.id ? "bg-paper font-medium text-ink ring-2 ring-ink" : "text-ink-2 hover:bg-paper"
                    }`}
                  >
                    <span aria-hidden className="block h-12 rounded" style={{ background: SWATCH[option.id] }} />
                    <span className="mt-1 block px-0.5">{option.label}</span>
                  </button>
                ))}
              </div>
              {current.source && (
                <p className="px-1.5 pb-0.5 pt-2 text-[11px] leading-4 text-ink-3">
                  {current.source.fullName}. {current.source.note}
                </p>
              )}
              <fieldset className="mt-2 border-t border-rule px-1.5 pb-1 pt-2">
                <legend className="sr-only">Calques</legend>
                <p aria-hidden className="pb-1 text-xs text-ink-3">
                  Calques
                </p>
                {archiveYear === null && (
                  <label className="flex cursor-pointer items-center gap-2 py-1 text-xs text-ink">
                    <input type="checkbox" checked={showLive} onChange={(event) => setShowLive(event.target.checked)} className="size-4 accent-ink" />
                    Points chauds des 72 dernières heures
                  </label>
                )}
                <label className="flex cursor-pointer items-center gap-2 py-1 text-xs text-ink">
                  <input type="checkbox" checked={showHistory} onChange={(event) => setShowHistory(event.target.checked)} className="size-4 accent-ink" />
                  Feux des années précédentes (hachures)
                </label>
              </fieldset>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
    </>
  );
}
