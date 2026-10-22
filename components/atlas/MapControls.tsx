"use client";

import Link from "next/link";
import { Popover } from "radix-ui";
import type { ReactNode } from "react";
import { BASEMAPS, basemapById } from "@/lib/geo/basemaps";
import { niceLength } from "@/lib/geo/scale";
import { formatDistance } from "@/lib/format";
import { useMapStore } from "@/lib/store";

/** Swatches standing for each base map in the picker. */
const SWATCH: Record<string, string> = {
  relief: "linear-gradient(135deg, #ffffff 0%, #eef0ea 45%, #a9b2a7 100%)",
  plan: "linear-gradient(135deg, #f6f2e8 0%, #f6f2e8 55%, #f0a64a 55%, #f0a64a 62%, #dfe8d2 62%)",
  satellite: "linear-gradient(135deg, #4d5b3c 0%, #6c7651 50%, #8b8a6a 100%)",
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

/** Zoom, overview and base map, at the bottom right of the map; scale and attribution beside them. */
export function MapControls() {
  const requestCamera = useMapStore((state) => state.requestCamera);
  const basemap = useMapStore((state) => state.basemap);
  const setBasemap = useMapStore((state) => state.setBasemap);
  const renderMode = useMapStore((state) => state.renderMode);
  const current = basemapById(basemap);

  return (
    <>
      <div className="pointer-events-auto absolute bottom-3 left-3 flex flex-col items-start gap-1.5">
        {renderMode === "3d" && <ScaleBar />}
        <p className="rounded bg-white/85 px-1.5 py-0.5 text-[11px] leading-4 text-ink-2">
          EFFIS · IGN{current.source ? ` · ${current.source.name}` : ""} · NASA FIRMS ·{" "}
          <Link href="/methode" className="underline decoration-rule underline-offset-2 hover:text-ink">
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
              <span className="block text-ink-3">Fond de carte</span>
              <span className="block font-medium text-ink">{current.label}</span>
            </span>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content side="top" align="end" sideOffset={8} className="map-key z-50 w-56 p-1.5">
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
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
    </>
  );
}
