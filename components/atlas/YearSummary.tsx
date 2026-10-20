"use client";

import Link from "next/link";
import { formatDate, formatInteger } from "@/lib/format";
import { useBdiffAnnual, useEffisIndex } from "@/lib/data/queries";
import { FIRST_YEAR, LAST_YEAR } from "@/lib/store";
import { dateOfTimelineDay } from "@/lib/timeline";
import { MONTHS, THRESHOLD_HA, sumArea, useYearFires } from "./period";

const REFERENCE = { from: FIRST_YEAR, to: LAST_YEAR - 1 };

/** The figure of the period shown (year, month, or cumulative while replaying), and how the year compares. */
export function YearSummary() {
  const { year, inPeriod, period, query } = useYearFires();
  const index = useEffisIndex();
  const bdiff = useBdiffAnnual();
  const years = index.data?.years ?? [];
  const entry = years.find((y) => y.year === year);
  const reference = years.filter((y) => y.year >= REFERENCE.from && y.year <= REFERENCE.to);
  const mean = reference.length ? sumOf(reference) / reference.length : null;
  const rank = entry ? [...years].sort((a, b) => b.areaHaAtLeast30 - a.areaHaAtLeast30).findIndex((y) => y.year === year) + 1 : null;
  const declared = bdiff.data?.years.find((y) => y.year === year);

  const big = inPeriod ? inPeriod.filter((fire) => fire.areaHa >= THRESHOLD_HA) : null;
  const area = period.kind === "year" ? entry?.areaHaAtLeast30 : big ? sumArea(big) : undefined;
  const count = period.kind === "year" ? entry?.firesAtLeast30 : big?.length;
  const heading =
    period.kind === "month"
      ? `${capitalise(MONTHS[period.month - 1])} ${year}`
      : period.kind === "day"
        ? `Du 1er janvier au ${formatDate(dateOfTimelineDay(year, period.day)).replace(/ \d{4}$/, "")} ${year}`
        : String(year);

  return (
    <section aria-labelledby="bilan-titre" aria-live="polite" aria-atomic="true">
      <h2 id="bilan-titre" className="text-sm font-medium text-ink-2">
        {heading}
      </h2>
      <p className="mt-1 text-[2.75rem] leading-[1] figure text-ink">
        {area === undefined ? "—" : formatInteger(area)}
        <span className="ml-1.5 text-xl font-medium [font-stretch:100%]">ha</span>
      </p>
      <p className="mt-2 text-sm leading-5 text-ink-2">
        {query.isPending
          ? "Chargement des surfaces…"
          : count === undefined
            ? "Surfaces indisponibles pour cette année."
            : `brûlés, ${formatInteger(count)} feu${count > 1 ? "x" : ""} de plus de ${THRESHOLD_HA} ha`}
        {period.kind === "day" && " (surface finale de chaque feu, comptée dès sa première détection)"}
      </p>
      {period.kind === "year" && entry && mean !== null && rank !== null && (
        <p className="mt-1 text-sm leading-5 text-ink-2">
          {rank === 1 ? "Année la plus touchée" : `${rank}ᵉ année la plus touchée`} depuis {FIRST_YEAR} · moyenne{" "}
          {REFERENCE.from}–{REFERENCE.to} : {formatInteger(mean)} ha
        </p>
      )}
      <p className="mt-3 text-xs leading-4 text-ink-3">
        Surfaces cartographiées par satellite (EFFIS, Copernicus)
        {entry && `, données au ${formatDate(entry.lastUpdate)}`}.
        {period.kind === "year" && declared && (
          <>
            {" "}
            Feux déclarés par les services d’incendie (BDIFF) : {formatInteger(declared.areaHa)} ha, une autre mesure.
          </>
        )}{" "}
        <Link href="/methode" className="underline decoration-rule underline-offset-2 hover:text-ink">
          Méthode
        </Link>
      </p>
    </section>
  );
}

const sumOf = (years: readonly { areaHaAtLeast30: number }[]) => years.reduce((sum, y) => sum + y.areaHaAtLeast30, 0);
const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
