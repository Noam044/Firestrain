"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { formatArea, formatDate, formatInteger } from "@/lib/format";
import { SpotlightCard } from "@/components/magic/spotlight-card";
import { Reveal } from "@/components/motion/reveal";
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

/** Where the readings come from: three public sources, each shown by what it measures. */
export function Sources() {
  const { summary, hotspots } = useLiveSummary();
  const largest = summary?.largest;
  return (
    <section aria-labelledby="sources-titre" className="mx-auto max-w-[1320px] px-5 py-16 md:px-8 lg:py-24">
      <Reveal>
        <h2 id="sources-titre" className="text-3xl leading-tight sm:text-4xl">
          Sources des données
        </h2>
      </Reveal>
      <div className="mt-10 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:grid-rows-2">
        <Reveal className="lg:row-span-2">
          <SpotlightCard className="flex h-full flex-col overflow-hidden rounded-lg border border-rule bg-sheet">
            <div className="relative aspect-[4/3] border-b border-rule bg-paper p-6 sm:p-10">
              {largest ? <Outline fire={largest} /> : <div className="size-full animate-pulse rounded-md bg-raised" />}
              {largest && (
                <p className="absolute bottom-3 left-4 text-xs text-ink-3">
                  {largest.commune} ({largest.province}), <span className="figure">{formatArea(largest.areaHa)} ha</span>, détecté le{" "}
                  {formatDate(largest.firedate)}
                </p>
              )}
            </div>
            <div className="p-6 sm:p-8">
              <h3 className="text-2xl">EFFIS (Copernicus)</h3>
              <p className="mt-3 max-w-[52ch] leading-7 text-ink-2">
                Le système européen d’information sur les feux de forêt cartographie les surfaces brûlées sur images
                satellite. Il publie le contour de chaque feu, sa date de détection et la végétation touchée. L’image
                montre le plus grand feu des douze derniers mois.
              </p>
            </div>
          </SpotlightCard>
        </Reveal>

        <Reveal delay={0.08}>
          <SpotlightCard className="h-full overflow-hidden rounded-lg border border-rule bg-sheet p-6 sm:p-8">
            <h3 className="text-xl">NASA FIRMS</h3>
            <p className="figure mt-4 text-5xl text-ink">{hotspots ? formatInteger(hotspots.count) : "–"}</p>
            <p className="text-sm text-ink-3">points chauds sur les 72 dernières heures</p>
            <p className="mt-4 max-w-[46ch] leading-7 text-ink-2">
              Les satellites VIIRS repèrent la chaleur des feux actifs plusieurs fois par jour. Ces détections localisent
              un feu sans mesurer sa surface.
            </p>
          </SpotlightCard>
        </Reveal>

        <Reveal delay={0.14}>
          <SpotlightCard className="relative isolate flex h-full min-h-56 flex-col justify-end overflow-hidden rounded-lg border border-rule p-6 sm:p-8">
            {/* The Alps, cropped from the same IGN mosaic as the opening (optimised, loaded when near). */}
            <Image
              src="/data/fonds/ortho-france.jpg"
              alt=""
              fill
              sizes="1600px"
              className="-z-10 origin-[78%_58%] scale-[4.2] object-cover [filter:grayscale(1)_brightness(0.55)_contrast(1.25)] light:[filter:grayscale(1)_brightness(1.1)_contrast(0.9)]"
            />
            <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-paper via-paper/70 to-transparent" />
            <h3 className="text-xl">IGN</h3>
            <p className="mt-3 max-w-[46ch] leading-7 text-ink-2">
              Altitudes de la BD ALTI, Plan IGN et photographies aériennes, en Lambert-93.
            </p>
          </SpotlightCard>
        </Reveal>
      </div>
      <p className="mt-6 text-sm text-ink-3">
        Les surfaces déclarées par les services d’incendie (BDIFF) apparaissent dans la fiche de chaque feu et ne
        s’ajoutent jamais à celles d’EFFIS.{" "}
        <Link href="/methode" className="link-draw font-semibold text-ink-2">
          Lire la méthode
        </Link>
      </p>
    </section>
  );
}
