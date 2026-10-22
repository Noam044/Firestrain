"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { formatDate, formatDateTime, formatDecimal, formatInteger, formatLocalDateTime } from "@/lib/format";
import { fireTimelineDay, type DecodedFire } from "@/lib/data/fires";
import { useBdiffAnnual, useBdiffMatches, useDetections, useEvents, useFirmsIndex } from "@/lib/data/queries";
import { bboxContains, pointInRings } from "@/lib/geo/polygon";
import { LAND_COVER_KEYS, type StoryFact } from "@/lib/data/schemas";
import { LAND_COVER_LABELS } from "@/lib/data/land-cover";
import { useMapStore } from "@/lib/store";
import { dateOfTimelineDay, daysInYear } from "@/lib/timeline";

/** VIIRS pixel half-width: detections this close to the outline are counted (≈ 400 m). */
const NEAR_KM = 0.4;
/** Detections are attributed to the fire from 2 days before its EFFIS date to 60 days after. */
const BEFORE_DAYS = 2;
const AFTER_DAYS = 60;

/** Land-cover tones, from forest (dark) to artificial ground (light), so the bar reads without a legend. */
const COVER_TONES = ["#2f5240", "#3f6b52", "#56806a", "#7e9a6c", "#a3b08a", "#c3c7a5", "#d9c9a3", "#b9b4ad", "#dcdcd6"];

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-rule pt-3">
      <h3 className="label">{title}</h3>
      <div className="mt-1.5 text-sm leading-5 text-ink-2">{children}</div>
    </section>
  );
}

function LandCover({ values }: { values: DecodedFire["landCover"] }) {
  if (!values) return <p>Non renseignée par EFFIS.</p>;
  const rows = LAND_COVER_KEYS.map((key, i) => ({ key, value: values[i], tone: COVER_TONES[i] }))
    .filter((row) => row.value >= 0.5)
    .sort((a, b) => b.value - a.value);
  return (
    <>
      <div className="flex h-2.5 overflow-hidden rounded-full" aria-hidden>
        {rows.map((row) => (
          <span key={row.key} style={{ width: `${row.value}%`, background: row.tone }} />
        ))}
      </div>
      <ul className="mt-2 space-y-0.5">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-2 text-xs">
            <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: row.tone }} />
            <span className="flex-1">{LAND_COVER_LABELS[row.key]}</span>
            <span className="tabular text-ink">{formatDecimal(row.value, 0)} %</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Day-by-day FIRMS detections inside the outline: hotspots, never converted to an area. */
function FireActivity({ fire, year }: { fire: DecodedFire; year: number }) {
  const index = useFirmsIndex();
  const detections = useDetections(year);
  const timelineDay = useMapStore((state) => (state.timelineDay === null ? null : Math.floor(state.timelineDay)));
  const perDay = useMemo(() => {
    const data = detections.data;
    if (!data) return null;
    const counts = new Uint16Array(daysInYear(year) + 1);
    const first = fireTimelineDay(fire) - BEFORE_DAYS;
    const last = fireTimelineDay(fire) + AFTER_DAYS;
    const [x0, z0, x1, z1] = fire.bbox;
    const box: [number, number, number, number] = [x0 - NEAR_KM, z0 - NEAR_KM, x1 + NEAR_KM, z1 + NEAR_KM];
    for (let k = 0; k < data.count; k++) {
      const x = data.positions[2 * k];
      const z = data.positions[2 * k + 1];
      if (data.day[k] < first || data.day[k] > last || !bboxContains(box, x, z)) continue;
      const near = [[0, 0], [NEAR_KM, 0], [-NEAR_KM, 0], [0, NEAR_KM], [0, -NEAR_KM]].some(([dx, dz]) =>
        pointInRings(x + dx, z + dz, fire.rings),
      );
      if (near) counts[data.day[k]] += 1;
    }
    return counts;
  }, [detections.data, fire, year]);

  if (index.isSuccess && !index.data.years.some((y) => y.year === year)) return <p>Pas de détections avant 2012.</p>;
  if (!perDay) return <p className="text-ink-3">Chargement…</p>;
  const days = Array.from(perDay.keys()).filter((d) => d > 0 && perDay[d] > 0);
  const total = days.reduce((sum, d) => sum + perDay[d], 0);
  if (total === 0) return <p>Aucun point chaud détecté dans ce contour autour de la date EFFIS.</p>;
  const max = Math.max(...days.map((d) => perDay[d]));
  const from = Math.max(1, days[0] - 3);
  const span = Math.max(21, (days.at(-1) ?? days[0]) + 4 - from);
  return (
    <>
      <svg viewBox={`0 0 ${span} 40`} preserveAspectRatio="none" className="h-12 w-full" aria-hidden>
        <line x1="0" y1="39.5" x2={span} y2="39.5" stroke="var(--rule)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {days.map((d) => (
          <rect
            key={d}
            x={d - from + 0.1}
            y={40 - (perDay[d] / max) * 38}
            width="0.8"
            height={(perDay[d] / max) * 38}
            fill={timelineDay !== null && timelineDay === d ? "var(--ink)" : "var(--amber)"}
          />
        ))}
      </svg>
      <p className="mt-1 text-xs leading-4">
        {formatInteger(total)} points chauds du {formatDate(dateOfTimelineDay(year, days[0]))} au{" "}
        {formatDate(dateOfTimelineDay(year, days.at(-1) ?? days[0]))}, à moins de 400 m du contour (NASA FIRMS, VIIRS).
        Ce sont des détections de chaleur, pas une surface.
      </p>
    </>
  );
}

function Fact({ fact }: { fact: StoryFact }) {
  const prefix = fact.atLeast ? "plus de " : fact.upTo ? "jusqu’à " : fact.approximate ? "environ " : "";
  const value = fact.display ?? `${prefix}${formatInteger(fact.value ?? 0)} ${fact.unit ?? ""}`.trim();
  return (
    <li className="py-1.5">
      <p className="text-xs text-ink-3">{fact.label}</p>
      <p className="text-base font-semibold text-ink [font-stretch:105%]">
        {value}
        {fact.note && <span className="ml-1.5 text-xs font-normal text-ink-2">{fact.note}</span>}
      </p>
      <p className="text-xs leading-4 text-ink-3">
        « {fact.quote} » —{" "}
        <a href={fact.url} target="_blank" rel="noreferrer" className="underline decoration-rule underline-offset-2 hover:text-ink">
          {fact.source}
        </a>
        , {formatDate(fact.dataDate)}
      </p>
    </li>
  );
}

/** Everything known about one burnt area, from EFFIS and the other sources, kept apart. */
export function FireDetail({ fire, year, onBack }: { fire: DecodedFire; year: number; onBack: () => void }) {
  const matches = useBdiffMatches();
  const annual = useBdiffAnnual();
  const events = useEvents();
  const match = matches.data?.matches[String(fire.id)];
  const bdiffPublished = annual.data ? year <= annual.data.availableUpTo : null;
  const event = events.data?.year === year ? events.data.events.find((e) => e.effis.ids.includes(fire.id) && e.facts.length > 0) : undefined;

  return (
    <article aria-labelledby="feu-titre">
      <button
        type="button"
        onClick={onBack}
        className="-ml-1 flex items-center gap-1 rounded px-1 text-sm font-medium text-moss hover:text-ink"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
          <path d="M8.5 3 4.5 7l4 4" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
        Toutes les surfaces de {year}
      </button>

      <h2 id="feu-titre" className="mt-3 text-2xl leading-tight [font-stretch:105%]">
        {fire.commune || "Commune non renseignée"}
      </h2>
      <p className="text-sm text-ink-2">{fire.province}</p>

      <p className="mt-3 text-[2.25rem] leading-none figure text-scorch">
        {formatInteger(fire.areaHa)}
        <span className="ml-1.5 text-lg font-medium text-ink [font-stretch:100%]">ha brûlés</span>
      </p>
      <p className="mt-1.5 text-sm text-ink-2">
        Première détection satellite le {formatDateTime(fire.firedate)}. EFFIS ne publie pas de date de fin.
      </p>
      <p className="mt-1 text-xs leading-4 text-ink-3">
        Surface cartographiée par EFFIS, mise à jour le {formatDate(fire.lastUpdate)} ·{" "}
        <a
          href={`https://api.effis.emergency.copernicus.eu/rest/2/burntareas/current/${fire.id}/`}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-rule underline-offset-2 hover:text-ink"
        >
          fiche EFFIS {fire.id}
        </a>
      </p>

      <div className="mt-5 space-y-4">
        {event && (
          <Block title={`Selon les sources officielles · ${event.title}`}>
            <ul className="divide-y divide-rule">
              {event.facts.map((fact) => (
                <Fact key={fact.id} fact={fact} />
              ))}
            </ul>
            {event.effis.polygons > 1 && (
              <p className="mt-1 text-xs leading-4 text-ink-3">
                EFFIS découpe ce feu en {event.effis.polygons} surfaces, {formatInteger(event.effis.areaHa)} ha au total.
              </p>
            )}
          </Block>
        )}
        <Block title="Végétation brûlée">
          <LandCover values={fire.landCover} />
          {fire.natura2000Pct !== null && fire.natura2000Pct > 0 && (
            <p className="mt-2 text-xs">{formatDecimal(fire.natura2000Pct, 0)} % de la surface en zone Natura 2000.</p>
          )}
        </Block>
        <Block title="Activité vue par satellite">
          <FireActivity fire={fire} year={year} />
        </Block>
        <Block title="Feu déclaré par les services d’incendie (BDIFF)">
          {bdiffPublished === false ? (
            <p>Pas encore publié : la BDIFF diffuse les feux jusqu’à l’année précédente.</p>
          ) : match ? (
            <>
              <p className="text-ink">
                {match.areaHa === null
                  ? "Surface non renseignée"
                  : `${formatDecimal(match.areaHa, match.areaHa < 100 ? 1 : 0)} ha déclarés`}
              </p>
              <p className="mt-0.5 text-xs leading-4">
                Départ à {match.commune} ({match.departement}), alerte le {formatLocalDateTime(match.alert)}
                {match.cause ? `, cause : ${match.cause.toLowerCase()}` : ""}. Fiche n° {match.numero}, rapprochée
                automatiquement de ce contour. Cette surface ne s’additionne pas à celle d’EFFIS.
              </p>
            </>
          ) : matches.data ? (
            <p>
              Aucune fiche ne correspond sans ambiguïté.{" "}
              <Link href="/methode" className="underline decoration-rule underline-offset-2 hover:text-ink">
                Pourquoi
              </Link>
            </p>
          ) : (
            <p className="text-ink-3">{matches.error ? "BDIFF indisponible." : "Chargement…"}</p>
          )}
        </Block>
        <p className="border-t border-rule pt-3 text-xs leading-4 text-ink-3">
          La commune est celle qu’indique EFFIS pour ce contour, pas forcément celle où le feu a démarré.
        </p>
      </div>
    </article>
  );
}
