"use client";

import { useMapStore } from "@/lib/store";
import { CursorReadout } from "./CursorReadout";
import { NorthArrow } from "./NorthArrow";
import { ScaleBar } from "./ScaleBar";

/** North, scale and pointer readout — measured on the 3D view, so absent in 2D. */
export function MapFurniture() {
  const renderMode = useMapStore((state) => state.renderMode);
  if (renderMode !== "3d") return null;
  return (
    <div className="pointer-events-none absolute inset-x-4 bottom-4 flex items-end justify-between gap-4 md:inset-x-6">
      <div className="flex items-end gap-4 border border-ash-800 bg-ash-950 px-3 py-2">
        <NorthArrow />
        <ScaleBar />
      </div>
      <CursorReadout />
    </div>
  );
}
