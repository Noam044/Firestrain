import Link from "next/link";
import { Figure } from "@/components/methode/figures";
import { formatArea, formatDate, formatInteger } from "@/lib/format";
import type { Departement } from "@/lib/server/departements";

/**
 * The département page's pictures, drawn when the site is built (no client
 * code): where the fires were, year by year, and the largest ones.
 */

/** Marker radius in map kilometres: grows with the square root of the area. */
const dotRadius = (areaHa: number) => Math.min(6, 0.5 + 0.09 * Math.sqrt(areaHa));

export function WhereFigure({ departement, last }: { departement: Departement; last: number }) {
  const { viewBox, path, dots, nom } = departement;
  return (
    <Figure
      caption={
        dots.length > 0 ? (
          <>
            Chaque disque est un feu cartographié par EFFIS, à la taille de sa surface.{" "}
            <span className="text-ink-2">En orange vif, ceux de {last}.</span>
          </>
        ) : (
          "Aucun feu cartographié par EFFIS dans ce département."
        )
      }
    >
      <svg viewBox={viewBox.join(" ")} className="aspect-square w-full" role="img" aria-label={`Feux cartographiés, ${nom}`}>
        <path d={path} fill="var(--sheet)" stroke="var(--rule-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {dots.map((dot, k) => (
          <circle
            key={k}
            cx={dot.x}
            cy={dot.y}
            r={dotRadius(dot.areaHa)}
            fill={dot.year === last ? "var(--signal)" : "var(--fire-old)"}
            fillOpacity={dot.year === last ? 0.9 : 0.55}
            stroke="var(--marker-edge)"
            strokeWidth={0.6}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </Figure>
  );
}

/** One column per year, each reopening that year on the map. */
export function YearsChart({ departement }: { departement: Departement }) {
  const { years } = departement;
  const max = Math.max(1, ...years.map((y) => y.areaHa));
  const peak = years.reduce((best, y) => (y.areaHa > best.areaHa ? y : best));
  return (
    <div>
      <ol className="grid h-40 items-end gap-1" style={{ gridTemplateColumns: `repeat(${years.length}, minmax(0, 1fr))` }}>
        {years.map((y) => (
          <li key={y.year} className="h-full">
            <Link
              href={`/carte?annee=${y.year}`}
              aria-label={`${y.year} : ${formatInteger(y.areaHa)} ha, ${formatInteger(y.fires)} feux. Ouvrir cette année sur la carte`}
              title={`${y.year} : ${formatInteger(y.areaHa)} ha`}
              className="group flex h-full flex-col justify-end"
            >
              <span
                className={`block origin-bottom rounded-t-[2px] transition-[transform,background-color] duration-300 ease-out group-hover:scale-y-[1.04] ${
                  y === peak && y.areaHa > 0 ? "bg-signal" : "bg-rule-strong group-hover:bg-ink-3"
                }`}
                style={{ height: y.areaHa > 0 ? `max(3px, ${(y.areaHa / max) * 100}%)` : "1px" }}
              />
            </Link>
          </li>
        ))}
      </ol>
      <div aria-hidden className="mt-2 flex justify-between border-t border-rule-strong pt-1.5 text-xs text-ink-3">
        <span className="figure">{years[0].year}</span>
        <span className="figure">{years.at(-1)!.year}</span>
      </div>
    </div>
  );
}

export function LargestFires({ departement }: { departement: Departement }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-rule-strong text-left">
          <th scope="col" className="label py-2 font-normal">
            Commune
          </th>
          <th scope="col" className="label py-2 font-normal">
            Détecté le
          </th>
          <th scope="col" className="label py-2 text-right font-normal">
            Surface
          </th>
        </tr>
      </thead>
      <tbody>
        {departement.largest.map((fire) => (
          <tr key={fire.id} className="border-b border-rule">
            <td className="py-2 pr-3">
              <Link href={`/carte?annee=${fire.year}&fire=${fire.id}`} className="link-draw font-bold text-ink">
                {fire.commune || "Commune non renseignée"}
              </Link>
            </td>
            <td className="tabular py-2 pr-3 text-ink-2">{formatDate(fire.firedate)}</td>
            <td className="figure py-2 text-right text-ink">
              {formatArea(fire.areaHa)}
              <span className="ml-1 text-xs text-ink-3">ha</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
