import type { Metadata } from "next";
import { Suspense } from "react";
import { MapStageLoader } from "@/components/scene/MapStageLoader";
import { FirePanel } from "@/components/ui/FirePanel";
import { Legend } from "@/components/ui/Legend";
import { MapCredits } from "@/components/ui/MapCredits";
import { MapFurniture } from "@/components/ui/MapFurniture";
import { Timeline } from "@/components/ui/Timeline";
import { UrlSync } from "@/components/ui/UrlSync";
import { YearPanel } from "@/components/ui/YearPanel";
import { mapCredits } from "@/lib/data/manifest";

export const metadata: Metadata = {
  title: "Explorer",
  description:
    "Carte en relief des surfaces brûlées en France métropolitaine, de 2006 à 2026 (EFFIS), avec les feux déclarés (BDIFF).",
};

export default function ExplorerPage() {
  return (
    <main id="contenu" className="flex h-[calc(100dvh-var(--header-h))] min-h-[520px] flex-col">
      <h1 className="sr-only">Explorer les surfaces brûlées sur la carte en relief</h1>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <MapStageLoader mode="explore" />

        {/* Phones: year then legend stacked at the top. Wider: legend left, year and fire right. */}
        <div className="pointer-events-none absolute inset-x-4 top-4 flex flex-col gap-2 md:inset-x-6 md:top-6 md:flex-row md:items-start md:justify-between">
          <div className="pointer-events-auto order-2 md:order-1">
            <Legend />
          </div>
          <div className="order-1 flex max-h-[calc(100dvh-var(--header-h)-9rem)] flex-col items-stretch gap-3 md:order-2 md:items-end">
            <div className="pointer-events-auto">
              <YearPanel />
            </div>
            <FirePanel />
          </div>
        </div>

        <div className="pointer-events-auto absolute inset-x-4 bottom-24 md:inset-x-6 xl:bottom-4 xl:left-1/2 xl:right-auto xl:w-[38rem] xl:-translate-x-1/2">
          <Timeline />
        </div>
        <MapFurniture />
      </div>
      {/* Reads the query string: rendered on the client, outside the static shell. */}
      <Suspense fallback={null}>
        <UrlSync />
      </Suspense>

      {/* Credits sit below the map frame, as on a printed sheet. */}
      <footer className="border-t border-ash-800 px-4 py-2 md:px-6">
        <MapCredits credits={mapCredits({ fires: true })} />
      </footer>
    </main>
  );
}
