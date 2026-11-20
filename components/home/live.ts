"use client";

import { useMemo } from "react";
import type { DecodedFire } from "@/lib/data/fires";
import { useRecentDetections, useRecentFires } from "@/lib/data/queries";
import { daysBetween, recentSpan, spanMonthIndex, type MonthOfYear } from "@/lib/span";
import { ageClass } from "@/components/scene/markers";

export type LiveFire = DecodedFire & { ageDays: number; ageClass: number };

export type LiveSummary = {
  asOf: string;
  fires: LiveFire[];
  /** Newest first. */
  latest: LiveFire[];
  largest: LiveFire | null;
  lastWeek: number;
  areaHa: number;
  months: { month: MonthOfYear; count: number; areaHa: number }[];
};

/**
 * The last twelve months as the home page tells them, from the live EFFIS route
 * (shared cache with the map) and the FIRMS hotspots of the last 72 hours.
 */
export function useLiveSummary() {
  const live = useRecentFires(true);
  const hotspots = useRecentDetections(true);
  const summary = useMemo((): LiveSummary | null => {
    if (!live.data) return null;
    const { fires: raw, generatedAt } = live.data;
    const fires = raw.map((fire) => {
      const ageDays = Math.max(0, daysBetween(fire.firedate, generatedAt));
      return { ...fire, ageDays, ageClass: ageClass(ageDays) };
    });
    const span = recentSpan(generatedAt);
    const months = span.months.map((month) => ({ month, count: 0, areaHa: 0 }));
    for (const fire of fires) {
      const k = spanMonthIndex(span, fire.firedate);
      if (k < 0) continue;
      months[k].count += 1;
      months[k].areaHa += fire.areaHa;
    }
    return {
      asOf: generatedAt,
      fires,
      latest: [...fires].sort((a, b) => b.firedate.localeCompare(a.firedate)),
      largest: fires.reduce<LiveFire | null>((best, fire) => (!best || fire.areaHa > best.areaHa ? fire : best), null),
      lastWeek: fires.filter((fire) => fire.ageDays <= 7).length,
      areaHa: fires.reduce((sum, fire) => sum + fire.areaHa, 0),
      months,
    };
  }, [live.data]);
  return { summary, error: live.isError, hotspots: hotspots.data ?? null, hotspotsError: hotspots.isError };
}
