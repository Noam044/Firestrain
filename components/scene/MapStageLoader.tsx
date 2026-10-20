"use client";

import dynamic from "next/dynamic";
import type { MapMode } from "@/lib/store";

// The map depends on window, WebGL and workers: it is never prerendered, and
// the three.js bundle is only fetched once the page is interactive.
const MapStage = dynamic(() => import("./MapStage"), { ssr: false });

export function MapStageLoader({ mode }: { mode: MapMode }) {
  return <MapStage mode={mode} />;
}
