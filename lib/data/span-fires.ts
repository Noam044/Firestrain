"use client";

import { createContext, createElement, useContext, useMemo, type ReactNode } from "react";
import { useEffisIndex, useEffisYears, useRecentFires } from "./queries.ts";
import type { DecodedFire, SpanFire } from "./fires.ts";
import { useMapStore } from "../store.ts";
import { daysBetween, recentSpan, spanDay, spanMonthIndex, yearSpan, type Span } from "../span.ts";

/** Where the fires shown come from, for the source line and the notices. */
export type SpanSource =
  /** Server route: EFFIS queried at `asOf` (cached about an hour). */
  | { kind: "live"; asOf: string }
  /** Route unavailable: static files, data up to `asOf`. */
  | { kind: "fallback"; asOf: string }
  /** Archive year: static file, last EFFIS update `asOf`. */
  | { kind: "year"; asOf: string };

export type SpanData = {
  span: Span | null;
  /** Fires of the window, oldest first; undefined while loading. */
  fires: SpanFire[] | undefined;
  source: SpanSource | null;
  error: Error | null;
};

function place(fires: readonly DecodedFire[], span: Span): SpanFire[] {
  const asOf = span.kind === "recent" ? span.asOf : null;
  return fires
    .map((fire) => ({
      ...fire,
      day: spanDay(span, fire.firedate),
      monthIndex: spanMonthIndex(span, fire.firedate),
      ageDays: asOf ? Math.max(0, daysBetween(fire.firedate, asOf)) : null,
    }))
    .filter((fire) => fire.monthIndex >= 0)
    .sort((a, b) => a.firedate.localeCompare(b.firedate));
}

/**
 * Fires of the window shown: the last twelve months from the server route, or
 * an archive year from the static files. If the route fails, the twelve months
 * are rebuilt from the static files, up to their date (and the page says so).
 */
function useSpanData(): SpanData {
  const archiveYear = useMapStore((state) => state.archiveYear);
  const live = useRecentFires(archiveYear === null);
  const index = useEffisIndex();
  const fallback = archiveYear === null && live.isError;
  const staticAsOf =
    archiveYear === null
      ? index.data?.years.at(-1)?.lastUpdate
      : index.data?.years.find((y) => y.year === archiveYear)?.lastUpdate;

  const span = useMemo(() => {
    if (archiveYear !== null) return yearSpan(archiveYear);
    if (live.data) return recentSpan(live.data.generatedAt);
    return fallback && staticAsOf ? recentSpan(staticAsOf) : null;
  }, [archiveYear, live.data, fallback, staticAsOf]);

  const years = useMemo(
    () => (span && (archiveYear !== null || fallback) ? [...new Set(span.months.map((m) => m.year))] : []),
    [span, archiveYear, fallback],
  );
  const files = useEffisYears(years, years.length > 0);
  const raw = useMemo(
    () => (years.length > 0 ? files.data?.flat() : live.data?.fires),
    [years.length, files.data, live.data],
  );
  const fires = useMemo(() => (raw && span ? place(raw, span) : undefined), [raw, span]);

  const liveAsOf = live.data?.generatedAt;
  const source = useMemo((): SpanSource | null => {
    if (archiveYear !== null) return staticAsOf ? { kind: "year", asOf: staticAsOf } : null;
    if (liveAsOf) return { kind: "live", asOf: liveAsOf };
    return fallback && staticAsOf ? { kind: "fallback", asOf: staticAsOf } : null;
  }, [archiveYear, staticAsOf, liveAsOf, fallback]);
  const error = years.length > 0 ? files.error : fallback ? null : (live.error ?? null);
  return useMemo(() => ({ span, fires, source, error }), [span, fires, source, error]);
}

const SpanContext = createContext<SpanData | null>(null);

/** Computes the window once for the whole page (list, month strip, map). */
export function SpanFiresProvider({ children }: { children: ReactNode }) {
  return createElement(SpanContext.Provider, { value: useSpanData() }, children);
}

export function useSpanFires(): SpanData {
  const data = useContext(SpanContext);
  if (!data) throw new Error("useSpanFires outside SpanFiresProvider");
  return data;
}
