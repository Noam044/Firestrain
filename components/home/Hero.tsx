"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { formatAge, formatDateTime, formatInteger } from "@/lib/format";
import { useRecentDetections, useRecentFires } from "@/lib/data/queries";
import { daysBetween } from "@/lib/span";
import { LogoMark } from "@/components/brand/Logo";
import { LiveMap } from "./LiveMap";

/** The home page's opening: what FireStrain is, the way to the map, and a live preview of it. */
export function Hero() {
  const live = useRecentFires(true);
  return (
    <section aria-labelledby="accueil-titre" className="border-b border-rule bg-sheet">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-10 md:px-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16 lg:py-16">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-fire-month">
            <LogoMark size={20} />
            Suivi des feux · métropole et Corse
          </p>
          <h1 id="accueil-titre" className="mt-4 text-[2.1rem] leading-[1.08] tracking-[-0.02em] text-ink sm:text-5xl">
            Les feux de forêt en France, vus par satellite.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-ink-2 sm:text-lg sm:leading-8">
            FireStrain place sur une carte en relief chaque surface brûlée cartographiée par EFFIS (Copernicus) depuis
            douze mois, avec sa date, sa taille et la végétation touchée, et les points chauds détectés par la NASA
            dans les dernières 72 heures. Les données sont relues chaque heure.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/carte"
              className="inline-flex h-12 items-center gap-2 rounded-md bg-ink px-5 text-base font-bold text-sheet hover:bg-ink-2"
            >
              Explorer la carte
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                <path d="M2 7h10M8 3l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.7" />
              </svg>
            </Link>
            <Link
              href="/methode"
              className="inline-flex h-12 items-center rounded-md border border-rule-strong px-5 text-base font-bold text-ink hover:border-ink"
            >
              Méthode et sources
            </Link>
          </div>
        </div>
        <LiveMap fires={live.data?.fires} asOf={live.data?.generatedAt} />
      </div>
    </section>
  );
}

function Fact({ label, children, note }: { label: string; children: ReactNode; note?: ReactNode }) {
  return (
    <div className="min-w-0 border-t border-rule pt-3">
      <dt className="text-sm text-ink-2">{label}</dt>
      <dd className="mt-1">
        {children}
        {note && <span className="mt-0.5 block text-xs text-ink-3">{note}</span>}
      </dd>
    </div>
  );
}

/** The state of the last twelve months as of the latest EFFIS query, and the hotspots of the last 72 hours. */
export function LiveFacts() {
  const live = useRecentFires(true);
  const hotspots = useRecentDetections(true);
  const facts = useMemo(() => {
    if (!live.data) return null;
    const { fires, generatedAt } = live.data;
    const latest = fires.reduce<(typeof fires)[number] | null>((best, fire) => (!best || fire.firedate > best.firedate ? fire : best), null);
    return {
      asOf: generatedAt,
      lastWeek: fires.filter((fire) => daysBetween(fire.firedate, generatedAt) <= 7).length,
      count: fires.length,
      areaHa: fires.reduce((sum, fire) => sum + fire.areaHa, 0),
      latest: latest && { fire: latest, age: Math.max(0, daysBetween(latest.firedate, generatedAt)) },
    };
  }, [live.data]);
  const figure = (value: string | null, unit?: string) => (
    <span className="figure text-3xl text-ink">
      {value ?? "–"}
      {unit && value && <span className="ml-1 text-sm text-ink-3">{unit}</span>}
    </span>
  );

  return (
    <section aria-labelledby="moment-titre" className="mx-auto max-w-6xl px-5 py-10 md:px-8">
      <h2 id="moment-titre" className="text-xl">
        En ce moment
      </h2>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-6 lg:grid-cols-4">
        <Fact label="Feux détectés depuis 7 jours">{figure(facts ? formatInteger(facts.lastWeek) : null)}</Fact>
        <Fact
          label="Dernier feu détecté"
          note={facts?.latest ? `${facts.latest.fire.province}, ${formatAge(facts.latest.age)}` : undefined}
        >
          <span className="block truncate text-2xl font-bold leading-9 text-ink">
            {facts?.latest ? facts.latest.fire.commune || "Commune non renseignée" : "–"}
          </span>
        </Fact>
        <Fact label="Surface brûlée en 12 mois" note={facts ? `${formatInteger(facts.count)} feux cartographiés` : undefined}>
          {figure(facts ? formatInteger(facts.areaHa) : null, "ha")}
        </Fact>
        <Fact label="Points chauds, 72 dernières heures">{figure(hotspots.data ? formatInteger(hotspots.data.count) : null)}</Fact>
      </dl>
      <p className="mt-4 text-xs leading-4 text-ink-3">
        {facts
          ? `Surfaces EFFIS interrogées le ${formatDateTime(facts.asOf)} ; points chauds NASA FIRMS (VIIRS).`
          : live.isError
            ? "Suivi en direct indisponible pour l’instant : la carte reprend les fichiers du site."
            : "Interrogation d’EFFIS…"}
      </p>
    </section>
  );
}
