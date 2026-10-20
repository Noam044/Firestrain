"use client";

import { useMemo } from "react";
import { formatDecimal, formatInteger } from "@/lib/format";
import { useEffisYear } from "@/lib/data/queries";
import type { Story } from "@/lib/data/schemas";
import { ringsBBox } from "@/lib/geo/polygon";
import { decodeRing } from "@/lib/geo/rings";
import { EFFIS, IGN_ADMIN, SourceTag } from "@/components/ui/SourceTag";

const pathOf = (rings: readonly Float32Array[], dx = 0, dz = 0) =>
  rings
    .map((ring) => {
      const points: string[] = [];
      for (let k = 0; k < ring.length; k += 2) points.push(`${(ring[k] + dx).toFixed(2)} ${(ring[k + 1] + dz).toFixed(2)}`);
      return `M${points.join("L")}Z`;
    })
    .join("");

/**
 * The Gironde fire and the commune of Paris drawn in the same Lambert-93 frame
 * at the same scale: Paris is only translated, never resized.
 */
export function ScaleComparison({ story, eventId, retrievedAt }: { story: Story; eventId: string; retrievedAt?: string }) {
  const event = story.events.find((e) => e.id === eventId);
  const fires = useEffisYear(story.year).data?.fires;
  const shapes = useMemo(() => {
    if (!event || !fires) return null;
    const ids = new Set(event.effis.ids);
    const fireRings = fires.filter((fire) => ids.has(fire.id)).flatMap((fire) => fire.rings);
    const parisRings = story.paris.rings.map(decodeRing);
    const [fx0, fz0, fx1, fz1] = ringsBBox(fireRings);
    const [px0, pz0, px1, pz1] = ringsBBox(parisRings);
    // Paris centred on the fire's bounding box.
    const dx = (fx0 + fx1) / 2 - (px0 + px1) / 2;
    const dz = (fz0 + fz1) / 2 - (pz0 + pz1) / 2;
    const pad = 3;
    return {
      fire: pathOf(fireRings),
      paris: pathOf(parisRings, dx, dz),
      viewBox: [fx0 - pad, fz0 - pad, fx1 - fx0 + 2 * pad, fz1 - fz0 + 2 * pad + 4] as const,
    };
  }, [event, fires, story.paris.rings]);
  if (!event) return null;

  const ratio = event.effis.areaHa / story.paris.areaHa;
  const scaleGap = Math.abs(story.paris.scaleFactorParis / story.paris.scaleFactorGironde - 1) * 100;
  return (
    <figure className="m-0">
      {shapes ? (
        <svg
          viewBox={shapes.viewBox.join(" ")}
          className="block h-auto w-full max-w-[22rem]"
          role="img"
          aria-label={`Contour du feu de Gironde (${formatInteger(event.effis.areaHa)} ha selon EFFIS) et commune de Paris (${formatInteger(story.paris.areaHa)} ha), à la même échelle.`}
        >
          <path d={shapes.fire} fill="var(--ash-600)" fillRule="evenodd" />
          <path d={shapes.paris} fill="none" stroke="var(--bone-100)" strokeWidth={0.18} strokeDasharray="0.6 0.4" fillRule="evenodd" />
          {/* 10 km scale bar along the bottom edge. */}
          <g transform={`translate(${shapes.viewBox[0] + 3},${shapes.viewBox[1] + shapes.viewBox[3] - 2})`}>
            <line x1={0} x2={10} stroke="var(--bone-100)" strokeWidth={0.25} />
            <line x1={0} x2={0} y1={-0.6} y2={0.6} stroke="var(--bone-100)" strokeWidth={0.25} />
            <line x1={10} x2={10} y1={-0.6} y2={0.6} stroke="var(--bone-100)" strokeWidth={0.25} />
            <text x={11} y={0.5} fontSize={1.4} fill="var(--bone-300)" className="font-mono">
              10 km
            </text>
          </g>
        </svg>
      ) : (
        <p className="font-mono text-xs text-ash-400">Chargement des contours…</p>
      )}
      <figcaption className="mt-3 text-sm leading-6 text-bone-300">
        <span className="inline-block h-2.5 w-4 bg-ash-600 align-middle" aria-hidden /> Contour EFFIS
        du feu ({formatInteger(event.effis.areaHa)} ha) ;{" "}
        <span className="inline-block h-0 w-4 border-t border-dashed border-bone-100 align-middle" aria-hidden /> commune
        de Paris ({formatInteger(story.paris.areaHa)} ha, bois de Boulogne et de Vincennes compris), déplacée sans
        changer d’échelle. Le feu couvre {formatDecimal(ratio, 1)} fois sa surface. Même projection (Lambert-93) : l’écart
        d’échelle entre les deux lieux est de {formatDecimal(scaleGap, 2)} %.
        <span className="mt-1 flex flex-col gap-2">
          <SourceTag
            source={{
              ...EFFIS,
              url: "https://forest-fire.emergency.copernicus.eu/",
              dataDate: story.effisDataDate,
              note: "Somme des surfaces publiées par EFFIS pour les polygones du feu (règle de regroupement : page Méthode).",
            }}
          />
          <SourceTag source={{ ...IGN_ADMIN, retrievedAt, note: story.paris.source }} />
        </span>
      </figcaption>
    </figure>
  );
}
