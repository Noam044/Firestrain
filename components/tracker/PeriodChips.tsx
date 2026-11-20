"use client";

import { useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import { MONTH_ABBREVIATIONS, MONTH_NAMES, formatCount, formatInteger } from "@/lib/format";
import { useSpanFires } from "@/lib/data/span-fires";
import { useMapStore } from "@/lib/store";

/**
 * The period, chosen above the list it filters: the whole window first, then
 * each month, newest first like the list, with its number of fires and a bar
 * for its burnt area against the largest month's. A radio
 * group (arrows move along the row); the row scrolls sideways and keeps the
 * chosen month in view.
 */
export function PeriodChips() {
  const { span, fires } = useSpanFires();
  const month = useMapStore((state) => state.month);
  const setMonth = useMapStore((state) => state.setMonth);
  const selectFire = useMapStore((state) => state.selectFire);
  const row = useRef<HTMLDivElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const totals = useMemo(() => {
    const out = Array.from({ length: 12 }, () => ({ count: 0, areaHa: 0 }));
    for (const fire of fires ?? []) {
      out[fire.monthIndex].count += 1;
      out[fire.monthIndex].areaHa += fire.areaHa;
    }
    return out;
  }, [fires]);

  // Options in visual order: −1 = the whole window, then the months, newest first.
  const options = [-1, ...Array.from({ length: 12 }, (_, k) => 11 - k)];
  const current = month ?? -1;
  const currentIndex = options.indexOf(current);

  // Keep the chosen chip in view, without scrolling the page itself.
  useEffect(() => {
    const container = row.current;
    const chip = buttons.current[currentIndex];
    if (!container || !chip) return;
    // The chip's place inside the row's content, and the row's own side padding.
    const pad = parseFloat(getComputedStyle(container).paddingLeft);
    const left = chip.getBoundingClientRect().left - container.getBoundingClientRect().left + container.scrollLeft;
    if (left - pad < container.scrollLeft || left + chip.offsetWidth + pad > container.scrollLeft + container.clientWidth) {
      container.scrollTo({ left: Math.max(0, left - pad), behavior: "smooth" });
    }
  }, [currentIndex, span]);

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
    const index = jump ?? Math.min(options.length - 1, Math.max(0, currentIndex + (step ?? 0)));
    choose(options[index]);
    buttons.current[index]?.focus();
  };

  if (!span) {
    return <div aria-hidden className="mt-3 h-[42px]" />;
  }

  const chip = (chosen: boolean) =>
    `flex shrink-0 flex-col items-start rounded-md border px-2.5 py-1 text-left ${
      chosen ? "border-ink bg-ink text-sheet" : "border-rule-strong bg-sheet text-ink hover:border-ink"
    }`;
  const max = Math.max(1, ...totals.map((t) => t.areaHa));
  const sub = (chosen: boolean) => `figure whitespace-nowrap text-[11px] leading-4 ${chosen ? "text-sheet/75" : "text-ink-3"}`;

  return (
    <div
      ref={row}
      role="radiogroup"
      aria-label="Mois affiché"
      onKeyDown={onKeyDown}
      className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:thin] lg:-mx-5 lg:px-5"
    >
      {options.map((option, index) => {
        const chosen = current === option;
        const ref = (element: HTMLButtonElement | null) => {
          buttons.current[index] = element;
        };
        if (option < 0) {
          return (
            <button
              key="all"
              ref={ref}
              type="button"
              role="radio"
              aria-checked={chosen}
              tabIndex={chosen ? 0 : -1}
              onClick={() => choose(-1)}
              className={chip(chosen)}
            >
              <span className="whitespace-nowrap text-xs font-bold leading-4">
                {span.kind === "recent" ? "12 mois" : `Année ${span.year}`}
              </span>
              <span className={sub(chosen)}>{fires ? formatCount(fires.length, "feu", "feux") : "–"}</span>
            </button>
          );
        }
        const m = span.months[option];
        const total = totals[option];
        // The year where the window crosses one: its oldest month and every January.
        const showYear = span.kind === "recent" && (option === 0 || m.month === 1);
        return (
          <button
            key={`${m.year}-${m.month}`}
            ref={ref}
            type="button"
            role="radio"
            aria-checked={chosen}
            tabIndex={chosen ? 0 : -1}
            aria-label={`${MONTH_NAMES[m.month - 1]} ${m.year} : ${formatCount(total.count, "feu", "feux")}, ${formatInteger(total.areaHa)} ha`}
            onClick={() => choose(chosen ? -1 : option)}
            className={chip(chosen)}
          >
            <span className="whitespace-nowrap text-xs font-bold leading-4">
              {MONTH_ABBREVIATIONS[m.month - 1]}
              {showYear && ` ${m.year}`}
            </span>
            <span className={sub(chosen)}>{fires ? formatCount(total.count, "feu", "feux") : "–"}</span>
            {/* The month's burnt area against the largest month's: the shape of the year at a glance. */}
            <span aria-hidden className={`mt-1 block h-[3px] w-full overflow-hidden rounded-full ${chosen ? "bg-sheet/25" : "bg-rule"}`}>
              <span
                className={`block h-full rounded-full ${chosen ? "bg-sheet" : "bg-fire-month"}`}
                style={{ width: total.areaHa > 0 ? `max(3px, ${(total.areaHa / max) * 100}%)` : "0" }}
              />
            </span>
          </button>
        );
      })}
    </div>
  );
}
