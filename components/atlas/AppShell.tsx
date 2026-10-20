"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { MapStageLoader } from "@/components/scene/MapStageLoader";
import { UrlSync } from "@/components/ui/UrlSync";
import { formatDate, formatInteger } from "@/lib/format";
import { useEffisYear } from "@/lib/data/queries";
import type { BdiffAnnual, EffisIndex } from "@/lib/data/schemas";
import { useMapStore } from "@/lib/store";
import { MapControls } from "./MapControls";
import { Rail } from "./Rail";

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
 * The application: one column of controls and the map. On phones the map
 * comes first and the column follows; in the DOM the column comes first, so
 * keyboard and screen-reader users reach the controls before the canvas.
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
    <div className="flex min-h-dvh flex-col bg-paper lg:grid lg:h-dvh lg:grid-cols-[400px_minmax(0,1fr)] lg:overflow-hidden">
      <aside
        aria-label="Commandes de la carte"
        className="order-2 border-rule bg-sheet lg:order-1 lg:overflow-y-auto lg:border-r"
      >
        <Rail />
      </aside>
      <main id="carte" className="relative order-1 h-[58svh] min-h-[340px] shrink-0 overflow-hidden bg-sea lg:order-2 lg:h-auto">
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
