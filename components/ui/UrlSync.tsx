"use client";

import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { useEffect, useRef } from "react";
import { useEffisYear } from "@/lib/data/queries";
import { FIRST_YEAR, LAST_YEAR, useMapStore } from "@/lib/store";
import { dateOfTimelineDay, timelineDayOfDate } from "@/lib/timeline";

/**
 * Shareable state: ?year=2026&date=2026-07-22&fire=562583&cam=gironde.
 * The URL seeds the store once; afterwards the store writes back to the URL
 * (replace, not push), except while the timeline is playing.
 */
export function UrlSync() {
  const [params, setParams] = useQueryStates(
    { year: parseAsInteger, date: parseAsString, fire: parseAsInteger, cam: parseAsString },
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
    if (params.fire !== null) {
      store.selectFire(params.fire);
      if (!params.cam) pendingFocus.current = params.fire;
    }
    if (params.cam) store.requestCamera({ kind: "preset", preset: params.cam });
  }, [params]);

  useEffect(
    () =>
      useMapStore.subscribe((state, previous) => {
        if (!seeded.current || state.playing) return;
        const changed =
          state.year !== previous.year ||
          state.selectedFireId !== previous.selectedFireId ||
          state.timelineDay !== previous.timelineDay ||
          state.playing !== previous.playing;
        if (!changed) return;
        void setParams({
          year: state.year,
          date: state.timelineDay === null ? null : dateOfTimelineDay(state.year, state.timelineDay),
          fire: state.selectedFireId,
          cam: null,
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
