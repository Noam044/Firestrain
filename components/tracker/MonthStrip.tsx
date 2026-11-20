"use client";

import { useMemo, useRef, type KeyboardEvent } from "react";
import { MONTH_ABBREVIATIONS, MONTH_NAMES, formatCount, formatInteger } from "@/lib/format";
import { useSpanFires } from "@/lib/data/span-fires";
import { useMapStore } from "@/lib/store";

/**
 * The twelve months of the window, oldest first, each bar the burnt area of
 * the fires first detected that month: a radio group (arrows to move), the
 * first option showing all twelve months.
 */
export function MonthStrip() {
  const { span, fires } = useSpanFires();
  const month = useMapStore((state) => state.month);
  const setMonth = useMapStore((state) => state.setMonth);
  const selectFire = useMapStore((state) => state.selectFire);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const totals = useMemo(() => {
    const out = Array.from({ length: 12 }, () => ({ count: 0, areaHa: 0 }));
    for (const fire of fires ?? []) {
      out[fire.monthIndex].count += 1;
      out[fire.monthIndex].areaHa += fire.areaHa;
    }
    return out;
  }, [fires]);
  const max = Math.max(1, ...totals.map((t) => t.areaHa));

  // Options: −1 = the twelve months, then 0–11.
  const options = [-1, ...Array.from({ length: 12 }, (_, k) => k)];
  const current = month ?? -1;
  const choose = (option: number) => {
    setMonth(option < 0 ? null : option);
    // A fire belongs to one month: leaving it closes its card.
    const selected = useMapStore.getState().selectedFireId;
    const fire = fires?.find((candidate) => candidate.id === selected);
    if (fire && option >= 0 && fire.monthIndex !== option) selectFire(null);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    const jump = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : null;
    if (step === undefined && jump === null) return;
    event.preventDefault();
    const index = jump ?? Math.min(options.length - 1, Math.max(0, options.indexOf(current) + (step ?? 0)));
    choose(options[index]);
    buttons.current[index]?.focus();
  };

  if (!span) {
    return <div aria-hidden className="h-[74px]" />;
  }
  const range = `${MONTH_ABBREVIATIONS[span.months[0].month - 1]} ${span.months[0].year} – ${MONTH_ABBREVIATIONS[span.months[11].month - 1]} ${span.months[11].year}`;

  return (
    <div role="radiogroup" aria-label="Mois affiché" onKeyDown={onKeyDown} className="flex items-stretch gap-2 sm:gap-3">
      <button
        ref={(element) => {
          buttons.current[0] = element;
        }}
        type="button"
        role="radio"
        aria-checked={current === -1}
        tabIndex={current === -1 ? 0 : -1}
        onClick={() => choose(-1)}
        className={`flex w-[4.75rem] shrink-0 flex-col justify-end rounded-md border px-2 pb-1.5 pt-1 text-left sm:w-24 ${
          current === -1 ? "border-ink bg-ink text-sheet" : "border-rule-strong bg-white text-ink hover:border-ink"
        }`}
      >
        <span className="text-sm font-bold leading-tight">{span.kind === "recent" ? "12 mois" : `Année ${span.year}`}</span>
        <span className={`text-[11px] leading-4 ${current === -1 ? "text-sheet/75" : "text-ink-3"}`}>
          {span.kind === "recent" ? range : formatCount(fires?.length ?? 0, "feu", "feux")}
        </span>
      </button>
      <div className="grid min-w-0 flex-1 grid-cols-12">
        {span.months.map((m, k) => {
          const chosen = current === k;
          const dimmed = current !== -1 && !chosen;
          const total = totals[k];
          const showYear = k === 0 || m.month === 1;
          return (
            <button
              key={`${m.year}-${m.month}`}
              ref={(element) => {
                buttons.current[k + 1] = element;
              }}
              type="button"
              role="radio"
              aria-checked={chosen}
              tabIndex={chosen ? 0 : -1}
              aria-label={`${MONTH_NAMES[m.month - 1]} ${m.year} : ${formatCount(total.count, "feu", "feux")}, ${formatInteger(total.areaHa)} ha`}
              onClick={() => choose(chosen ? -1 : k)}
              className={`group flex min-w-0 flex-col items-stretch rounded-md px-0.5 pt-1 sm:px-1 ${chosen ? "bg-paper ring-1 ring-ink" : "hover:bg-paper"}`}
            >
              <span className="figure hidden text-center text-[11px] leading-3 text-ink-3 sm:block">{fires ? total.count : ""}</span>
              <span className="mt-0.5 flex h-9 items-end">
                <span
                  className={`block w-full rounded-t-[2px] ${dimmed ? "bg-rule-strong" : "bg-fire-month"}`}
                  style={{ height: total.areaHa > 0 ? `max(2px, ${(total.areaHa / max) * 100}%)` : "0" }}
                />
              </span>
              <span className={`mt-1 block border-t pt-0.5 text-center text-[11px] leading-4 ${chosen ? "border-ink font-bold text-ink" : "border-rule-strong text-ink-2"}`}>
                <span className="hidden sm:inline">{MONTH_ABBREVIATIONS[m.month - 1]}</span>
                <span className="sm:hidden">{MONTH_NAMES[m.month - 1][0].toUpperCase()}</span>
                {showYear && <span className="figure hidden text-[10px] leading-3 text-ink-3 sm:block">{m.year}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
