"use client";

import Link from "next/link";
import { formatInteger } from "@/lib/format";
import { useEffisYear } from "@/lib/data/queries";
import { useMapStore } from "@/lib/store";
import { FireDetail } from "./FireDetail";
import { MapKey } from "./MapKey";
import { SeasonStrip } from "./SeasonStrip";
import { TopFires } from "./TopFires";
import { YearStrip } from "./YearStrip";
import { YearSummary } from "./YearSummary";

/** Every control of the map in one column: year, period, layers, then the fires — or one fire. */
export function Rail() {
  const year = useMapStore((state) => state.year);
  const selectedFireId = useMapStore((state) => state.selectedFireId);
  const selectFire = useMapStore((state) => state.selectFire);
  const fires = useEffisYear(year).data?.fires;
  const fire = fires?.find((candidate) => candidate.id === selectedFireId) ?? null;

  return (
    <div className="flex min-h-full flex-col px-5 pb-5 pt-4 lg:px-6">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-lg leading-tight [font-stretch:112%]">Feux de forêt en France</h1>
        <nav aria-label="Autres pages" className="flex shrink-0 gap-4 text-sm">
          <Link href={`/liste?year=${year}`} className="text-ink-2 hover:text-ink">
            Liste
          </Link>
          <Link href="/methode" className="text-ink-2 hover:text-ink">
            Méthode
          </Link>
        </nav>
      </header>
      <p className="mt-0.5 text-xs text-ink-3">Surfaces brûlées vues par satellite, de 2006 à 2026, métropole et Corse</p>

      <div className="mt-5">
        <YearStrip />
      </div>

      <p aria-live="polite" className="sr-only">
        {fire ? `${fire.commune}, ${fire.province} : ${formatInteger(fire.areaHa)} hectares sélectionnés.` : ""}
      </p>

      <div className="mt-6 flex-1">
        {fire ? (
          <FireDetail fire={fire} year={year} onBack={() => selectFire(null)} />
        ) : (
          <div className="space-y-7">
            <YearSummary />
            <SeasonStrip />
            <MapKey />
            <TopFires />
          </div>
        )}
      </div>

      <footer className="mt-8 border-t border-rule pt-3 text-xs leading-4 text-ink-3">
        Données : EFFIS (Copernicus, CC BY 4.0), BDIFF, NASA FIRMS, IGN (BD ALTI, ADMIN EXPRESS, fonds de carte).{" "}
        <Link href="/methode" className="underline decoration-rule underline-offset-2 hover:text-ink">
          Sources et limites
        </Link>
      </footer>
    </div>
  );
}
