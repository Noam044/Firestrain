import type { Metadata } from "next";
import { MapStageLoader } from "@/components/scene/MapStageLoader";
import { Legend } from "@/components/ui/Legend";
import { MapCredits } from "@/components/ui/MapCredits";
import { MapFurniture } from "@/components/ui/MapFurniture";
import { mapCredits } from "@/lib/data/manifest";

export const metadata: Metadata = {
  title: "Explorer",
  description: "Carte en relief de la France métropolitaine : relief IGN et limites départementales.",
};

export default function ExplorerPage() {
  return (
    <main id="contenu" className="flex h-[calc(100dvh-var(--header-h))] min-h-[480px] flex-col">
      <h1 className="sr-only">Explorer la carte en relief</h1>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <MapStageLoader mode="explore" />

        <div className="pointer-events-none absolute left-4 top-4 md:left-6 md:top-6">
          <div className="pointer-events-auto">
            <Legend />
          </div>
        </div>

        <MapFurniture />
      </div>

      {/* Credits sit below the map frame, as on a printed sheet. */}
      <footer className="border-t border-ash-800 px-4 py-2 md:px-6">
        <MapCredits credits={mapCredits()} />
      </footer>
    </main>
  );
}
