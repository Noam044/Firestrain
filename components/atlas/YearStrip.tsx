"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { formatInteger } from "@/lib/format";
import { useEffisIndex } from "@/lib/data/queries";
import { FIRST_YEAR, LAST_YEAR, useMapStore } from "@/lib/store";

/**
 * The year selector is the data itself: one bar per year, its height the burnt
 * area of fires ≥ 30 ha (EFFIS). Click, or arrow keys, to change year.
 */
export function YearStrip({ barsHeight = "h-28" }: { barsHeight?: string }) {
  const year = useMapStore((state) => state.year);
  const setYear = useMapStore((state) => state.setYear);
  const index = useEffisIndex();
  const [hovered, setHovered] = useState<number | null>(null);
  const buttons = useRef(new Map<number, HTMLButtonElement>());
  const years = (index.data?.years ?? []).filter((y) => y.year >= FIRST_YEAR && y.year <= LAST_YEAR);
  const max = Math.max(1, ...years.map((y) => y.areaHaAtLeast30));
  const shown = years.find((y) => y.year === (hovered ?? year));

  const choose = (next: number) => {
    const clamped = Math.min(LAST_YEAR, Math.max(FIRST_YEAR, next));
    setYear(clamped);
    buttons.current.get(clamped)?.focus();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const moves: Record<string, number> = {
      ArrowLeft: year - 1,
      ArrowDown: year - 1,
      ArrowRight: year + 1,
      ArrowUp: year + 1,
      Home: FIRST_YEAR,
      End: LAST_YEAR,
    };
    if (event.key in moves) {
      event.preventDefault();
      choose(moves[event.key]);
    }
  };

  return (
    <section aria-labelledby="annees-titre">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="annees-titre" className="label">
          Année · surface brûlée
        </h2>
        <p className="text-xs tabular text-ink-2" aria-hidden>
          {shown ? (
            <>
              <span className="font-semibold text-ink">{shown.year}</span> · {formatInteger(shown.areaHaAtLeast30)} ha
            </>
          ) : (
            " "
          )}
        </p>
      </div>
      <div
        role="radiogroup"
        aria-labelledby="annees-titre"
        onKeyDown={onKeyDown}
        onMouseLeave={() => setHovered(null)}
        className={`mt-2 grid ${barsHeight} items-end gap-[3px]`}
        style={{ gridTemplateColumns: `repeat(${years.length || 21}, minmax(0, 1fr))` }}
      >
        {years.map((entry) => {
          const selected = entry.year === year;
          return (
            <button
              key={entry.year}
              ref={(element) => {
                if (element) buttons.current.set(entry.year, element);
                else buttons.current.delete(entry.year);
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              aria-label={`${entry.year} : ${formatInteger(entry.areaHaAtLeast30)} ha`}
              onClick={() => choose(entry.year)}
              onMouseEnter={() => setHovered(entry.year)}
              onFocus={() => setHovered(null)}
              className="group flex h-full items-end"
            >
              <span
                className={`block w-full rounded-t-[2px] transition-colors ${
                  selected ? "bg-scorch" : "bg-cendre/40 group-hover:bg-cendre"
                }`}
                style={{ height: `max(2px, ${(entry.areaHaAtLeast30 / max) * 100}%)` }}
              />
            </button>
          );
        })}
      </div>
      <div
        className="mt-1 grid gap-[3px] border-t border-ink/70 pt-1"
        style={{ gridTemplateColumns: `repeat(${years.length || 21}, minmax(0, 1fr))` }}
        aria-hidden
      >
        {years.map((entry) => (
          <span
            key={entry.year}
            className={`text-center text-[11px] leading-none tabular [font-stretch:75%] ${
              entry.year === year ? "font-semibold text-scorch" : "text-ink-3"
            }`}
          >
            {String(entry.year).slice(2)}
          </span>
        ))}
      </div>
    </section>
  );
}
