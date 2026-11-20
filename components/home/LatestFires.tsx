"use client";

import Link from "next/link";
import { AnimatedList } from "@/components/magic/animated-list";
import { Reveal } from "@/components/motion/reveal";
import { AGE_CLASSES } from "@/components/scene/markers";
import { formatAge, formatArea, formatDayMonth } from "@/lib/format";
import { useLiveSummary } from "./live";

const SHOWN = 6;

/** The newest EFFIS outlines, arriving like detections; each opens on the map. */
export function LatestFires() {
  const { summary, error } = useLiveSummary();
  const latest = summary?.latest.slice(0, SHOWN);
  return (
    <section aria-labelledby="derniers-titre" className="border-y border-rule bg-sheet">
      <div className="mx-auto grid max-w-[1320px] gap-10 px-5 py-16 md:px-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-20 lg:py-24">
        <Reveal className="lg:pt-2">
          <h2 id="derniers-titre" className="text-3xl leading-tight sm:text-4xl">
            Derniers feux détectés
          </h2>
          <p className="mt-5 max-w-[46ch] text-base leading-7 text-ink-2">
            Les six derniers contours publiés par EFFIS. Un clic ouvre la fiche du feu sur la carte : surface, végétation
            brûlée et points chauds relevés autour.
          </p>
        </Reveal>
        <div className="min-h-[26rem]">
          {latest ? (
            <AnimatedList>
              {latest.map((fire) => (
                <Link
                  key={fire.id}
                  href={`/carte?fire=${fire.id}`}
                  className="group grid grid-cols-[12px_minmax(0,1fr)_auto] items-center gap-x-4 rounded-lg border border-rule bg-paper px-4 py-3.5 transition-colors duration-200 hover:border-rule-strong hover:bg-raised"
                >
                  <span aria-hidden className="size-3 rounded-full" style={{ background: `var(${AGE_CLASSES[fire.ageClass].token})` }} />
                  <span className="min-w-0 transition-transform duration-300 ease-out group-hover:translate-x-0.5">
                    <span className="block truncate font-display text-lg font-semibold leading-6 text-ink transition-colors group-hover:text-signal-ink">
                      {fire.commune || "Commune non renseignée"}
                    </span>
                    <span className="block truncate text-sm text-ink-3">
                      {fire.province} · {fire.ageDays <= 31 ? formatAge(fire.ageDays) : formatDayMonth(fire.firedate)}
                    </span>
                  </span>
                  <span className="figure text-lg text-ink">
                    {formatArea(fire.areaHa)}
                    <span className="ml-1 text-xs text-ink-3">ha</span>
                  </span>
                </Link>
              ))}
            </AnimatedList>
          ) : (
            <ul aria-hidden className="flex flex-col gap-2">
              {Array.from({ length: SHOWN }, (_, k) => (
                <li key={k} className="h-[4.25rem] animate-pulse rounded-lg border border-rule bg-paper" />
              ))}
              {error && <li className="text-sm text-ink-3">Relevé en direct indisponible pour l’instant.</li>}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
