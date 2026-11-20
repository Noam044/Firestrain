"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { useLiveSummary } from "./live";
import { FireBackdrop } from "./FireBackdrop";
import { ThermalView } from "./ThermalView";

/** The home page's opening: what the site does, the way to the map, and the map's picture. */
export function Hero() {
  const { summary, error } = useLiveSummary();
  return (
    <section aria-labelledby="accueil-titre" className="relative isolate overflow-hidden border-b border-rule">
      <FireBackdrop />
      <div className="mx-auto grid max-w-[1320px] items-center gap-10 px-5 pb-28 pt-10 md:px-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-12 lg:pb-32 lg:pt-14">
        <div>
          <h1 id="accueil-titre" tabIndex={-1} className="outline-none text-[2.5rem] leading-[1.04] tracking-[-0.04em] sm:text-[3.4rem] xl:text-[3.9rem]">
            Suivre les feux de forêt en France
          </h1>
          <p className="mt-6 max-w-[44ch] text-lg leading-8 text-ink-2">
            Les surfaces brûlées détectées par satellite depuis douze mois en métropole et en Corse, sur une carte en
            relief mise à jour chaque heure.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
            <Button asChild variant="signal" size="lg">
              <Link href="/carte">Explorer la carte</Link>
            </Button>
            <Link href="/methode" className="link-draw text-sm font-semibold text-ink-2">
              Méthode et sources
            </Link>
          </div>
          <p className="mt-10 text-xs text-ink-3">
            {summary
              ? `Données EFFIS du ${formatDateTime(summary.asOf)}.`
              : error
                ? "Données en direct indisponibles pour l’instant."
                : "Chargement des données EFFIS…"}
          </p>
        </div>
        <ThermalView fires={summary?.fires} />
      </div>
    </section>
  );
}
