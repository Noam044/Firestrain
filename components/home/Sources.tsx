"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { formatArea, formatDate, formatInteger } from "@/lib/format";
import { useLiveSummary, type LiveFire } from "./live";

/** The real outline of a fire, fitted to its box. */
function Outline({ fire }: { fire: LiveFire }) {
  const shape = useMemo(() => {
    const [x0, z0, x1, z1] = fire.bbox;
    const pad = Math.max(x1 - x0, z1 - z0) * 0.08;
    const d = fire.rings
      .map((ring) => {
        const points: string[] = [];
        for (let k = 0; k < ring.length; k += 2) points.push(`${ring[k].toFixed(3)} ${ring[k + 1].toFixed(3)}`);
        return `M${points.join("L")}Z`;
      })
      .join("");
    return { d, viewBox: [x0 - pad, z0 - pad, x1 - x0 + 2 * pad, z1 - z0 + 2 * pad].join(" ") };
  }, [fire]);
  return (
    <svg viewBox={shape.viewBox} className="h-full w-full" role="img" aria-label={`Contour EFFIS du feu de ${fire.commune}`}>
      <path d={shape.d} fill="var(--signal)" fillOpacity={0.18} stroke="var(--signal)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" fillRule="evenodd" strokeLinejoin="round" />
    </svg>
  );
}

/** Where the readings come from: three sources, each shown by what it actually measures. */
export function Sources() {
  const { summary, hotspots } = useLiveSummary();
  const largest = summary?.largest;
  return (
    <section aria-labelledby="sources-titre" className="mx-auto max-w-[1320px] px-5 py-16 md:px-8 lg:py-24">
      <h2 id="sources-titre" className="max-w-[22ch] text-3xl leading-tight sm:text-4xl">
        D’où viennent les données
      </h2>
      <div className="mt-10 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:grid-rows-2">
        <article className="flex flex-col overflow-hidden rounded-lg border border-rule bg-sheet lg:row-span-2">
          <div className="relative aspect-[4/3] border-b border-rule bg-paper p-6 sm:p-10">
            {largest ? <Outline fire={largest} /> : <div className="size-full animate-pulse rounded-md bg-raised" />}
            {largest && (
              <p className="absolute bottom-3 left-4 text-xs text-ink-3">
                <span className="font-semibold text-ink-2">{largest.commune}</span>, {largest.province} ·{" "}
                <span className="figure">{formatArea(largest.areaHa)} ha</span>, détecté le {formatDate(largest.firedate)}
              </p>
            )}
          </div>
          <div className="p-6 sm:p-8">
            <p className="label">EFFIS, programme Copernicus</p>
            <h3 className="mt-2 text-2xl">Le contour de chaque feu</h3>
            <p className="mt-3 max-w-[52ch] leading-7 text-ink-2">
              Le service européen cartographie les surfaces brûlées sur images satellite et publie leur contour, leur
              date de détection et la végétation touchée. Ci-dessus, le plus grand feu des douze derniers mois.
            </p>
          </div>
        </article>

        <article className="relative overflow-hidden rounded-lg border border-rule bg-sheet p-6 sm:p-8">
          <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 size-48 rounded-full border-[10px] border-amber/25" />
          <div aria-hidden className="pointer-events-none absolute -right-2 top-2 size-24 rounded-full border-[6px] border-amber/40" />
          <p className="label">NASA FIRMS, satellites VIIRS</p>
          <p className="figure mt-4 text-5xl text-ink">{hotspots ? formatInteger(hotspots.count) : "–"}</p>
          <h3 className="mt-1 text-xl">points chauds ces 72 dernières heures</h3>
          <p className="mt-3 max-w-[46ch] leading-7 text-ink-2">
            Plusieurs passages par jour repèrent la chaleur des feux actifs. Un point chaud signale un feu, il n’en mesure
            pas la surface.
          </p>
        </article>

        <article className="relative isolate flex flex-col justify-end overflow-hidden rounded-lg border border-rule p-6 sm:p-8">
          {/* The Alps, cropped from the same IGN mosaic as the opening (optimised, loaded when near). */}
          <Image
            src="/data/fonds/ortho-france.jpg"
            alt=""
            fill
            sizes="1600px"
            className="-z-10 origin-[78%_58%] scale-[4.2] object-cover [filter:grayscale(1)_brightness(0.55)_contrast(1.25)] light:[filter:grayscale(1)_brightness(1.1)_contrast(0.9)]"
          />
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-paper via-paper/70 to-transparent" />
          <p className="label">IGN, Géoplateforme</p>
          <h3 className="mt-2 text-xl">Le relief, en vraie grandeur</h3>
          <p className="mt-3 max-w-[46ch] leading-7 text-ink-2">
            Altitudes BD ALTI, plan et photographies aériennes, dans la projection officielle de la France.
          </p>
        </article>
      </div>
      <p className="mt-6 text-sm text-ink-3">
        Les surfaces déclarées par les services d’incendie (BDIFF) restent à part, feu par feu, sans jamais s’additionner
        à celles d’EFFIS.{" "}
        <Link href="/methode" className="font-semibold text-ink-2 underline decoration-rule-strong underline-offset-4 hover:text-ink">
          Lire la méthode
        </Link>
      </p>
    </section>
  );
}
