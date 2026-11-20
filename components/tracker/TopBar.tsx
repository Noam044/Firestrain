"use client";

import { formatInteger } from "@/lib/format";
import { useRecentDetections } from "@/lib/data/queries";
import { FIRST_YEAR, LAST_YEAR, useMapStore } from "@/lib/store";

const ARCHIVE_YEARS = Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, k) => LAST_YEAR - k);

/** Switch between the live twelve months and a year of the archives. */
function PeriodSwitch() {
  const archiveYear = useMapStore((state) => state.archiveYear);
  const setArchiveYear = useMapStore((state) => state.setArchiveYear);
  const live = archiveYear === null;
  return (
    <div role="group" aria-label="Période" className="flex overflow-hidden rounded-md border border-rule-strong text-sm">
      <button
        type="button"
        aria-pressed={live}
        onClick={() => setArchiveYear(null)}
        className={`h-8 px-3 font-bold ${live ? "bg-ink text-sheet" : "bg-white text-ink-2 hover:text-ink"}`}
      >
        12 derniers mois
      </button>
      <label className={`relative flex h-8 items-center border-l border-rule-strong ${live ? "bg-white text-ink-2" : "bg-ink text-sheet"}`}>
        <span className="sr-only">Archives : choisir une année</span>
        <select
          value={archiveYear ?? ""}
          onChange={(event) => setArchiveYear(event.target.value ? Number(event.target.value) : null)}
          className="h-full cursor-pointer appearance-none bg-transparent pl-3 pr-7 font-bold focus-visible:outline-offset-[-3px]"
        >
          <option value="" disabled hidden>
            Archives
          </option>
          {ARCHIVE_YEARS.map((year) => (
            <option key={year} value={year} className="bg-white text-ink">
              {year}
            </option>
          ))}
        </select>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className="pointer-events-none absolute right-2.5">
          <path d="m2 3.5 3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </label>
    </div>
  );
}

/** Hotspots of the last 72 hours: their count, and the switch of their map layer. */
function LiveToggle() {
  const archiveYear = useMapStore((state) => state.archiveYear);
  const showLive = useMapStore((state) => state.showLive);
  const setShowLive = useMapStore((state) => state.setShowLive);
  const live = useRecentDetections(archiveYear === null);
  if (archiveYear !== null) return null;
  const count = live.data?.count;
  return (
    <button
      type="button"
      aria-pressed={showLive}
      disabled={live.isError}
      onClick={() => setShowLive(!showLive)}
      title="Détections de chaleur des satellites VIIRS (NASA FIRMS) des 72 dernières heures"
      className={`flex h-8 items-center gap-2 rounded-md border px-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60 ${
        showLive ? "border-amber bg-amber/10 text-ink" : "border-rule-strong bg-white text-ink-2 hover:text-ink"
      }`}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="shrink-0">
        <circle cx="6" cy="6" r="3.5" fill="none" stroke="var(--amber)" strokeWidth="2" />
      </svg>
      {count !== undefined ? (
        <span>
          <span className="figure">{formatInteger(count)}</span> {count > 1 ? "points chauds" : "point chaud"}
          <span className="font-normal text-ink-3"> · 72 h</span>
        </span>
      ) : (
        <span>{live.isError ? "Points chauds indisponibles" : "Points chauds · 72 h"}</span>
      )}
    </button>
  );
}

/** The tracker's own bar: which period the map shows, and the live hotspots. */
export function TopBar() {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-rule bg-sheet px-4 py-2 lg:px-5">
      <PeriodSwitch />
      <LiveToggle />
    </div>
  );
}
