"use client";

import Link from "next/link";
import { useMemo } from "react";
import { formatDate, formatInteger } from "@/lib/format";
import { useMapStore } from "@/lib/store";
import { useYearFires } from "./period";

const SHOWN = 8;

/** The largest burnt areas of the period: a shortcut to the fires worth looking at, and to the full list. */
export function TopFires() {
  const { year, inPeriod, period } = useYearFires();
  const selectFire = useMapStore((state) => state.selectFire);
  const requestCamera = useMapStore((state) => state.requestCamera);
  const largest = useMemo(
    () => (inPeriod ? [...inPeriod].sort((a, b) => b.areaHa - a.areaHa).slice(0, SHOWN) : []),
    [inPeriod],
  );
  const max = largest[0]?.areaHa ?? 1;

  return (
    <section aria-labelledby="grands-titre">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="grands-titre" className="label">
          {period.kind === "year" ? "Plus grandes surfaces de l’année" : "Plus grandes surfaces de la période"}
        </h2>
        <Link
          href={`/liste?year=${year}`}
          className="text-xs font-medium text-moss underline decoration-moss/40 underline-offset-2 hover:decoration-moss"
        >
          Toute la liste
        </Link>
      </div>
      {inPeriod && largest.length === 0 && (
        <p className="mt-2 text-sm text-ink-3">Aucune surface brûlée cartographiée sur cette période.</p>
      )}
      <ol className="mt-1.5">
        {largest.map((fire) => (
          <li key={fire.id}>
            <button
              type="button"
              onClick={() => {
                selectFire(fire.id);
                requestCamera({ kind: "bbox", bbox: fire.bbox });
              }}
              className="group -mx-2 grid w-[calc(100%+1rem)] grid-cols-[1fr_auto] items-baseline gap-x-3 rounded-md px-2 py-1.5 text-left hover:bg-paper"
            >
              <span className="min-w-0 truncate text-sm font-medium text-ink group-hover:underline group-hover:decoration-rule">
                {fire.commune || "Commune non renseignée"}
              </span>
              <span className="text-sm tabular text-ink [font-stretch:110%]">{formatInteger(fire.areaHa)} ha</span>
              <span className="min-w-0 truncate text-xs text-ink-3">
                {fire.province} · {formatDate(fire.firedate).replace(/ \d{4}$/, "")}
              </span>
              <span aria-hidden className="mt-1 block h-[3px] w-16 justify-self-end rounded-full bg-rule">
                <span className="block h-full rounded-full bg-scorch" style={{ width: `${(fire.areaHa / max) * 100}%` }} />
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
