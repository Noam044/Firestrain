"use client";

import { useMemo } from "react";
import { fireTimelineDay, type DecodedFire } from "@/lib/data/fires";
import { useEffisYear } from "@/lib/data/queries";
import { useMapStore } from "@/lib/store";
import { monthRange } from "@/lib/timeline";

export const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** EFFIS official statistics count fires of at least this size. */
export const THRESHOLD_HA = 30;

export type Period =
  | { kind: "year"; from: number; to: number }
  | { kind: "month"; month: number; from: number; to: number }
  | { kind: "day"; day: number; from: number; to: number };

/** Time window shown on the map: whole year, one month, or up to the timeline day (whole days). */
export function usePeriod(): Period {
  const year = useMapStore((state) => state.year);
  const month = useMapStore((state) => state.month);
  const day = useMapStore((state) => (state.timelineDay === null ? null : Math.floor(state.timelineDay)));
  return useMemo(() => {
    if (month) {
      const [from, to] = monthRange(year, month);
      return { kind: "month", month, from, to };
    }
    if (day !== null) return { kind: "day", day, from: 1, to: day };
    return { kind: "year", from: 1, to: 366 };
  }, [year, month, day]);
}

/** Burnt areas of the year shown, and those inside the period. */
export function useYearFires() {
  const year = useMapStore((state) => state.year);
  const query = useEffisYear(year);
  const period = usePeriod();
  const fires = query.data?.fires;
  const inPeriod = useMemo(() => {
    if (!fires) return undefined;
    return fires.filter((fire) => {
      const day = fireTimelineDay(fire);
      return day >= period.from && day <= period.to;
    });
  }, [fires, period]);
  /** Area of fires ≥ 30 ha by month of first detection (Paris), January → December. */
  const monthly = useMemo(() => {
    const totals = new Array<number>(12).fill(0);
    for (const fire of fires ?? []) {
      if (fire.areaHa < THRESHOLD_HA) continue;
      const day = fireTimelineDay(fire);
      for (let m = 12; m >= 1; m--) {
        if (day >= monthRange(year, m)[0]) {
          totals[m - 1] += fire.areaHa;
          break;
        }
      }
    }
    return totals;
  }, [fires, year]);
  return { year, query, fires, inPeriod, monthly, period };
}

export const sumArea = (fires: readonly DecodedFire[], atLeast = 0) =>
  fires.reduce((sum, fire) => (fire.areaHa >= atLeast ? sum + fire.areaHa : sum), 0);
