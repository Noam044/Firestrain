"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { useTheme } from "next-themes";
import type { CameraControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import * as THREE from "three";
import {
  useBorders,
  useEffisYears,
  useFranceOutline,
  useNeighbours,
  useRecentDetections,
  useTerrain,
  type DemResolution,
  type TerrainData,
} from "@/lib/data/queries";
import type { DecodedFire } from "@/lib/data/fires";
import { useSpanFires } from "@/lib/data/span-fires";
import { recentToColumns } from "@/lib/data/firms-recent";
import { rasterizeLandMask, type LandMask } from "@/lib/data/land-mask";
import type { Borders as BordersData } from "@/lib/data/schemas";
import { spanMonthRange } from "@/lib/span";
import { FIRST_YEAR, useMapStore } from "@/lib/store";
import { Borders } from "./Borders";
import { useBurnMask } from "./BurnMask";
import { SelectedFire } from "./SelectedFire";
import { FireMarkers } from "./FireMarkers";
import { FirePoints } from "./FirePoints";
import { Neighbours } from "./Neighbours";
import { useImagery } from "./Imagery";
import { CameraRig, resetView } from "./CameraRig";
import { MapProbe } from "./MapProbe";
import { MapStatus } from "./MapStatus";
import { Terrain, useTerrainTextures } from "./Terrain";

type Detail = { dem: DemResolution; meshKm: number };

/** Lighter data and mesh on small, touch or low-core devices. */
function chooseDetail(): Detail {
  const coarse =
    window.matchMedia("(max-width: 767px), (pointer: coarse)").matches ||
    (navigator.hardwareConcurrency ?? 8) <= 4;
  return coarse ? { dem: 1000, meshKm: 2 } : { dem: 500, meshKm: 1 };
}

const KEYBOARD_HELP =
  "Carte en relief de la France métropolitaine. Flèches : se déplacer. Plus et moins : zoomer. " +
  "Maj + flèches : pivoter et incliner. Zéro : vue d’ensemble.";

export default function MapCanvas() {
  const [detail] = useState(chooseDetail);
  const terrain = useTerrain(detail.dem);
  const outline = useFranceOutline();
  const borders = useBorders();
  const controlsRef = useRef<CameraControls | null>(null);
  const { resolvedTheme } = useTheme();

  const mask = useMemo(
    () =>
      terrain.data && outline.data
        ? rasterizeLandMask(outline.data, terrain.data.meta.width, terrain.data.meta.height)
        : null,
    [terrain.data, outline.data],
  );
  const error = terrain.error ?? outline.error ?? borders.error;
  const ready = terrain.data && mask && borders.data ? { terrain: terrain.data, mask, borders: borders.data } : null;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const step = controls.distance * 0.08;
    const azimuth = controls.azimuthAngle;
    const forward = new THREE.Vector3(-Math.sin(azimuth), 0, -Math.cos(azimuth));
    const right = new THREE.Vector3(Math.cos(azimuth), 0, -Math.sin(azimuth));
    const move = (direction: THREE.Vector3, amount: number) => {
      const target = controls.getTarget(new THREE.Vector3()).addScaledVector(direction, amount);
      void controls.moveTo(target.x, target.y, target.z, true);
    };
    const turn = THREE.MathUtils.degToRad(15);
    const tilt = THREE.MathUtils.degToRad(8);
    const actions: Record<string, () => void> = event.shiftKey
      ? {
          ArrowLeft: () => void controls.rotate(turn, 0, true),
          ArrowRight: () => void controls.rotate(-turn, 0, true),
          ArrowUp: () => void controls.rotate(0, -tilt, true),
          ArrowDown: () => void controls.rotate(0, tilt, true),
        }
      : {
          ArrowUp: () => move(forward, step),
          ArrowDown: () => move(forward, -step),
          ArrowLeft: () => move(right, -step),
          ArrowRight: () => move(right, step),
          "+": () => void controls.dolly(controls.distance * 0.3, true),
          "=": () => void controls.dolly(controls.distance * 0.3, true),
          "-": () => void controls.dolly(-controls.distance * 0.4, true),
          "0": () => resetView(controls, true),
        };
    const action = actions[event.key];
    if (action) {
      event.preventDefault();
      action();
    }
  };

  return (
    <div
      className="absolute inset-0 outline-offset-[-4px]"
      role="application"
      aria-roledescription="carte"
      aria-label={KEYBOARD_HELP}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <Canvas
        flat
        linear
        frameloop="demand"
        // Full device resolution (capped at 2) at all times: frames are drawn on demand, so
        // dropping the pixel ratio while the camera moves only blurred the map during navigation.
        dpr={[1, 2]}
        // Shown by browsers without <canvas> support; WebGL failures are caught by MapStage.
        fallback={<p>Carte en relief indisponible : ce navigateur ne gère pas le dessin en canvas.</p>}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ fov: 30, near: 1, far: 12_000, position: [0, 1400, 1100] }}
      >
        <CameraRig controlsRef={controlsRef} />
        {/* The scene reads its colours from the theme's tokens once: a new theme redraws it. */}
        {ready && <Scene key={resolvedTheme ?? "dark"} {...ready} detail={detail} />}
      </Canvas>
      {error ? (
        <MapStatus>Les données du relief n’ont pas pu être chargées : {error.message}</MapStatus>
      ) : !ready ? (
        <MapStatus>Chargement du relief…</MapStatus>
      ) : null}
    </div>
  );
}

type SceneProps = {
  terrain: TerrainData;
  mask: LandMask;
  borders: BordersData;
  detail: Detail;
};

const NO_FIRES: readonly (readonly DecodedFire[])[] = [];

/** Burn-mask resolution: 1.5× the DEM on desktop (≈ 333 m), 2× on light devices (500 m). */
const maskSize = (detail: Detail) =>
  detail.dem === 500 ? { width: 3480, height: 3270 } : { width: 2320, height: 2180 };

function Scene({ terrain, mask, borders, detail }: SceneProps) {
  const exaggeration = useMapStore((state) => state.exaggeration);
  const setRenderMode = useMapStore((state) => state.setRenderMode);
  const showHistory = useMapStore((state) => state.showHistory);
  const selectedFireId = useMapStore((state) => state.selectedFireId);
  const month = useMapStore((state) => state.month);
  const textures = useTerrainTextures(terrain, mask);
  useEffect(() => {
    setRenderMode("3d");
    return () => setRenderMode(null);
  }, [setRenderMode]);

  const basemap = useMapStore((state) => state.basemap);
  const imagery = useImagery(basemap, true, detail.dem !== 500);
  const neighbours = useNeighbours();
  const { span, fires } = useSpanFires();
  // Earlier years hatched: every archive year before the window (the window's own first year
  // included in the live view; its fires inside the window are drawn on top).
  const historyYears = useMemo(() => {
    if (!span) return [];
    const last = span.kind === "recent" ? span.months[0].year : span.year - 1;
    return Array.from({ length: Math.max(0, last - FIRST_YEAR + 1) }, (_, i) => FIRST_YEAR + i);
  }, [span]);
  const history = useEffisYears(historyYears, showHistory);
  const historyFires = (showHistory && history.data) || NO_FIRES;
  const size = maskSize(detail);
  const burn = useBurnMask(fires, historyFires, size);
  const selected = fires?.find((fire) => fire.id === selectedFireId) ?? null;
  const dayRange = useMemo(() => (span && month !== null ? spanMonthRange(span, month) : null), [span, month]);
  // Only the fires on screen (month filter) can be hovered and clicked.
  const visibleFires = useMemo(
    () => (fires && month !== null ? fires.filter((fire) => fire.monthIndex === month) : fires),
    [fires, month],
  );
  const archiveYear = useMapStore((state) => state.archiveYear);
  const showLive = useMapStore((state) => state.showLive) && archiveYear === null;
  const live = useRecentDetections(showLive);
  const liveColumns = useMemo(() => recentToColumns(live.data), [live.data]);
  const invalidate = useThree((state) => state.invalidate);
  // Frames are rendered on demand: redraw when the selection or the hovered fire changes.
  useEffect(
    () =>
      useMapStore.subscribe((state, previous) => {
        if (state.hover?.id !== previous.hover?.id || state.selectedFireId !== previous.selectedFireId) invalidate();
      }),
    [invalidate],
  );

  return (
    <>
      {neighbours.data && <Neighbours data={neighbours.data} />}
      <Terrain
        terrain={terrain}
        textures={textures}
        exaggeration={exaggeration}
        meshKm={detail.meshKm}
        lightAltitudeDeg={35}
        burn={burn}
        showHistory={showHistory}
        dayRange={dayRange}
        imagery={imagery}
      />
      <Borders
        borders={borders}
        heightTexture={textures.height}
        exaggeration={exaggeration}
        maxSegmentKm={terrain.meta.pixelSizeM / 1000}
      />
      {showLive && liveColumns && (
        <FirePoints detections={liveColumns} fixedDay={0} heightTexture={textures.height} exaggeration={exaggeration} />
      )}
      {selected && <SelectedFire fire={selected} heightTexture={textures.height} exaggeration={exaggeration} />}
      {fires && (
        <FireMarkers fires={fires} heightTexture={textures.height} exaggeration={exaggeration} dayRange={dayRange} />
      )}
      <MapProbe terrain={terrain} mask={mask} exaggeration={exaggeration} fires={visibleFires} />
    </>
  );
}
