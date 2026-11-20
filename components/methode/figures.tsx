import Image from "next/image";
import type { ReactNode } from "react";
import { AGE_CLASSES, markerRadius } from "@/components/scene/markers";
import { formatArea, formatDate, formatInteger } from "@/lib/format";

/**
 * The Méthode page's figures: each shows what a section describes, drawn from
 * the published data when the page is built (no client code).
 */
export function Figure({ caption, children, className = "" }: { caption: ReactNode; children: ReactNode; className?: string }) {
  return (
    <figure className={`m-0 overflow-hidden rounded-lg border border-rule bg-sheet ${className}`}>
      <div className="border-b border-rule bg-paper p-5">{children}</div>
      <figcaption className="px-5 py-3 text-xs leading-5 text-ink-3">{caption}</figcaption>
    </figure>
  );
}

type FireFigure = {
  commune: string;
  province: string;
  areaHa: number;
  firedate: string;
  path: string;
  viewBox: string;
  hotspots: { year: number; days: { day: number; count: number }[]; total: number };
};

export function OutlineFigure({ fire }: { fire: FireFigure }) {
  return (
    <Figure
      caption={
        <>
          Contour EFFIS du plus grand feu de 2026 : {fire.commune} ({fire.province}),{" "}
          <span className="figure text-ink-2">{formatArea(fire.areaHa)} ha</span>, première détection le{" "}
          {formatDate(fire.firedate)}.
        </>
      }
    >
      <svg viewBox={fire.viewBox} className="aspect-[4/3] w-full" role="img" aria-label={`Contour EFFIS du feu de ${fire.commune}`}>
        <path d={fire.path} fill="var(--signal)" fillOpacity={0.18} stroke="var(--signal)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" fillRule="evenodd" strokeLinejoin="round" />
      </svg>
    </Figure>
  );
}

const SCALE = [1, 100, 1_000, 10_000];

export function MarkerScaleFigure() {
  return (
    <Figure caption="Rayon du repère : 4 px + 0,22 × √ha, plafonné à 30 px. Couleur : âge de la première détection.">
      <div className="flex items-end justify-around gap-2">
        {SCALE.map((ha) => {
          const r = markerRadius(ha);
          return (
            <div key={ha} className="flex flex-col items-center gap-2">
              <svg width={2 * r + 4} height={64} viewBox={`0 0 ${2 * r + 4} 64`} aria-hidden>
                <circle cx={r + 2} cy={62 - r} r={r} fill="var(--fire-month)" stroke="var(--marker-edge)" strokeWidth={1.5} />
              </svg>
              <span className="figure text-xs text-ink-2">{formatInteger(ha)} ha</span>
            </div>
          );
        })}
      </div>
      <ul className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-ink-2">
        {AGE_CLASSES.map((c) => (
          <li key={c.token} className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-full" style={{ background: `var(${c.token})` }} />
            {c.label}
          </li>
        ))}
      </ul>
    </Figure>
  );
}

export function EffisBdiffFigure({ years }: { years: { year: number; effis: number; bdiff: number | null }[] }) {
  const max = Math.max(...years.flatMap((y) => [y.effis, y.bdiff ?? 0]));
  return (
    <Figure
      caption={
        <span className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-sm bg-signal" />
            EFFIS, feux de 30 ha ou plus
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-sm bg-ink-3" />
            BDIFF, feux déclarés
          </span>
          <span>Surfaces annuelles, jamais additionnées.</span>
        </span>
      }
    >
      <div aria-hidden className="flex h-48 items-end gap-[3px]">
        {years.map((y) => (
          <div key={y.year} className="flex h-full flex-1 items-end gap-px">
            <span className="block flex-1 rounded-t-[2px] bg-signal" style={{ height: `max(2px, ${(y.effis / max) * 100}%)` }} />
            <span
              className={`block flex-1 rounded-t-[2px] ${y.bdiff === null ? "bg-rule" : "bg-ink-3"}`}
              style={{ height: y.bdiff === null ? "2px" : `max(2px, ${(y.bdiff / max) * 100}%)` }}
            />
          </div>
        ))}
      </div>
      <div aria-hidden className="mt-2 flex justify-between border-t border-rule-strong pt-1.5 text-[11px] text-ink-3">
        <span className="figure">{years[0].year}</span>
        <span className="figure">{years.at(-1)?.year}</span>
      </div>
    </Figure>
  );
}

export function MatchFigure({ linked, total }: { linked: number; total: number }) {
  return (
    <Figure caption="Contours EFFIS de 2006 à l’année précédente reliés sans ambiguïté à une fiche BDIFF.">
      <p className="figure text-5xl text-ink">{formatInteger(linked)}</p>
      <p className="mt-1 text-sm text-ink-2">
        contours rapprochés sur <span className="figure">{formatInteger(total)}</span>
      </p>
      <div aria-hidden className="mt-4 h-2 overflow-hidden rounded-full bg-rule">
        <span className="block h-full rounded-full bg-signal" style={{ width: `${(linked / total) * 100}%` }} />
      </div>
    </Figure>
  );
}

export function HotspotsFigure({ fire }: { fire: FireFigure }) {
  const { days, total, year } = fire.hotspots;
  if (days.length === 0) return null;
  const max = Math.max(...days.map((d) => d.count));
  const from = days[0].day - 2;
  const span = Math.max(21, days.at(-1)!.day + 3 - from);
  const dateOf = (day: number) => new Date(Date.UTC(year, 0, day, 12)).toISOString();
  return (
    <Figure
      caption={
        <>
          <span className="figure text-ink-2">{formatInteger(total)}</span> points chauds VIIRS à moins de 400 m du contour
          de {fire.commune}, jour par jour, du {formatDate(dateOf(days[0].day))} au {formatDate(dateOf(days.at(-1)!.day))}.
        </>
      }
    >
      <svg viewBox={`0 0 ${span} 40`} preserveAspectRatio="none" className="h-36 w-full" aria-hidden>
        <line x1="0" y1="39.5" x2={span} y2="39.5" stroke="var(--rule-strong)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {days.map((d) => (
          <rect key={d.day} x={d.day - from + 0.12} y={40 - (d.count / max) * 38} width="0.76" height={(d.count / max) * 38} fill="var(--amber)" />
        ))}
      </svg>
    </Figure>
  );
}

/** The same stretch of Gironde in the two IGN base maps, cropped from the site's whole-France images. */
export function BasemapFigure() {
  const crop = "origin-[24%_62%] scale-[5]";
  return (
    <Figure caption="Plan IGN et photographies aériennes sur la même zone (Gironde). En vue rapprochée, la carte charge les tuiles nettes de la Géoplateforme.">
      <div className="grid grid-cols-2 gap-3">
        {[
          { src: "/data/fonds/plan-france.jpg", label: "Plan IGN" },
          { src: "/data/fonds/ortho-france.jpg", label: "Photographies aériennes" },
        ].map((image) => (
          <div key={image.src}>
            <div className="relative aspect-square overflow-hidden rounded-md border border-rule">
              <Image src={image.src} alt="" fill sizes="1600px" className={`object-cover ${crop}`} />
            </div>
            <p className="mt-1.5 text-xs text-ink-2">{image.label}</p>
          </div>
        ))}
      </div>
    </Figure>
  );
}
