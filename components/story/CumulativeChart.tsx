"use client";

import { scaleLinear } from "d3-scale";
import { area, line } from "d3-shape";
import { useEffect, useRef, useState } from "react";
import { formatDate, formatInteger } from "@/lib/format";
import type { EffisStats } from "@/lib/data/schemas";
import { EFFIS, SourceTag } from "@/components/ui/SourceTag";

type Week = EffisStats["weekly"]["weeks"][number];

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const MARGIN = { top: 16, right: 16, bottom: 28, left: 52 };

/** Day of the year of an ISO date (UTC calendar). */
const dayOfYear = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000) + 1;
};

/** Width of the element, measured after layout (a sensible default before that). */
function useWidth<T extends HTMLElement>(initial: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * Cumulative burnt area through the year: 2026 against the mean and the
 * min–max envelope of 2006–2025, as published weekly by EFFIS (fires ≥ 30 ha).
 */
export function CumulativeChart({ weekly, retrievedAt }: { weekly: EffisStats["weekly"]; retrievedAt?: string }) {
  const [ref, width] = useWidth<HTMLDivElement>(560);
  const height = Math.round(Math.min(320, Math.max(220, width * 0.55)));
  const weeks = weekly.weeks;
  const current = weeks.filter((w): w is Week & { cumulativeHa: number } => w.cumulativeHa !== null);
  const last = current.at(-1);
  const max = Math.max(...weeks.map((w) => Math.max(w.cumulativeMaxHa, w.cumulativeHa ?? 0)));

  const x = scaleLinear().domain([1, 366]).range([MARGIN.left, width - MARGIN.right]);
  const y = scaleLinear().domain([0, max]).nice(5).range([height - MARGIN.bottom, MARGIN.top]);
  const at = (w: Week) => x(dayOfYear(w.date));
  const band = area<Week>().x(at).y0((w) => y(w.cumulativeMinHa)).y1((w) => y(w.cumulativeMaxHa))(weeks) ?? "";
  const mean = line<Week>().x(at).y((w) => y(w.cumulativeMeanHa))(weeks) ?? "";
  const year = line<Week & { cumulativeHa: number }>().x(at).y((w) => y(w.cumulativeHa))(current) ?? "";
  const firstAboveMax = current.find((w) => w.cumulativeHa > w.cumulativeMaxHa);
  const reference = `${weekly.referenceFrom}–${weekly.year - 1}`;

  return (
    <figure className="m-0">
      <div ref={ref} className="w-full">
        <svg
          width={width}
          height={height}
          role="img"
          aria-labelledby="cumul-titre cumul-desc"
          className="block font-mono text-[10px]"
        >
          <title id="cumul-titre">{`Surface brûlée cumulée en ${weekly.year}, comparée à ${reference}`}</title>
          <desc id="cumul-desc">
            {last
              ? `Au ${formatDate(last.date)}, ${formatInteger(last.cumulativeHa)} ha en ${weekly.year}, contre ${formatInteger(
                  Math.round(last.cumulativeMeanHa),
                )} ha en moyenne et ${formatInteger(last.cumulativeMaxHa)} ha au plus sur ${reference} à la même date.`
              : ""}
          </desc>
          {y.ticks(5).map((tick) => (
            <g key={tick} transform={`translate(0,${y(tick)})`}>
              <line x1={MARGIN.left} x2={width - MARGIN.right} stroke="var(--ash-800)" />
              <text x={MARGIN.left - 6} dy="0.32em" textAnchor="end" fill="var(--ash-400)">
                {tick === 0 ? "0" : `${formatInteger(tick / 1000)} k`}
              </text>
            </g>
          ))}
          <text x={MARGIN.left - 6} y={MARGIN.top - 6} textAnchor="end" fill="var(--ash-400)">
            ha
          </text>
          {MONTHS.map((label, month) => {
            const day = dayOfYear(`${weekly.year}-${String(month + 1).padStart(2, "0")}-01`);
            return (
              <g key={label} transform={`translate(${x(day)},0)`}>
                <line y1={height - MARGIN.bottom} y2={height - MARGIN.bottom + 4} stroke="var(--ash-600)" />
                {(width >= 480 || month % 3 === 0) && (
                  <text y={height - MARGIN.bottom + 15} fill="var(--ash-400)">
                    {label}
                  </text>
                )}
              </g>
            );
          })}
          <path d={band} fill="var(--ash-800)" />
          <path d={mean} fill="none" stroke="var(--ash-400)" strokeWidth={1.5} strokeDasharray="4 3" />
          <path d={year} fill="none" stroke="var(--bone-100)" strokeWidth={2} />
          {last && (
            <g transform={`translate(${at(last)},${y(last.cumulativeHa)})`}>
              <circle r={3} fill="var(--bone-100)" />
              <text x={-6} y={-8} textAnchor="end" fill="var(--bone-100)">
                {`${weekly.year} : ${formatInteger(last.cumulativeHa)} ha`}
              </text>
            </g>
          )}
          <text
            x={width - MARGIN.right}
            y={y(weeks.at(-1)!.cumulativeMaxHa) - 6}
            textAnchor="end"
            fill="var(--bone-300)"
          >
            {`maximum ${reference}`}
          </text>
          <text
            x={width - MARGIN.right}
            y={y(weeks.at(-1)!.cumulativeMeanHa) - 6}
            textAnchor="end"
            fill="var(--ash-400)"
          >
            moyenne
          </text>
        </svg>
      </div>
      <figcaption className="mt-2 text-xs leading-5 text-bone-300">
        Trait plein : {weekly.year}. Tirets : moyenne {reference}. Bande : du minimum au maximum de ces années, semaine
        par semaine.
        {firstAboveMax && ` ${weekly.year} dépasse ce maximum à partir de la semaine du ${formatDate(firstAboveMax.date)}.`}
        <div className="mt-1">
          <SourceTag
            source={{
              ...EFFIS,
              url: `https://api2.effis.emergency.copernicus.eu/statistics/v2/effis/weekly?country=FRA&year=${weekly.year}`,
              dataDate: last?.date,
              retrievedAt,
              note: "Estimations hebdomadaires EFFIS, feux de 30 ha ou plus, cumul depuis le 1er janvier.",
            }}
          />
        </div>
      </figcaption>
      <details className="mt-3 text-xs text-bone-300">
        <summary className="cursor-pointer text-ash-400 hover:text-bone-300">Données du graphique</summary>
        <div className="mt-2 max-h-64 overflow-auto">
          <table className="w-full font-mono tabular">
            <thead className="text-left text-ash-400">
              <tr>
                <th className="py-1 pr-2 font-normal">Semaine du</th>
                <th className="py-1 pr-2 text-right font-normal">{weekly.year}</th>
                <th className="py-1 pr-2 text-right font-normal">Moyenne</th>
                <th className="py-1 pr-2 text-right font-normal">Min.</th>
                <th className="py-1 text-right font-normal">Max.</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={w.week} className="border-t border-ash-800">
                  <td className="py-1 pr-2">{formatDate(w.date)}</td>
                  <td className="py-1 pr-2 text-right">{w.cumulativeHa === null ? "—" : formatInteger(w.cumulativeHa)}</td>
                  <td className="py-1 pr-2 text-right">{formatInteger(Math.round(w.cumulativeMeanHa))}</td>
                  <td className="py-1 pr-2 text-right">{formatInteger(w.cumulativeMinHa)}</td>
                  <td className="py-1 text-right">{formatInteger(w.cumulativeMaxHa)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
