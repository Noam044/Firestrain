"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { MapStageLoader } from "@/components/scene/MapStageLoader";
import { UrlSync } from "@/components/ui/UrlSync";
import { formatAge, formatArea, formatDate } from "@/lib/format";
import type { BdiffAnnual, EffisIndex } from "@/lib/data/schemas";
import { SpanFiresProvider, useSpanFires } from "@/lib/data/span-fires";
import { useMapStore } from "@/lib/store";
import { FirePanel } from "./FirePanel";
import { MapControls } from "./MapControls";
import { MonthStrip } from "./MonthStrip";
import { TopBar } from "./TopBar";

/** Name of the fire under the pointer (mouse only; touch selects directly). */
function MapTooltip() {
  const hover = useMapStore((state) => state.hover);
  const { fires } = useSpanFires();
  const fire = hover && hover.x !== null ? fires?.find((candidate) => candidate.id === hover.id) : undefined;
  if (!hover || hover.x === null || !fire) return null;
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-40 max-w-64 rounded-md bg-ink px-2.5 py-1.5 text-sheet shadow-md"
      style={{ left: hover.x + 14, top: hover.y + 14 }}
    >
      <p className="text-sm font-bold leading-5">{fire.commune || "Commune non renseignée"}</p>
      <p className="figure text-xs leading-4 opacity-80">
        {formatArea(fire.areaHa)} ha · {fire.ageDays !== null ? formatAge(fire.ageDays) : formatDate(fire.firedate)}
      </p>
    </div>
  );
}

/**
 * The tracker, in four zones: a top bar (title, period, live hotspots); the
 * list of the period's fires on the left (or the fire chosen); the map; and
 * the twelve months under the map. On phones: top bar, map, months, list.
 * In the DOM the controls come before the canvas, so the keyboard reaches them first.
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
    <SpanFiresProvider>
      <div className="flex min-h-dvh flex-col bg-paper lg:grid lg:h-dvh lg:grid-cols-[380px_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)_auto] lg:overflow-hidden">
        <div className="order-1 lg:col-span-2">
          <TopBar />
        </div>

        <section
          aria-label="Choisir le mois"
          className="order-3 border-y border-rule bg-sheet px-3 py-2.5 lg:col-start-2 lg:row-start-3 lg:border-b-0 lg:px-4"
        >
          <MonthStrip />
        </section>

        <aside
          aria-label="Feux de la période"
          className="order-4 flex flex-col bg-sheet lg:col-start-1 lg:row-span-2 lg:row-start-2 lg:min-h-0 lg:border-r lg:border-rule"
        >
          <FirePanel />
        </aside>

        <main
          id="carte"
          className="relative order-2 h-[55svh] min-h-[320px] shrink-0 overflow-hidden bg-sea lg:col-start-2 lg:row-start-2 lg:h-auto"
        >
          <MapStageLoader />
          <MapControls />
        </main>
        <MapTooltip />
        {/* Reads the query string: rendered on the client, outside the static shell. */}
        <Suspense fallback={null}>
          <UrlSync />
        </Suspense>
      </div>
    </SpanFiresProvider>
  );
}
