"use client";

import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { useEffect, useRef } from "react";
import { useEffisYear } from "@/lib/data/queries";
import { FIRST_YEAR, LAST_YEAR, useMapStore } from "@/lib/store";
import { dateOfTimelineDay, timelineDayOfDate } from "@/lib/timeline";
import { BASEMAPS } from "@/lib/geo/basemaps";

const BASEMAP_IDS = BASEMAPS.map((basemap) => basemap.id);

/**
 * Shareable state: ?year=2026&mois=7&date=2026-07-22&fire=562583&cam=gironde&fond=satellite.
 * The URL seeds the store once; afterwards the store writes back to the URL
 * (replace, not push), except while the timeline is playing.
 */
export function UrlSync() {
  const [params, setParams] = useQueryStates(
    {
      year: parseAsInteger,
      date: parseAsString,
      fire: parseAsInteger,
      cam: parseAsString,
      fond: parseAsStringLiteral(BASEMAP_IDS),
      mois: parseAsInteger,
    },
    { history: "replace" },
  );
  const seeded = useRef(false);
  const pendingFocus = useRef<number | null>(null);

  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    const store = useMapStore.getState();
    if (params.year !== null && params.year >= FIRST_YEAR && params.year <= LAST_YEAR) store.setYear(params.year);
    const { year } = useMapStore.getState();
    const day = params.date ? timelineDayOfDate(year, params.date) : null;
    if (day !== null) store.setTimelineDay(day);
    else if (params.mois !== null && params.mois >= 1 && params.mois <= 12) store.setMonth(params.mois);
    if (params.fire !== null) {
      store.selectFire(params.fire);
      if (!params.cam) pendingFocus.current = params.fire;
    }
    if (params.cam) store.requestCamera({ kind: "preset", preset: params.cam });
    if (params.fond) store.setBasemap(params.fond);
  }, [params]);

  useEffect(
    () =>
      useMapStore.subscribe((state, previous) => {
        if (!seeded.current || state.playing) return;
        const changed =
          state.year !== previous.year ||
          state.selectedFireId !== previous.selectedFireId ||
          state.timelineDay !== previous.timelineDay ||
          state.playing !== previous.playing ||
          state.basemap !== previous.basemap ||
          state.month !== previous.month;
        if (!changed) return;
        void setParams({
          year: state.year,
          date: state.timelineDay === null ? null : dateOfTimelineDay(state.year, state.timelineDay),
          fire: state.selectedFireId,
          cam: null,
          fond: state.basemap === "relief" ? null : state.basemap,
          mois: state.month,
        });
      }),
    [setParams],
  );

  // A fire given in the URL is framed once its outline is loaded; an unknown id is dropped.
  const year = useMapStore((state) => state.year);
  const fires = useEffisYear(year).data?.fires;
  useEffect(() => {
    const id = pendingFocus.current;
    if (id === null || !fires) return;
    pendingFocus.current = null;
    const fire = fires.find((candidate) => candidate.id === id);
    if (fire) useMapStore.getState().requestCamera({ kind: "bbox", bbox: fire.bbox });
    else useMapStore.getState().selectFire(null);
  }, [fires]);

  return null;
}
