"use client";

import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { useEffect, useRef } from "react";
import { useSpanFires } from "@/lib/data/span-fires";
import { FIRST_YEAR, LAST_YEAR, useMapStore } from "@/lib/store";
import { monthKey } from "@/lib/span";
import { BASEMAPS } from "@/lib/geo/basemaps";
import { useDepartements2D } from "@/lib/data/queries";
import { mapDepartements } from "@/lib/data/departements-map";

const BASEMAP_IDS = BASEMAPS.map((basemap) => basemap.id);

/**
 * Shareable state: ?annee=2022&mois=2022-07&fire=562583&cam=gironde&fond=ortho&dep=gironde
 * (no `annee`: the last twelve months). The URL seeds the store once; afterwards
 * the store writes back to the URL (replace, not push). `year` is the former
 * name of `annee`. A month or a fire outside the window shown is dropped.
 */
export function UrlSync() {
  const [params, setParams] = useQueryStates(
    {
      annee: parseAsInteger,
      year: parseAsInteger,
      mois: parseAsString,
      fire: parseAsInteger,
      cam: parseAsString,
      fond: parseAsStringLiteral(BASEMAP_IDS),
      dep: parseAsString,
    },
    { history: "replace" },
  );
  const seeded = useRef(false);
  const pending = useRef<{ month: string | null; fire: number | null; focus: boolean } | null>(null);
  const pendingDepartement = useRef<{ slug: string; focus: boolean } | null>(null);
  const { span, fires } = useSpanFires();
  const latestSpan = useRef(span);
  useEffect(() => {
    latestSpan.current = span;
  }, [span]);

  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    const store = useMapStore.getState();
    const year = params.annee ?? params.year;
    if (year !== null && year >= FIRST_YEAR && year <= LAST_YEAR) store.setArchiveYear(year);
    pending.current = { month: params.mois, fire: params.fire, focus: params.fire !== null && !params.cam };
    // The département first: choosing one closes any fire card.
    if (params.dep) {
      store.setDepartement(params.dep);
      pendingDepartement.current = { slug: params.dep, focus: params.fire === null && !params.cam };
    }
    if (params.fire !== null) store.selectFire(params.fire);
    if (params.cam) store.requestCamera({ kind: "preset", preset: params.cam });
    if (params.fond) store.setBasemap(params.fond);
  }, [params]);

  // The département needs its outline: dropped if unknown, else framed by the camera.
  const outlines = useDepartements2D();
  useEffect(() => {
    const request = pendingDepartement.current;
    if (!request || !outlines.data) return;
    pendingDepartement.current = null;
    const departement = mapDepartements(outlines.data.features).find((d) => d.slug === request.slug);
    const store = useMapStore.getState();
    if (!departement) store.setDepartement(null);
    else if (request.focus) store.requestCamera({ kind: "bbox", bbox: departement.bbox });
  }, [outlines.data]);

  // Month and fire need the window: applied once its fires are loaded.
  useEffect(() => {
    const request = pending.current;
    if (!request || !span || !fires) return;
    pending.current = null;
    const store = useMapStore.getState();
    const month = request.month ? span.months.findIndex((m) => monthKey(m) === request.month) : -1;
    if (month >= 0) store.setMonth(month);
    if (request.fire === null) return;
    const fire = fires.find((candidate) => candidate.id === request.fire);
    if (!fire || (month >= 0 && fire.monthIndex !== month)) store.selectFire(null);
    else if (request.focus) store.requestCamera({ kind: "bbox", bbox: fire.bbox });
  }, [span, fires]);

  useEffect(
    () =>
      useMapStore.subscribe((state, previous) => {
        if (!seeded.current) return;
        const changed =
          state.archiveYear !== previous.archiveYear ||
          state.month !== previous.month ||
          state.selectedFireId !== previous.selectedFireId ||
          state.basemap !== previous.basemap ||
          state.departement !== previous.departement;
        if (!changed) return;
        const months = latestSpan.current?.months;
        void setParams({
          annee: state.archiveYear,
          year: null,
          cam: null,
          fond: state.basemap === "relief" ? null : state.basemap,
          dep: state.departement,
          // Month and fire still waiting for the window keep their place in the address.
          ...(pending.current
            ? {}
            : {
                mois: state.month !== null && months ? monthKey(months[state.month]) : null,
                fire: state.selectedFireId,
              }),
        });
      }),
    [setParams],
  );

  return null;
}
