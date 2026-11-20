"use client";

import { CaretLeft } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import {
  formatAge,
  formatArea,
  formatDate,
  formatDateTime,
  formatDecimal,
  formatInteger,
  formatLocalDateTime,
} from "@/lib/format";
import { parisDayOfYear, parisYear, type SpanFire } from "@/lib/data/fires";
import { useBdiffAnnual, useBdiffMatches, useDetections, useFirmsIndex } from "@/lib/data/queries";
import { bboxContains, pointInRings } from "@/lib/geo/polygon";
import { LAND_COVER_KEYS } from "@/lib/data/schemas";
import { LAND_COVER_LABELS } from "@/lib/data/land-cover";
import { AGE_CLASSES, ageClass } from "@/components/scene/markers";

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

function LandCover({ values }: { values: SpanFire["landCover"] }) {
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
            <span className="figure text-ink">{formatDecimal(row.value, 0)} %</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Day-by-day FIRMS detections inside the outline, from the site's yearly files: hotspots, never an area. */
function FireActivity({ fire }: { fire: SpanFire }) {
  const year = parisYear(fire.firedate);
  const index = useFirmsIndex();
  const entry = index.data?.years.find((y) => y.year === year);
  const detections = useDetections(year);
  const perDay = useMemo(() => {
    const data = detections.data;
    if (!data) return null;
    const first = parisDayOfYear(fire.firedate) - BEFORE_DAYS;
    const last = parisDayOfYear(fire.firedate) + AFTER_DAYS;
    const counts = new Map<number, number>();
    const [x0, z0, x1, z1] = fire.bbox;
    const box: [number, number, number, number] = [x0 - NEAR_KM, z0 - NEAR_KM, x1 + NEAR_KM, z1 + NEAR_KM];
    for (let k = 0; k < data.count; k++) {
      const x = data.positions[2 * k];
      const z = data.positions[2 * k + 1];
      if (data.day[k] < first || data.day[k] > last || !bboxContains(box, x, z)) continue;
      const near = [[0, 0], [NEAR_KM, 0], [-NEAR_KM, 0], [0, NEAR_KM], [0, -NEAR_KM]].some(([dx, dz]) =>
        pointInRings(x + dx, z + dz, fire.rings),
      );
      if (near) counts.set(data.day[k], (counts.get(data.day[k]) ?? 0) + 1);
    }
    return counts;
  }, [detections.data, fire]);

  if (index.isSuccess && !entry) return <p>Pas de détections VIIRS avant 2012.</p>;
  if (entry && entry.lastDate < fire.firedate.slice(0, 10)) {
    return <p>Les détections publiées par le site s’arrêtent au {formatDate(`${entry.lastDate}T12:00:00Z`)}.</p>;
  }
  if (!perDay) return <p className="text-ink-3">Chargement…</p>;
  const days = [...perDay.keys()].sort((a, b) => a - b);
  const total = days.reduce((sum, d) => sum + (perDay.get(d) ?? 0), 0);
  if (total === 0) return <p>Aucun point chaud détecté dans ce contour autour de la date EFFIS.</p>;
  const max = Math.max(...perDay.values());
  const from = days[0] - 3;
  const span = Math.max(21, (days.at(-1) ?? days[0]) + 4 - from);
  const dateOf = (day: number) => new Date(Date.UTC(year, 0, day, 12)).toISOString();
  return (
    <>
      <svg viewBox={`0 0 ${span} 40`} preserveAspectRatio="none" className="h-12 w-full" aria-hidden>
        <line x1="0" y1="39.5" x2={span} y2="39.5" stroke="var(--rule-strong)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {days.map((d) => (
          <rect key={d} x={d - from + 0.1} y={40 - ((perDay.get(d) ?? 0) / max) * 38} width="0.8" height={((perDay.get(d) ?? 0) / max) * 38} fill="var(--amber)" />
        ))}
      </svg>
      <p className="mt-1 text-xs leading-4">
        {formatInteger(total)} points chauds du {formatDate(dateOf(days[0]))} au {formatDate(dateOf(days.at(-1) ?? days[0]))}, à moins de
        400 m du contour (NASA FIRMS, VIIRS). Ce sont des détections de chaleur, pas une surface.
      </p>
    </>
  );
}

/** One fire: where, when, how large, what burnt — each source kept apart. */
export function FireCard({ fire, onBack }: { fire: SpanFire; onBack: () => void }) {
  const matches = useBdiffMatches();
  const annual = useBdiffAnnual();
  const match = matches.data?.matches[String(fire.id)];
  const bdiffPublished = annual.data ? parisYear(fire.firedate) <= annual.data.availableUpTo : null;
  const age = fire.ageDays;
  const ageToken = AGE_CLASSES[ageClass(age)].token;

  return (
    <article aria-labelledby="feu-titre" className="px-4 pb-6 pt-3 lg:px-5">
      <button
        type="button"
        onClick={onBack}
        className="-ml-1 flex items-center gap-1 rounded px-1 py-0.5 text-sm font-bold text-ink-2 hover:text-ink"
      >
        <CaretLeft size={14} weight="bold" aria-hidden />
        Tous les feux
      </button>

      <div className="mt-3 flex items-start gap-2.5">
        <span aria-hidden className="mt-2 size-3 shrink-0 rounded-full" style={{ background: `var(${ageToken})` }} />
        <div className="min-w-0">
          <h2 id="feu-titre" className="text-2xl leading-tight">
            {fire.commune || "Commune non renseignée"}
          </h2>
          <p className="text-sm text-ink-2">{fire.province}</p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-rule bg-rule">
        <div className="bg-sheet px-3 py-2">
          <dt className="label">Surface brûlée</dt>
          <dd className="figure text-2xl leading-8 text-ink">
            {formatArea(fire.areaHa)}
            <span className="ml-1 text-sm text-ink-3">ha</span>
          </dd>
        </div>
        <div className="bg-sheet px-3 py-2">
          <dt className="label">Détecté</dt>
          <dd className="text-base font-bold leading-8 text-ink first-letter:uppercase">{age !== null && age <= 31 ? formatAge(age) : formatDate(fire.firedate)}</dd>
        </div>
        <div className="col-span-2 bg-sheet px-3 py-2 text-xs leading-5 text-ink-2">
          <p>
            Première détection satellite : <span className="font-bold text-ink">{formatDateTime(fire.firedate)}</span>
          </p>
          <p>
            Contour mis à jour par EFFIS : <span className="font-bold text-ink">{formatDateTime(fire.lastUpdate)}</span>
          </p>
          <p className="text-ink-3">EFFIS ne publie pas de date de fin ; un feu peut encore s’étendre après sa première détection.</p>
        </div>
      </dl>

      <div className="mt-5 space-y-4">
        <Block title="Végétation brûlée">
          <LandCover values={fire.landCover} />
          {fire.natura2000Pct !== null && fire.natura2000Pct > 0 && (
            <p className="mt-2 text-xs">{formatDecimal(fire.natura2000Pct, 0)} % de la surface en zone Natura 2000.</p>
          )}
        </Block>
        <Block title="Points chauds vus par satellite">
          <FireActivity fire={fire} />
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
              <Link href="/methode" className="text-link underline underline-offset-2">
                Pourquoi
              </Link>
            </p>
          ) : (
            <p className="text-ink-3">{matches.error ? "BDIFF indisponible." : "Chargement…"}</p>
          )}
        </Block>
        <p className="border-t border-rule pt-3 text-xs leading-4 text-ink-3">
          Commune indiquée par EFFIS pour ce contour, pas forcément celle du départ du feu ·{" "}
          <a
            href={`https://api.effis.emergency.copernicus.eu/rest/2/burntareas/current/${fire.id}/`}
            target="_blank"
            rel="noreferrer"
            className="text-link underline underline-offset-2"
          >
            fiche EFFIS {fire.id}
          </a>
        </p>
      </div>
    </article>
  );
}
