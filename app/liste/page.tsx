import type { Metadata } from "next";
import { Suspense } from "react";
import { FiresTable } from "@/components/ui/FiresTable";

export const metadata: Metadata = {
  title: "Liste des feux",
  description: "Toutes les surfaces brûlées cartographiées par EFFIS en France métropolitaine, année par année, triables et filtrables.",
};

export default function ListePage() {
  return (
    <main id="contenu" className="mx-auto max-w-6xl px-4 pb-24 pt-12 md:px-8 md:pt-16">
      <p className="label-caps text-ash-400">Liste des feux</p>
      <h1 className="mt-2 text-4xl md:text-5xl">Toutes les surfaces brûlées</h1>
      <p className="mt-5 max-w-3xl font-serif text-lg leading-relaxed text-bone-300">
        Les mêmes données que la carte, sous forme de tableau : chaque surface brûlée cartographiée par EFFIS, avec sa
        date de première détection et, quand le rapprochement est univoque, la surface déclarée au BDIFF. Les colonnes se
        trient ; le nom de chaque commune mène au feu sur la carte.
      </p>
      <div className="mt-10">
        {/* nuqs reads the search params on the client. */}
        <Suspense fallback={<p className="font-mono text-sm text-ash-400">Chargement…</p>}>
          <FiresTable />
        </Suspense>
      </div>
    </main>
  );
}
