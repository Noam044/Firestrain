"use client";

import { useMemo } from "react";
import { parisDayOfYear } from "@/lib/data/fires";
import { useRecentFires } from "@/lib/data/queries";
import { MONTH_ABBREVIATIONS, formatDate, formatDecimal, formatInteger } from "@/lib/format";
import type { YearPace as YearPaceData } from "@/lib/server/year-pace";
import { Reveal } from "@/components/motion/reveal";

const W = 640;
const H = 220;

/** Parisian calendar year of an instant. */
const parisYear = (iso: string) =>
  Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric" }).format(new Date(iso)));

/** The current year from the live route (shared cache with the map), else the last archive year. */
function useCurrentYear(archive: YearPaceData["archive"]) {
  const live = useRecentFires(true);
  return useMemo(() => {
    if (live.data) {
      const { generatedAt, fires } = live.data;
      const year = parisYear(generatedAt);
      const perDay = new Array<number>(366).fill(0);
      for (const fire of fires) {
        if (parisYear(fire.firedate) === year) perDay[Math.min(365, parisDayOfYear(fire.firedate) - 1)] += fire.areaHa;
      }
      let total = 0;
      return { year, curve: perDay.map((area) => (total += area)), day: parisDayOfYear(generatedAt), asOf: generatedAt, live: true };
    }
    if (live.isError) return { ...archive, day: parisDayOfYear(archive.asOf), live: false };
    return null;
  }, [live.data, live.isError, archive]);
}

function path(curve: readonly number[], days: number, max: number) {
  let d = "";
  for (let k = 0; k < days; k++) {
    const x = (k / 365) * W;
    const y = H - (curve[k] / max) * H;
    d += `${k ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}

/**
 * The year so far against the past ones: burnt area since 1 January, day by
 * day, beside the average of the archive years and the record year.
 */
export function YearPace({ pace }: { pace: YearPaceData }) {
  const current = useCurrentYear(pace.archive);
  const { average, record, first, lastPast } = pace;
  const max = Math.max(record.curve[365], average[365], ...(current ? [current.curve[current.day - 1]] : [])) * 1.05;
  const today = current ? current.day - 1 : 0;
  const now = current?.curve[today] ?? 0;
  const atSameDate = average[today];
  const ratio = atSameDate > 0 ? now / atSameDate : 0;

  return (
    <section aria-labelledby="annee-titre" className="border-t border-rule">
      <div className="mx-auto max-w-[1320px] px-5 py-16 md:px-8 lg:py-24">
        <Reveal className="max-w-[62ch]">
          <h2 id="annee-titre" className="text-3xl leading-tight sm:text-4xl">
            {current ? `${current.year} face aux années passées` : "L’année en cours face aux années passées"}
          </h2>
          <p className="mt-4 leading-7 text-ink-2">
            {current ? (
              <>
                Au {formatDate(current.asOf)}, <span className="figure text-ink">{formatInteger(now)} ha</span> ont brûlé
                depuis le 1<sup>er</sup> janvier,{" "}
                {ratio >= 1.05 ? (
                  <>
                    soit <strong className="text-ink">{formatDecimal(ratio, 1)} fois</strong> la moyenne {first}-{lastPast} à la
                    même date
                  </>
                ) : ratio <= 0.95 ? (
                  <>
                    soit <strong className="text-ink">{formatInteger(Math.round(ratio * 100))} %</strong> de la moyenne {first}-
                    {lastPast} à la même date
                  </>
                ) : (
                  <>autant que la moyenne {first}-{lastPast} à la même date</>
                )}{" "}
                (<span className="figure">{formatInteger(atSameDate)} ha</span>). En {record.year}, l’année la plus touchée de {first} à {lastPast},{" "}
                <span className="figure">{formatInteger(record.curve[today])} ha</span> avaient brûlé à cette date.
                {!current.live && " Le suivi en direct ne répond pas : chiffres des archives du site."}
              </>
            ) : (
              "Surface brûlée depuis le 1er janvier, jour par jour, comparée aux années passées."
            )}
          </p>
        </Reveal>

        <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink-2">
          <li className="flex items-center gap-2">
            <span aria-hidden className="h-0.5 w-5 rounded-full bg-signal" />
            {current?.year ?? "Année en cours"}
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden className="w-5 border-t-2 border-dashed border-ink-2" />
            Moyenne {first}-{lastPast}
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden className="h-0.5 w-5 rounded-full bg-ink-3" />
            {record.year}, la plus touchée de {first} à {lastPast}
          </li>
        </ul>

        <div className="mt-4">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="h-56 w-full overflow-visible sm:h-64"
            role="img"
            aria-label={
              current
                ? `Surface brûlée cumulée depuis le 1er janvier : ${current.year}, ${formatInteger(now)} ha ; moyenne ${first}-${lastPast} à la même date, ${formatInteger(atSameDate)} ha ; ${record.year}, ${formatInteger(record.curve[today])} ha.`
                : "Surface brûlée cumulée depuis le 1er janvier, comparée aux années passées."
            }
          >
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <line key={f} x1={0} x2={W} y1={H - f * H} y2={H - f * H} stroke="var(--rule)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
            <line x1={0} x2={W} y1={H} y2={H} stroke="var(--rule-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <path d={path(record.curve, 366, max)} fill="none" stroke="var(--ink-3)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
            <path d={path(average, 366, max)} fill="none" stroke="var(--ink-2)" strokeWidth={1.5} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
            {current && (
              <>
                <line x1={(today / 365) * W} x2={(today / 365) * W} y1={0} y2={H} stroke="var(--rule-strong)" strokeWidth={1} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
                <path d={path(current.curve, current.day, max)} fill="none" stroke="var(--signal)" strokeWidth={2.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              </>
            )}
          </svg>
          <div aria-hidden className="mt-2 grid grid-cols-12 text-xs text-ink-3">
            {MONTH_ABBREVIATIONS.map((month) => (
              <span key={month} className="first-letter:uppercase">
                <span className="hidden sm:inline">{month}</span>
                <span className="sm:hidden">{month[0].toUpperCase()}</span>
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-3">
            Haut du graphique : <span className="figure">{formatInteger(Math.round(max))} ha</span>. Toutes les surfaces
            cartographiées par EFFIS, par jour de première détection.
          </p>
        </div>
      </div>
    </section>
  );
}
