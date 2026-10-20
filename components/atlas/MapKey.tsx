"use client";

import { formatDateTime, formatInteger } from "@/lib/format";
import { useRecentDetections } from "@/lib/data/queries";
import { FIRST_YEAR, LAST_YEAR, useMapStore } from "@/lib/store";

/** Same 45° hatching as the map. */
function HatchSwatch() {
  return (
    <svg width="22" height="14" aria-hidden className="shrink-0 rounded-[2px]">
      <defs>
        <pattern id="cle-hachures" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="4" stroke="var(--cendre)" strokeWidth="1.6" />
        </pattern>
      </defs>
      <rect width="22" height="14" fill="#eef0ea" />
      <rect width="22" height="14" fill="url(#cle-hachures)" />
    </svg>
  );
}

/** What the map shows, with the layers that can be switched on and off. */
export function MapKey() {
  const year = useMapStore((state) => state.year);
  const showHistory = useMapStore((state) => state.showHistory);
  const setShowHistory = useMapStore((state) => state.setShowHistory);
  const showRecent = useMapStore((state) => state.showRecent);
  const setShowRecent = useMapStore((state) => state.setShowRecent);
  const replaying = useMapStore((state) => state.timelineDay !== null);
  const recent = useRecentDetections(showRecent);

  return (
    <section aria-labelledby="cle-titre">
      <h2 id="cle-titre" className="label">
        Sur la carte
      </h2>
      <ul className="mt-2 space-y-2 text-sm text-ink-2">
        <li className="flex items-center gap-2.5">
          <span aria-hidden className="h-3.5 w-[22px] shrink-0 rounded-[2px] border border-scorch-ink bg-scorch" />
          Brûlé en {year}
        </li>
        {year > FIRST_YEAR && (
          <li>
            <label className="flex cursor-pointer items-center gap-2.5">
              <HatchSwatch />
              <span className="flex-1">
                Brûlé de {FIRST_YEAR} à {year - 1}
              </span>
              <input
                type="checkbox"
                checked={showHistory}
                onChange={(event) => setShowHistory(event.target.checked)}
                className="size-4 accent-moss"
              />
            </label>
          </li>
        )}
        <li className="flex items-center gap-2.5">
          <svg width="22" height="14" aria-hidden className="shrink-0">
            <circle cx="7" cy="7" r="3" fill="none" stroke="var(--amber)" strokeWidth="1.8" />
            <circle cx="16" cy="7" r="4.5" fill="none" stroke="var(--amber)" strokeWidth="1.8" />
          </svg>
          <span>
            Point chaud vu par satellite
            <span className="text-ink-3"> {replaying || showRecent ? "(3 derniers jours)" : "(pendant la lecture)"}</span>
          </span>
        </li>
        {year === LAST_YEAR && (
          <li>
            <label className="flex cursor-pointer items-center gap-2.5">
              <span className="w-[22px] shrink-0" aria-hidden />
              <span className="flex-1">Points chauds des 72 dernières heures</span>
              <input
                type="checkbox"
                checked={showRecent}
                onChange={(event) => setShowRecent(event.target.checked)}
                className="size-4 accent-moss"
              />
            </label>
            {showRecent && (
              <p className="mt-1 pl-[32px] text-xs leading-4 text-ink-3" aria-live="polite">
                {recent.isError
                  ? "Indisponibles pour le moment."
                  : recent.data
                    ? `${formatInteger(recent.data.count)} détections NASA FIRMS avant le ${formatDateTime(recent.data.generatedAt)}.`
                    : "Chargement…"}
              </p>
            )}
          </li>
        )}
      </ul>
    </section>
  );
}
