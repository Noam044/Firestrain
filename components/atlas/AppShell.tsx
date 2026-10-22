"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { MapStageLoader } from "@/components/scene/MapStageLoader";
import { UrlSync } from "@/components/ui/UrlSync";
import { formatDate, formatInteger } from "@/lib/format";
import { useEffisYear } from "@/lib/data/queries";
import type { BdiffAnnual, EffisIndex } from "@/lib/data/schemas";
import { useMapStore } from "@/lib/store";
import Link from "next/link";
import { MapControls } from "./MapControls";
import { Rail } from "./Rail";
import { SeasonStrip } from "./SeasonStrip";
import { YearStrip } from "./YearStrip";

/** Name of the burnt area under the pointer (mouse only; touch selects directly). */
function MapTooltip() {
  const hover = useMapStore((state) => state.hover);
  const year = useMapStore((state) => state.year);
  const fire = useEffisYear(year).data?.fires.find((candidate) => candidate.id === hover?.id);
  if (!hover || !fire) return null;
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-40 max-w-64 rounded-md bg-ink px-2.5 py-1.5 text-sheet shadow-md"
      style={{ left: hover.x + 14, top: hover.y + 14 }}
    >
      <p className="text-sm font-medium leading-5">{fire.commune || "Commune non renseignée"}</p>
      <p className="text-xs leading-4 opacity-80">
        {formatInteger(fire.areaHa)} ha · {formatDate(fire.firedate)}
      </p>
    </div>
  );
}

/**
 * The application, in four zones: a title bar; the map in the middle; the time
 * strip along the bottom (years, then months and replay), like a player under
 * the map; and a side panel for the year shown or the chosen fire. On phones:
 * title, map, time strip, then the panel. In the DOM the time strip and the
 * panel come before the canvas, so the keyboard reaches the controls first.
 */
export function AppShell({ initialData }: { initialData: { effisIndex: EffisIndex; bdiffAnnual: BdiffAnnual } }) {
  // Seed the query cache once, before the first render, with the data prerendered in the page.
  // An explicit timestamp: the default (Date.now()) is not allowed while prerendering, and
  // static files never go stale anyway.
  const client = useQueryClient();
  useState(() => {
    client.setQueryData(["data", "effis-index"], initialData.effisIndex, { updatedAt: 1 });
    client.setQueryData(["data", "bdiff-annual"], initialData.bdiffAnnual, { updatedAt: 1 });
    return true;
  });
  return (
    <div className="flex min-h-dvh flex-col bg-paper lg:grid lg:h-dvh lg:grid-cols-[340px_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)_auto] lg:overflow-hidden">
      <header className="order-1 flex items-baseline justify-between gap-4 border-b border-rule bg-sheet px-5 py-3 lg:col-span-2 lg:px-6">
        <div className="min-w-0">
          <h1 className="text-lg leading-tight [font-stretch:112%]">Feux de forêt en France</h1>
          <p className="hidden text-xs text-ink-3 sm:block">
            Surfaces brûlées vues par satellite, de 2006 à 2026, métropole et Corse
          </p>
        </div>
        <nav aria-label="Autres pages" className="flex shrink-0 gap-5 text-sm">
          <Link href="/liste" className="text-ink-2 hover:text-ink">
            Liste des feux
          </Link>
          <Link href="/methode" className="text-ink-2 hover:text-ink">
            Méthode
          </Link>
        </nav>
      </header>

      <section
        aria-label="Choisir l’année et la période"
        className="order-3 grid gap-x-10 gap-y-5 border-t border-rule bg-sheet px-5 py-4 lg:col-span-2 lg:row-start-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:px-6"
      >
        <YearStrip barsHeight="h-14" />
        <SeasonStrip />
      </section>

      <aside
        aria-label="L’année ou le feu choisi"
        className="order-4 bg-sheet lg:col-start-1 lg:row-start-2 lg:overflow-y-auto lg:border-r lg:border-rule"
      >
        <Rail />
      </aside>

      <main id="carte" className="relative order-2 h-[55svh] min-h-[320px] shrink-0 overflow-hidden bg-sea lg:col-start-2 lg:row-start-2 lg:h-auto">
        <MapStageLoader />
        <MapControls />
      </main>
      <MapTooltip />
      {/* Reads the query string: rendered on the client, outside the static shell. */}
      <Suspense fallback={null}>
        <UrlSync />
      </Suspense>
    </div>
  );
}
