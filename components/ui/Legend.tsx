"use client";

import { useState } from "react";
import { useMapStore } from "@/lib/store";

function LineSwatch({ color, width }: { color: string; width: number }) {
  return (
    <svg width="24" height="8" aria-hidden className="shrink-0">
      <line x1="0" y1="4" x2="24" y2="4" stroke={color} strokeWidth={width} />
    </svg>
  );
}

/** Fixed legend; collapsible on small screens so the map stays visible. */
export function Legend() {
  const exaggeration = useMapStore((state) => state.exaggeration);
  const flat = useMapStore((state) => state.renderMode === "2d");
  const [open, setOpen] = useState(false);
  return (
    <section aria-labelledby="legende-titre" className="w-64 max-w-[calc(100vw-2rem)] border border-ash-800 bg-ash-950 p-3">
      <h2 id="legende-titre" className="label-caps text-bone-100">
        <span className="hidden md:inline">Légende</span>
        <button
          type="button"
          className="label-caps flex w-full items-center justify-between md:hidden"
          aria-expanded={open}
          aria-controls="legende-contenu"
          onClick={() => setOpen((value) => !value)}
        >
          Légende
          <span aria-hidden className="font-mono text-bone-300">
            {open ? "−" : "+"}
          </span>
        </button>
      </h2>
      <ul
        id="legende-contenu"
        className={`${open ? "block" : "hidden"} mt-2.5 space-y-2 text-xs leading-4 text-bone-300 md:block`}
      >
        {flat ? (
          <>
            <li className="flex items-center gap-2">
              <LineSwatch color="var(--ash-400)" width={0.8} />
              Limite de département
            </li>
            <li className="font-mono text-[11px] text-ash-400">Rendu 2D, sans relief</li>
          </>
        ) : (
          <>
            <li className="flex items-center gap-2">
              <span aria-hidden className="flex h-3 w-6 shrink-0">
                <span className="flex-1 bg-ash-900" />
                <span className="flex-1 bg-ash-800" />
                <span className="flex-1 bg-ash-400" />
              </span>
              Relief ombré, éclairage nord-ouest
            </li>
            <li className="pl-8 font-mono text-[11px] text-ash-400">
              Exagération verticale ×{exaggeration}
            </li>
            <li className="flex items-center gap-2">
              <LineSwatch color="var(--bone-300)" width={1.2} />
              Côte et frontière nationale
            </li>
            <li className="flex items-center gap-2">
              <LineSwatch color="var(--ash-400)" width={0.8} />
              Limite de département
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden className="h-3 w-6 shrink-0 border border-ash-700 bg-sea" />
              Sans altitude dans la BD ALTI (mer, lagunes)
            </li>
          </>
        )}
      </ul>
    </section>
  );
}
