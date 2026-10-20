"use client";

import { Slider } from "radix-ui";
import { useEffect } from "react";
import { formatDate, formatDateTime, formatInteger } from "@/lib/format";
import { useFirmsIndex, useRecentDetections } from "@/lib/data/queries";
import { LAST_YEAR, useMapStore } from "@/lib/store";
import { dateOfTimelineDay, daysInYear, timelineDayOfDate } from "@/lib/timeline";
import { useMediaQuery } from "@/lib/use-media-query";
import { FIRMS, SourceTag } from "./SourceTag";

const SPEEDS = [2, 7, 15] as const;
const MONTH_LABELS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** First timeline day of each month of the year. */
function monthTicks(year: number) {
  return MONTH_LABELS.map((label, month) => ({
    label,
    day: timelineDayOfDate(year, `${year}-${String(month + 1).padStart(2, "0")}-01`) ?? 1,
  }));
}

/** 1 January → 31 December of the year shown: play, pause, speed, day by day. */
export function Timeline() {
  const year = useMapStore((state) => state.year);
  // Whole days for the interface; playback reads and writes the fractional day through getState.
  const day = useMapStore((state) => (state.timelineDay === null ? null : Math.floor(state.timelineDay)));
  const playing = useMapStore((state) => state.playing);
  const speed = useMapStore((state) => state.speed);
  const setTimelineDay = useMapStore((state) => state.setTimelineDay);
  const setPlaying = useMapStore((state) => state.setPlaying);
  const setSpeed = useMapStore((state) => state.setSpeed);
  const showRecent = useMapStore((state) => state.showRecent);
  const setShowRecent = useMapStore((state) => state.setShowRecent);
  const recent = useRecentDetections(showRecent);
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const firms = useFirmsIndex();
  const entry = firms.data?.years.find((y) => y.year === year);
  const days = daysInYear(year);

  // Playback: smooth (fractional days, for fading) or, with reduced motion, one whole day per step.
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

  const date = day === null ? null : dateOfTimelineDay(year, day);
  const togglePlay = () => {
    if (playing) setPlaying(false);
    else {
      if (day === null || day >= days) setTimelineDay(1);
      setPlaying(true);
    }
  };

  return (
    <section aria-label={`Frise de l’année ${year}`} className="border border-ash-800 bg-ash-950 px-3 pb-2 pt-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type="button"
          onClick={togglePlay}
          className="label-caps w-20 border border-bone-100 px-2 py-1 text-bone-100 hover:bg-bone-100 hover:text-ash-950"
        >
          {playing ? "Pause" : "Lecture"}
        </button>
        <p className="min-w-[8.5rem] font-mono text-sm tabular text-bone-100">
          {date ? formatDate(date) : showRecent ? "72 dernières heures" : `Année ${year} entière`}
        </p>
        <div role="group" aria-label="Vitesse de lecture" className="flex gap-1">
          {SPEEDS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={speed === value}
              onClick={() => setSpeed(value)}
              className={`border px-1.5 py-0.5 font-mono text-[11px] ${
                speed === value ? "border-bone-300 text-bone-100" : "border-ash-700 text-ash-400 hover:text-bone-300"
              }`}
            >
              {value} j/s
            </button>
          ))}
        </div>
        {year === LAST_YEAR && (
          <button
            type="button"
            aria-pressed={showRecent}
            aria-label="72 h : détections des 72 dernières heures"
            onClick={() => setShowRecent(!showRecent)}
            className={`border px-1.5 py-0.5 font-mono text-[11px] ${
              showRecent ? "border-ember text-bone-100" : "border-ash-700 text-ash-400 hover:text-bone-300"
            }`}
          >
            72 h
          </button>
        )}
        {day !== null && (
          <button
            type="button"
            onClick={() => setTimelineDay(null)}
            className="label-caps ml-auto text-bone-300 underline decoration-ash-600 underline-offset-4 hover:text-bone-100"
          >
            Toute l’année
          </button>
        )}
      </div>

      <Slider.Root
        className="relative mt-3 flex h-5 touch-none select-none items-center"
        min={1}
        max={days}
        step={1}
        value={[Math.round(day ?? days)]}
        onValueChange={([value]) => {
          setPlaying(false);
          setTimelineDay(value);
        }}
      >
        <Slider.Track className="relative h-px grow bg-ash-600">
          <Slider.Range className={`absolute h-full ${day === null ? "bg-ash-600" : "bg-bone-300"}`} />
        </Slider.Track>
        <Slider.Thumb
          aria-label="Date affichée"
          aria-valuetext={date ? formatDate(date) : `année ${year} entière`}
          className="block size-3.5 border border-bone-100 bg-ash-950"
        />
      </Slider.Root>
      <div className="relative mt-1 h-4 font-mono text-[10px] text-ash-400" aria-hidden>
        {monthTicks(year).map((month, index) => (
          <span
            key={month.label}
            className={`absolute ${index % 3 === 0 ? "" : "max-sm:hidden"}`}
            style={{ left: `${((month.day - 1) / (days - 1)) * 100}%` }}
          >
            {month.label}
          </span>
        ))}
      </div>

      {showRecent ? (
        <div className="mt-1 text-[11px] leading-4 text-ash-400">
          <p>
            {recent.isError
              ? "Détections des 72 dernières heures indisponibles pour le moment."
              : recent.data
                ? `${formatInteger(recent.data.count)} détections VIIRS en temps quasi réel dans les 72 heures précédant le ${formatDateTime(recent.data.generatedAt)} ; des points chauds, pas des surfaces.`
                : "Chargement des 72 dernières heures…"}
          </p>
          {recent.data && (
            <SourceTag
              source={{
                ...FIRMS,
                retrievedAt: recent.data.generatedAt,
                note: "Temps quasi réel (S-NPP, NOAA-20, NOAA-21), interrogé par le serveur de FireStrain et mis en cache environ une heure. Sources de chaleur fixes écartées.",
              }}
            />
          )}
        </div>
      ) : (
        <p className="mt-1 text-[11px] leading-4 text-ash-400">
          {entry
            ? `${formatInteger(entry.count)} détections d’anomalies thermiques VIIRS (${entry.satellites.join(", ")})${
                entry.lastDate < `${year}-12-31` ? ` jusqu’au ${formatDate(entry.lastDate)}` : ""
              } ; elles ne mesurent pas des surfaces.${
                entry.satellites.length > 1 ? " Trois satellites en 2026, un seul avant : les nombres ne se comparent pas." : ""
              }`
            : firms.isSuccess
              ? "Pas de détections VIIRS pour cette année (disponibles à partir de 2012)."
              : "Chargement des détections…"}
        </p>
      )}
      <p aria-live="polite" className="sr-only">
        {!playing && date ? `Date affichée : ${formatDate(date)}` : ""}
      </p>
    </section>
  );
}
