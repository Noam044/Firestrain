"use client";

import { useEffect } from "react";
import { useDepartements2D } from "@/lib/data/queries";
import { useMapStore } from "@/lib/store";

/** Fallback without WebGL: department shapes as SVG, same frame as the 3D scene. */
export default function Map2D({ reason }: { reason: string }) {
  const { data, error } = useDepartements2D();
  const setRenderMode = useMapStore((state) => state.setRenderMode);
  useEffect(() => {
    setRenderMode("2d");
    return () => setRenderMode(null);
  }, [setRenderMode]);
  return (
    <figure className="absolute inset-0 m-0 flex flex-col">
      <div className="relative min-h-0 flex-1 px-4 pb-2 pt-24 md:px-10 md:pt-10">
        {data ? (
          <svg
            viewBox={data.viewBox.join(" ")}
            className="h-full w-full"
            role="img"
            aria-labelledby="carte-2d-titre"
          >
            <title id="carte-2d-titre">Départements de France métropolitaine (carte 2D)</title>
            {data.features.map((feature) => (
              <path
                key={feature.code}
                d={feature.d}
                fill="var(--ash-800)"
                stroke="var(--ash-400)"
                strokeWidth={0.75}
                fillRule="evenodd"
                vectorEffect="non-scaling-stroke"
              >
                <title>{`${feature.nom} (${feature.code})`}</title>
              </path>
            ))}
          </svg>
        ) : (
          <p role="status" className="grid h-full place-items-center font-mono text-xs text-ash-400">
            {error ? "Les limites départementales n’ont pas pu être chargées." : "Chargement de la carte 2D…"}
          </p>
        )}
      </div>
      <figcaption className="px-4 pb-28 font-mono text-[11px] text-bone-300 md:px-10">{reason}</figcaption>
    </figure>
  );
}
