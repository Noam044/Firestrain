"use client";

import { Check } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { sourceShare, useLoadProgress, type LiveSource, type SourceProgress } from "@/lib/data/load-progress";

const SOURCES: { id: LiveSource; label: string; provider: string }[] = [
  { id: "firms", label: "Points chauds", provider: "NASA FIRMS" },
  { id: "effis", label: "Surfaces brûlées", provider: "EFFIS" },
];

/** How long 100 % stays on screen before the popup goes. */
const HOLD_MS = 700;

function status(progress: SourceProgress): string {
  switch (progress.step) {
    case "waiting":
      return "Requête en cours…";
    case "receiving":
      return "Réception…";
    case "done":
      return "Reçu";
    case "error":
      return "Indisponible";
  }
}

/**
 * Over the whole screen, blurred, while the live data loads: one bar from 0 to
 * 100 %, and a line per source, on the home page and the map. It appears only
 * while a request is under way (not when the data
 * is already in the cache), holds 100 % for a moment, then goes.
 */
export function DataLoading() {
  const sources = useLoadProgress((state) => state.sources);
  const active = SOURCES.some(({ id }) => sources[id]?.step === "waiting" || sources[id]?.step === "receiving");
  const [now, setNow] = useState(0);
  const [holding, setHolding] = useState(false);
  const [wasActive, setWasActive] = useState(false);

  // Leaving the loading state: keep 100 % on screen for a moment.
  if (active !== wasActive) {
    setWasActive(active);
    setHolding(!active);
  }
  useEffect(() => {
    if (!holding) return;
    const timer = window.setTimeout(() => setHolding(false), HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [holding]);
  const visible = active || holding;

  // A clock while visible, so the estimated part of the bar keeps moving.
  useEffect(() => {
    if (!visible) return;
    let timer = 0;
    const tick = () => {
      setNow(performance.now());
      timer = window.setTimeout(tick, 100);
    };
    tick();
    return () => window.clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;
  const shown = SOURCES.filter(({ id }) => sources[id]);
  const share = shown.length ? shown.reduce((sum, { id }) => sum + sourceShare(sources[id], now), 0) / shown.length : 0;
  const percent = active ? Math.min(99, Math.floor(share * 100)) : 100;

  return (
    // The whole screen blurred behind the popup: nothing is ready to read or click until the data is in.
    <div className="fixed inset-0 z-50 grid place-items-center bg-paper/40 p-4 backdrop-blur-sm">
      <div className="map-key w-full max-w-80 px-4 py-3.5 animate-pop-in">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-bold text-ink">Chargement des données satellite</p>
          <p className="figure shrink-0 whitespace-nowrap text-sm text-ink" aria-hidden>
            {percent} %
          </p>
        </div>
        <div
          role="progressbar"
          aria-label="Chargement des données satellite"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-rule"
        >
          <span className="block h-full rounded-full bg-signal transition-[width] duration-200 ease-out" style={{ width: `${percent}%` }} />
        </div>
        <ul className="mt-3 space-y-1 text-xs leading-4">
          {shown.map(({ id, label, provider }) => {
            const progress = sources[id]!;
            const done = progress.step === "done";
            return (
              <li key={id} className="flex items-center justify-between gap-3">
                <span className="text-ink-2">
                  {label} <span className="text-ink-3">· {provider}</span>
                </span>
                <span className={`flex items-center gap-1 ${done ? "text-ink" : "text-ink-3"}`}>
                  {done && <Check size={12} weight="bold" aria-hidden />}
                  {status(progress)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
