"use client";

import { useState } from "react";
import { BASEMAPS, basemapById } from "@/lib/geo/basemaps";
import { FIRST_YEAR, useMapStore } from "@/lib/store";
import { SourceTag } from "./SourceTag";

/** Base-map choice, always visible (also when the legend is folded on phones). */
function BasemapPicker() {
  const basemap = useMapStore((state) => state.basemap);
  const setBasemap = useMapStore((state) => state.setBasemap);
  const source = basemapById(basemap).source;
  return (
    <div className="mt-2.5">
      <div role="group" aria-label="Fond de carte" className="grid grid-cols-2 gap-1">
        {BASEMAPS.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={basemap === option.id}
            onClick={() => setBasemap(option.id)}
            className={`border px-1.5 py-1 text-left text-[11px] leading-4 ${
              basemap === option.id ? "border-bone-300 text-bone-100" : "border-ash-700 text-ash-400 hover:text-bone-300"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {source && (
        <div className="mt-1.5">
          <SourceTag source={source} />
        </div>
      )}
    </div>
  );
}

/** Same 45° hatching as the map (terrain shader and 2D pattern). */
function HatchSwatch() {
  return (
    <svg width="24" height="12" aria-hidden className="shrink-0">
      <defs>
        <pattern id="legende-hachures" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="5" stroke="var(--bone-300)" strokeWidth="1.2" />
        </pattern>
      </defs>
      <rect width="24" height="12" fill="var(--ash-700)" />
      <rect width="24" height="12" fill="url(#legende-hachures)" />
    </svg>
  );
}

function LineSwatch({ color, width }: { color: string; width: number }) {
  return (
    <svg width="24" height="8" aria-hidden className="shrink-0">
      <line x1="0" y1="4" x2="24" y2="4" stroke={color} strokeWidth={width} />
    </svg>
  );
}

/** Fixed legend; collapsible on small screens so the map stays visible. */
export function Legend() {
  const exaggeration = useMapStore((state) => state.exaggeration);
  const flat = useMapStore((state) => state.renderMode === "2d");
  const year = useMapStore((state) => state.year);
  const showHistory = useMapStore((state) => state.showHistory);
  const timelineActive = useMapStore((state) => state.timelineDay !== null);
  const showRecent = useMapStore((state) => state.showRecent);
  const imagery = useMapStore((state) => basemapById(state.basemap).layer !== undefined);
  const [open, setOpen] = useState(false);
  return (
    <section aria-labelledby="legende-titre" className="w-64 max-w-[calc(100vw-2rem)] border border-ash-800 bg-ash-950 p-3">
      <h2 id="legende-titre" className="label-caps text-bone-100">
        <span className="hidden md:inline">Légende</span>
        <button
          type="button"
          className="label-caps flex w-full items-center justify-between md:hidden"
          aria-expanded={open}
          aria-controls="legende-contenu"
          onClick={() => setOpen((value) => !value)}
        >
          Légende
          <span aria-hidden className="font-mono text-bone-300">
            {open ? "−" : "+"}
          </span>
        </button>
      </h2>
      <BasemapPicker />
      <ul
        id="legende-contenu"
        className={`${open ? "block" : "hidden"} mt-2.5 space-y-2 text-xs leading-4 text-bone-300 md:block`}
      >
        <li className="flex items-center gap-2">
          <span aria-hidden className="h-3 w-6 shrink-0 border border-bone-300/60 bg-char" />
          Surfaces brûlées en {year} (EFFIS)
        </li>
        {showHistory && year > FIRST_YEAR && (
          <li className="flex items-center gap-2">
            <HatchSwatch />
            Surfaces brûlées de {FIRST_YEAR} à {year - 1}
          </li>
        )}
        <li className="flex items-center gap-2">
          <LineSwatch color="var(--ember)" width={1.5} />
          Surface sélectionnée
        </li>
        {(timelineActive || showRecent) && (
          <li className="flex items-center gap-2">
            <svg width="24" height="12" aria-hidden className="shrink-0">
              <circle cx="7" cy="6" r="2.2" fill="none" stroke="var(--ember)" strokeWidth="1.2" />
              <circle cx="17" cy="6" r="4" fill="none" stroke="var(--ember)" strokeWidth="1.2" opacity="0.6" />
            </svg>
            {showRecent
              ? "Détection thermique FIRMS (72 dernières heures, taille selon la puissance)"
              : "Détection thermique FIRMS (3 derniers jours, taille selon la puissance)"}
          </li>
        )}
        {flat ? (
          <>
            <li className="flex items-center gap-2">
              <LineSwatch color="var(--ash-400)" width={0.8} />
              Limite de département
            </li>
            <li className="font-mono text-[11px] text-ash-400">Rendu 2D, sans relief</li>
          </>
        ) : (
          <>
            <li className="flex items-center gap-2">
              <span aria-hidden className="flex h-3 w-6 shrink-0">
                <span className="flex-1 bg-ash-900" />
                <span className="flex-1 bg-ash-700" />
                <span className="flex-1 bg-ash-400" />
              </span>
              {imagery ? "Ombrage du relief sur le fond, éclairage nord-ouest" : "Relief ombré, éclairage nord-ouest"}
            </li>
            <li className="pl-8 font-mono text-[11px] text-ash-400">
              Exagération verticale ×{exaggeration}
            </li>
            <li className="flex items-center gap-2">
              <LineSwatch color="var(--bone-300)" width={1.2} />
              Côte et frontière nationale
            </li>
            <li className="flex items-center gap-2">
              <LineSwatch color="var(--ash-400)" width={0.8} />
              Limite de département
            </li>
            {!imagery && (
              <li className="flex items-center gap-2">
                <span aria-hidden className="h-3 w-6 shrink-0 border border-ash-700 bg-sea" />
                Sans altitude dans la BD ALTI (mer, lagunes)
              </li>
            )}
          </>
        )}
      </ul>
    </section>
  );
}
