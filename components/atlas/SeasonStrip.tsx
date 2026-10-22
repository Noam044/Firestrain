"use client";

import { Slider } from "radix-ui";
import { useEffect } from "react";
import { formatDate, formatInteger } from "@/lib/format";
import { useMapStore } from "@/lib/store";
import { dateOfTimelineDay, daysInYear, monthRange } from "@/lib/timeline";
import { useMediaQuery } from "@/lib/use-media-query";
import { MONTHS, MONTHS_SHORT, useYearFires } from "./period";

const SPEEDS = [2, 7, 15] as const;

/** Plays the year day by day: smooth (fractional days, for fading) or one whole day per step with reduced motion. */
function usePlayback() {
  const playing = useMapStore((state) => state.playing);
  const speed = useMapStore((state) => state.speed);
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  useEffect(() => {
    if (!playing) return;
    const { getState } = useMapStore;
    const last = daysInYear(getState().year);
    if (reduceMotion) {
      const timer = window.setInterval(() => {
        const next = Math.floor(getState().timelineDay ?? 0) + 1;
        if (next > last) getState().setPlaying(false);
        else getState().setTimelineDay(next);
      }, 1000 / speed);
      return () => window.clearInterval(timer);
    }
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const next = (getState().timelineDay ?? 0) + ((now - previous) / 1000) * speed;
      previous = now;
      if (next >= last) {
        getState().setTimelineDay(last);
        getState().setPlaying(false);
        return;
      }
      getState().setTimelineDay(next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, reduceMotion]);
}

/**
 * The year month by month: each bar is a filter (only the fires first detected
 * that month), and the slider replays the year day by day.
 */
export function SeasonStrip() {
  const { year, monthly, period } = useYearFires();
  const playing = useMapStore((state) => state.playing);
  const speed = useMapStore((state) => state.speed);
  const setMonth = useMapStore((state) => state.setMonth);
  const setTimelineDay = useMapStore((state) => state.setTimelineDay);
  const setPlaying = useMapStore((state) => state.setPlaying);
  const setSpeed = useMapStore((state) => state.setSpeed);
  usePlayback();

  const days = daysInYear(year);
  const max = Math.max(1, ...monthly);
  const day = period.kind === "day" ? period.day : null;
  const date = day === null ? null : dateOfTimelineDay(year, day);
  const filtered = period.kind !== "year";

  const play = () => {
    if (playing) return setPlaying(false);
    if (day === null || day >= days) setTimelineDay(1);
    setPlaying(true);
  };

  return (
    <section aria-labelledby="saison-titre">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="saison-titre" className="label">
          Mois par mois{" "}
          <span className="font-semibold text-ink tabular">{date ? `· ${formatDate(date)}` : ""}</span>
        </h2>
        <div className="flex items-center gap-3">
          {filtered && (
            <button
              type="button"
              onClick={() => (period.kind === "month" ? setMonth(null) : setTimelineDay(null))}
              className="text-xs font-medium text-moss underline decoration-moss/40 underline-offset-2 hover:decoration-moss"
            >
              Toute l’année
            </button>
          )}
          <div role="group" aria-label="Vitesse de lecture" className="flex shrink-0 overflow-hidden rounded-md border border-rule">
            {SPEEDS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={speed === value}
                aria-label={`×${value} : ${value} jours par seconde`}
                onClick={() => setSpeed(value)}
                className={`h-6 min-w-8 px-1.5 text-[11px] tabular [font-stretch:85%] ${
                  speed === value ? "bg-ink text-sheet" : "bg-white text-ink-2 hover:text-ink"
                }`}
              >
                ×{value}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-1.5 flex items-center gap-3">
        <button
          type="button"
          onClick={play}
          aria-label={playing ? "Mettre en pause" : day !== null && day < days ? "Reprendre la lecture" : "Rejouer l’année jour par jour"}
          title={playing ? "Pause" : "Rejouer l’année jour par jour"}
          className="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-sheet hover:bg-moss"
        >
          {playing ? (
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <rect x="2" y="1.5" width="3" height="9" fill="currentColor" />
              <rect x="7" y="1.5" width="3" height="9" fill="currentColor" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <path d="M3 1.5v9l7.5-4.5z" fill="currentColor" />
            </svg>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="relative">
            <div className="grid h-11 grid-cols-12 items-end">
              {monthly.map((area, k) => {
                const month = k + 1;
                const start = monthRange(year, month)[0];
                const chosen = period.kind === "month" && period.month === month;
                const active = period.kind === "year" || chosen || (period.kind === "day" && start <= period.day);
                return (
                  <button
                    key={month}
                    type="button"
                    aria-pressed={chosen}
                    aria-label={`${MONTHS[k]} : ${formatInteger(area)} ha (feux de plus de 30 ha). Afficher seulement ce mois`}
                    onClick={() => setMonth(chosen ? null : month)}
                    className="group flex h-full items-end px-0.5"
                    title={`${MONTHS[k]} ${year} : ${formatInteger(area)} ha`}
                  >
                    <span
                      className={`block w-full rounded-t-[2px] transition-colors ${
                        active ? "bg-scorch" : "bg-cendre/30 group-hover:bg-cendre/60"
                      }`}
                      style={{ height: `max(2px, ${(area / max) * 100}%)` }}
                    />
                  </button>
                );
              })}
            </div>
            {day !== null && (
              <span
                aria-hidden
                className="pointer-events-none absolute bottom-0 top-0 w-px bg-ink"
                style={{ left: `${((day - 1) / (days - 1)) * 100}%` }}
              />
            )}
          </div>
          <div className="mt-1 grid grid-cols-12 border-t border-ink/70 pt-1" aria-hidden>
            {MONTHS_SHORT.map((label, k) => (
              <span
                key={label}
                className={`truncate text-center text-[11px] leading-none [font-stretch:72%] ${
                  period.kind === "month" && period.month === k + 1 ? "font-semibold text-scorch" : "text-ink-3"
                }`}
              >
                {/* Initials on phones, where the abbreviations would be cut off. */}
                <span className="sm:hidden">{MONTHS[k][0].toUpperCase()}</span>
                <span className="hidden sm:inline">{label}</span>
              </span>
            ))}
          </div>
          {/* The day slider runs along the same axis as the months above it. */}
          <Slider.Root
            className="relative mt-1 flex h-5 touch-none select-none items-center"
            min={1}
            max={days}
            step={1}
            value={[day ?? days]}
            onValueChange={([value]) => {
              setPlaying(false);
              setTimelineDay(value);
            }}
          >
            <Slider.Track className="relative h-[3px] grow rounded-full bg-rule">
              <Slider.Range className={`absolute h-full rounded-full ${day === null ? "bg-rule" : "bg-ink"}`} />
            </Slider.Track>
            <Slider.Thumb
              aria-label="Jour affiché"
              aria-valuetext={date ? formatDate(date) : `année ${year} entière`}
              className="block size-4 rounded-full border-2 border-ink bg-white"
            />
          </Slider.Root>
        </div>

      </div>
      <p aria-live="polite" className="sr-only">
        {!playing && date ? `Jour affiché : ${formatDate(date)}` : ""}
      </p>
    </section>
  );
}
