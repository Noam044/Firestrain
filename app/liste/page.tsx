import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/tracker/PageHeader";
import { FiresTable } from "@/components/ui/FiresTable";

export const metadata: Metadata = {
  title: "Liste des feux",
  description: "Toutes les surfaces brûlées cartographiées par EFFIS en France métropolitaine, année par année, triables et filtrables.",
};

export default function ListePage() {
  return (
    <main id="contenu" className="mx-auto max-w-6xl px-5 pb-24 md:px-8">
      <PageHeader />
      <h1 className="mt-10 text-3xl md:text-4xl">Toutes les surfaces brûlées</h1>
      <p className="mt-3 max-w-3xl leading-relaxed text-ink-2">
        Les surfaces de la carte, en tableau : triez par colonne, filtrez par mois ou par lieu. Le nom de la commune ouvre
        le feu sur la carte.
      </p>
      <div className="mt-8">
        {/* nuqs reads the search params on the client. */}
        <Suspense fallback={<p className="tabular text-sm text-ink-3">Chargement…</p>}>
          <FiresTable />
        </Suspense>
      </div>
    </main>
  );
}
