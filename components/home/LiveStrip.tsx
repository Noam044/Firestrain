"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { NumberTicker } from "@/components/magic/number-ticker";
import { Reveal } from "@/components/motion/reveal";
import { Tooltip } from "@/components/ui/tooltip";
import { MONTH_ABBREVIATIONS, MONTH_NAMES, formatInteger } from "@/lib/format";
import { monthKey } from "@/lib/span";
import { useLiveSummary } from "./live";

/** One reading: a dt/dd pair grouped in the element that fades in (a valid child of <dl>). */
function Reading({ label, value, unit, note, delay }: { label: string; value: number | null; unit?: string; note?: ReactNode; delay: number }) {
  return (
    <Reveal delay={delay} className="border-l border-rule-strong pl-4">
      <dt className="text-sm text-ink-2">{label}</dt>
      <dd className="mt-2">
        <span className="figure block text-4xl text-ink sm:text-5xl">
          {value === null ? <span className="text-ink-3">–</span> : <NumberTicker value={value} />}
          {unit && value !== null && <span className="ml-1.5 text-base text-ink-3">{unit}</span>}
        </span>
        {note && <span className="mt-1 block text-xs text-ink-3">{note}</span>}
      </dd>
    </Reveal>
  );
}

/** The twelve months as readings, then month by month: each bar opens that month on the map. */
export function LiveStrip() {
  const { summary, hotspots } = useLiveSummary();
  const max = Math.max(1, ...(summary?.months.map((m) => m.areaHa) ?? [1]));
  return (
    <section aria-labelledby="mois-titre" className="mx-auto max-w-[1320px] px-5 py-16 md:px-8 lg:py-24">
      <Reveal>
        <h2 id="mois-titre" className="text-3xl leading-tight sm:text-4xl">
          Les douze derniers mois
        </h2>
      </Reveal>
      <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
        <Reading delay={0.04} label="Feux cartographiés" value={summary ? summary.fires.length : null} note="contours EFFIS, toutes tailles" />
        <Reading delay={0.1} label="Surface brûlée" value={summary ? Math.round(summary.areaHa) : null} unit="ha" />
        <Reading delay={0.16} label="Détectés depuis 7 jours" value={summary ? summary.lastWeek : null} />
        <Reading delay={0.22} label="Points chauds en 72 h" value={hotspots ? hotspots.count : null} note="NASA FIRMS, VIIRS" />
      </dl>

      <div className="mt-14">
        <p className="label">Surface brûlée par mois de détection</p>
        <ol className="mt-3 grid h-44 grid-cols-12 items-end gap-1.5 sm:gap-2.5">
          {(summary?.months ?? Array.from({ length: 12 }, () => null)).map((entry, k) => (
            <li key={entry ? monthKey(entry.month) : k} className="flex h-full flex-col justify-end">
              {entry ? (
                <Tooltip label={`${MONTH_NAMES[entry.month.month - 1]} ${entry.month.year} : ${formatInteger(entry.count)} feux, ${formatInteger(entry.areaHa)} ha`}>
                  <Link
                    href={`/carte?mois=${monthKey(entry.month)}`}
                    aria-label={`${MONTH_NAMES[entry.month.month - 1]} ${entry.month.year} : ${formatInteger(entry.areaHa)} ha, ${formatInteger(entry.count)} feux. Ouvrir sur la carte`}
                    className="group flex h-full flex-col justify-end"
                  >
                    <span
                      className="block origin-bottom rounded-t-sm bg-fire-old transition-[transform,background-color] duration-300 ease-out group-hover:scale-y-[1.04] group-hover:bg-signal"
                      style={{ height: `max(3px, ${(entry.areaHa / max) * 100}%)` }}
                    />
                  </Link>
                </Tooltip>
              ) : (
                <span className="block h-[3px] rounded-t-sm bg-rule" />
              )}
            </li>
          ))}
        </ol>
        <ol aria-hidden className="mt-2 grid grid-cols-12 gap-1.5 border-t border-rule-strong pt-2 sm:gap-2.5">
          {(summary?.months ?? []).map((entry) => (
            <li key={monthKey(entry.month)} className="figure text-center text-[10px] text-ink-3 sm:text-xs">
              <span className="sm:hidden">{MONTH_NAMES[entry.month.month - 1][0].toUpperCase()}</span>
              <span className="hidden sm:inline">{MONTH_ABBREVIATIONS[entry.month.month - 1]}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
