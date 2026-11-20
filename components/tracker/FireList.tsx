"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import { useDeferredValue, useMemo, useState } from "react";
import {
  MONTH_ABBREVIATIONS,
  formatAge,
  formatCount,
  formatDateTime,
  formatDayMonth,
  formatArea,
  formatInteger,
  formatMonthYear,
  formatDate,
} from "@/lib/format";
import type { SpanFire } from "@/lib/data/fires";
import { useSpanFires } from "@/lib/data/span-fires";
import { useMapStore } from "@/lib/store";
import { AGE_CLASSES, ageClass } from "@/components/scene/markers";
import { PeriodChips } from "./PeriodChips";

const PAGE = 50;

/** Accent- and case-insensitive search key. */
const fold = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** The fires of the period shown (window or month), as figures. */
function PeriodSummary({ fires }: { fires: readonly SpanFire[] | undefined }) {
  const { span, source, fires: windowFires } = useSpanFires();
  const month = useMapStore((state) => state.month);
  const archiveYear = useMapStore((state) => state.archiveYear);
  // The title needs no data: it is on screen before the fires arrive.
  const title =
    span && month !== null
      ? formatMonthYear(span.months[month])
      : archiveYear === null
        ? "Les 12 derniers mois"
        : `Année ${archiveYear}`;
  const first = span?.months[0];
  const last = span?.months[11];
  const subtitle = !span
    ? "Chargement…"
    : month === null && span.kind === "recent" && first && last
      ? `${MONTH_ABBREVIATIONS[first.month - 1]} ${first.year} - ${MONTH_ABBREVIATIONS[last.month - 1]} ${last.year}`
      : span.kind === "recent"
        ? "Feux détectés ce mois-là"
        : "Archives";
  const areaHa = (fires ?? []).reduce((sum, fire) => sum + fire.areaHa, 0);
  // "Last 7 days" only where the period reaches the date of the data.
  const reachesToday = span?.kind === "recent" && (month === null || month === span.months.length - 1);
  const lastWeek = reachesToday && windowFires ? windowFires.filter((fire) => (fire.ageDays ?? 99) <= 7).length : null;

  return (
    <div>
      <h2 className="text-2xl leading-tight tracking-[-0.025em] first-letter:uppercase">{title}</h2>
      <p className="text-sm text-ink-3">{subtitle}</p>
      {/* Labels may take two lines: the figures sit at the foot of each cell, on one line. */}
      <dl className="mt-3 grid grid-cols-3 divide-x divide-rule rounded-md border border-rule">
        <div className="flex flex-col px-2.5 py-1.5">
          <dt className="label">Feux</dt>
          <dd className="figure mt-auto text-lg leading-6 text-ink">{fires ? formatInteger(fires.length) : "–"}</dd>
        </div>
        <div className="flex flex-col px-2.5 py-1.5">
          <dt className="label">Surface brûlée</dt>
          <dd className="figure mt-auto text-lg leading-6 text-ink">
            {fires ? formatInteger(areaHa) : "–"}
            <span className="ml-1 text-xs text-ink-3">ha</span>
          </dd>
        </div>
        <div className="flex flex-col px-2.5 py-1.5">
          <dt className="label">{lastWeek !== null ? "Depuis 7 jours" : "Plus grand"}</dt>
          <dd className="figure mt-auto text-lg leading-6 text-ink">
            {!fires
              ? "–"
              : lastWeek !== null
                ? formatInteger(lastWeek)
                : formatInteger(Math.max(0, ...fires.map((fire) => fire.areaHa)))}
            {lastWeek === null && fires && <span className="ml-1 text-xs text-ink-3">ha</span>}
          </dd>
        </div>
      </dl>
      {source && (
        <p className={`mt-2 text-xs leading-4 ${source.kind === "fallback" ? "rounded-md bg-amber/15 px-2 py-1.5 text-ink" : "text-ink-3"}`}>
          {source.kind === "live" && <>Surfaces brûlées EFFIS (Copernicus), interrogé le {formatDateTime(source.asOf)}.</>}
          {source.kind === "fallback" && (
            <>Le suivi en direct ne répond pas. La carte affiche les fichiers du site, mis à jour le {formatDate(source.asOf)}.</>
          )}
          {source.kind === "year" && <>Surfaces brûlées EFFIS (Copernicus), données au {formatDate(source.asOf)}.</>}
        </p>
      )}
    </div>
  );
}

function FireRow({ fire }: { fire: SpanFire }) {
  const selectFire = useMapStore((state) => state.selectFire);
  const requestCamera = useMapStore((state) => state.requestCamera);
  const setHover = useMapStore((state) => state.setHover);
  const age = fire.ageDays;
  return (
    <li>
      <button
        type="button"
        onClick={() => {
          selectFire(fire.id);
          requestCamera({ kind: "bbox", bbox: fire.bbox });
        }}
        onMouseEnter={() => setHover({ id: fire.id, x: null, y: null })}
        onMouseLeave={() => setHover(null)}
        onFocus={() => setHover({ id: fire.id, x: null, y: null })}
        onBlur={() => setHover(null)}
        className="grid w-full grid-cols-[14px_minmax(0,1fr)_auto] items-baseline gap-x-2.5 border-b border-rule px-4 py-2 text-left transition-colors duration-150 hover:bg-raised lg:px-5"
      >
        <span
          aria-hidden
          className="size-2.5 translate-y-[1px] self-center rounded-full ring-1 ring-[color:var(--marker-edge)]"
          style={{ background: `var(${AGE_CLASSES[ageClass(age)].token})` }}
        />
        <span className="min-w-0 truncate font-bold text-ink">{fire.commune || "Commune non renseignée"}</span>
        <span className="figure text-sm text-ink">
          {formatArea(fire.areaHa)}
          <span className="ml-0.5 text-xs text-ink-3">ha</span>
        </span>
        <span />
        <span className="min-w-0 truncate text-xs text-ink-3">{fire.province || "Département non renseigné"}</span>
        <span className="text-xs tabular text-ink-3">{age !== null && age <= 31 ? formatAge(age) : formatDayMonth(fire.firedate)}</span>
      </button>
    </li>
  );
}

/** The period's figures, then its fires, most recent (or largest) first, searchable by commune or département. */
export function FireList() {
  const { fires, error } = useSpanFires();
  const month = useMapStore((state) => state.month);
  const sort = useMapStore((state) => state.sort);
  const setSort = useMapStore((state) => state.setSort);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [shown, setShown] = useState(PAGE);

  const inPeriod = useMemo(
    () => (fires ? fires.filter((fire) => month === null || fire.monthIndex === month) : undefined),
    [fires, month],
  );
  const listed = useMemo(() => {
    if (!inPeriod) return [];
    const needle = fold(deferredQuery.trim());
    const matching = needle
      ? inPeriod.filter((fire) => fold(`${fire.commune} ${fire.province}`).includes(needle))
      : [...inPeriod];
    return sort === "area"
      ? matching.sort((a, b) => b.areaHa - a.areaHa)
      : matching.sort((a, b) => b.firedate.localeCompare(a.firedate));
  }, [inPeriod, deferredQuery, sort]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-rule px-4 pb-3 pt-4 lg:px-5">
        <PeriodSummary fires={inPeriod} />
        <PeriodChips />
        <div className="mt-3 flex items-center gap-2">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Chercher une commune ou un département</span>
            <MagnifyingGlass size={15} weight="bold" aria-hidden className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setShown(PAGE);
              }}
              placeholder="Filtrer la liste"
              className="h-8 w-full rounded-md border border-rule-strong bg-sheet pl-8 pr-2 text-sm placeholder:text-ink-3 focus:border-ink focus-visible:outline-offset-0"
            />
          </label>
          <div role="group" aria-label="Trier les feux" className="flex shrink-0 overflow-hidden rounded-md border border-rule-strong text-xs">
            {(
              [
                ["date", "Récents"],
                ["area", "Plus grands"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={sort === value}
                onClick={() => setSort(value)}
                className={`h-8 px-2.5 font-bold ${sort === value ? "bg-ink text-sheet" : "bg-sheet text-ink-2 hover:text-ink"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <p role="alert" className="px-4 py-6 text-sm text-ink-2 lg:px-5">
          Les feux n’ont pas pu être chargés ({error.message}).
        </p>
      ) : !inPeriod ? (
        <p role="status" className="px-4 py-6 text-sm text-ink-3 lg:px-5">
          Chargement des feux…
        </p>
      ) : listed.length === 0 ? (
        <p className="px-4 py-6 text-sm text-ink-3 lg:px-5">
          {deferredQuery ? "Aucun feu ne correspond à cette recherche." : "Aucune surface brûlée cartographiée sur cette période."}
        </p>
      ) : (
        <div className="min-h-0 flex-1 lg:overflow-y-auto">
          <p className="sr-only" aria-live="polite">
            {formatCount(listed.length, "feu", "feux")}
          </p>
          <ul aria-label="Feux de la période">
            {listed.slice(0, shown).map((fire) => (
              <FireRow key={fire.id} fire={fire} />
            ))}
          </ul>
          {listed.length > shown && (
            <button
              type="button"
              onClick={() => setShown((count) => count + PAGE)}
              className="m-4 rounded-md border border-rule-strong px-3 py-1.5 text-sm font-bold text-ink hover:border-ink lg:mx-5"
            >
              Afficher {Math.min(PAGE, listed.length - shown)} feux de plus ({formatInteger(listed.length - shown)} restants)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
