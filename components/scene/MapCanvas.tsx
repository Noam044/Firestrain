"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { AdaptiveDpr, PerformanceMonitor, type CameraControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import * as THREE from "three";
import {
  useBorders,
  useEffisYear,
  useDetections,
  useRecentDetections,
  useEffisYears,
  useFranceOutline,
  useTerrain,
  type DemResolution,
  type TerrainData,
} from "@/lib/data/queries";
import type { DecodedFire } from "@/lib/data/fires";
import { recentToColumns } from "@/lib/data/firms-recent";
import { rasterizeLandMask, type LandMask } from "@/lib/data/land-mask";
import type { Borders as BordersData } from "@/lib/data/schemas";
import { FIRST_YEAR, useMapStore, type MapMode } from "@/lib/store";
import { Borders } from "./Borders";
import { useBurnMask } from "./BurnMask";
import { SelectedFire } from "./SelectedFire";
import { FirePoints } from "./FirePoints";
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

export default function MapCanvas({ mode }: { mode: MapMode }) {
  const [detail] = useState(chooseDetail);
  const terrain = useTerrain(detail.dem);
  const outline = useFranceOutline();
  const borders = useBorders();
  const controlsRef = useRef<CameraControls | null>(null);
  const [dprCap, setDprCap] = useState(2);

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
    if (!controls || mode !== "explore") return;
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

  const interactive = mode === "explore";
  return (
    <div
      className="absolute inset-0 outline-offset-[-4px]"
      {...(interactive
        ? {
            role: "application",
            "aria-roledescription": "carte",
            "aria-label": KEYBOARD_HELP,
            tabIndex: 0,
            onKeyDown,
          }
        : { "aria-hidden": true })}
    >
      <Canvas
        flat
        linear
        frameloop="demand"
        dpr={[1, dprCap]}
        performance={{ min: 0.5 }}
        // Shown by browsers without <canvas> support; WebGL failures are caught by MapStage.
        fallback={<p>Carte en relief indisponible : ce navigateur ne gère pas le dessin en canvas.</p>}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ fov: 30, near: 1, far: 12_000, position: [0, 1400, 1100] }}
      >
        <PerformanceMonitor onDecline={() => setDprCap(1)} onIncline={() => setDprCap(2)} flipflops={3} />
        <AdaptiveDpr />
        <CameraRig mode={mode} controlsRef={controlsRef} />
        {ready && <Scene {...ready} mode={mode} detail={detail} />}
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
  mode: MapMode;
  detail: Detail;
};

const NO_FIRES: readonly (readonly DecodedFire[])[] = [];

/** Burn-mask resolution: 1.5× the DEM on desktop (≈ 333 m), 2× on light devices (500 m). */
const maskSize = (detail: Detail, mode: MapMode) =>
  mode === "story"
    ? { width: 1, height: 1 }
    : detail.dem === 500
      ? { width: 3480, height: 3270 }
      : { width: 2320, height: 2180 };

function Scene({ terrain, mask, borders, mode, detail }: SceneProps) {
  const exaggeration = useMapStore((state) => state.exaggeration);
  const setRenderMode = useMapStore((state) => state.setRenderMode);
  const year = useMapStore((state) => state.year);
  const showHistory = useMapStore((state) => state.showHistory);
  const selectedFireId = useMapStore((state) => state.selectedFireId);
  const textures = useTerrainTextures(terrain, mask);
  useEffect(() => {
    setRenderMode("3d");
    return () => setRenderMode(null);
  }, [setRenderMode]);

  // Burnt areas are an Explorer layer; the story will introduce them itself.
  const explore = mode === "explore";
  const current = useEffisYear(year, explore);
  const historyYears = useMemo(
    () => Array.from({ length: Math.max(0, year - FIRST_YEAR) }, (_, i) => FIRST_YEAR + i),
    [year],
  );
  const history = useEffisYears(historyYears, explore && showHistory);
  const historyFires = (showHistory && history.data) || NO_FIRES;
  const size = maskSize(detail, mode);
  const burn = useBurnMask(current.data?.fires, historyFires, size);
  const selected = current.data?.fires.find((fire) => fire.id === selectedFireId) ?? null;
  const detections = useDetections(year, explore);
  const showRecent = useMapStore((state) => state.showRecent);
  const recent = useRecentDetections(explore && showRecent);
  const recentColumns = useMemo(() => recentToColumns(recent.data), [recent.data]);
  const invalidate = useThree((state) => state.invalidate);
  // Frames are rendered on demand: redraw when the timeline moves.
  useEffect(() => useMapStore.subscribe((state, previous) => {
    if (state.timelineDay !== previous.timelineDay || state.showRecent !== previous.showRecent) invalidate();
  }), [invalidate]);

  return (
    <>
      <Terrain
        terrain={terrain}
        textures={textures}
        exaggeration={exaggeration}
        meshKm={detail.meshKm}
        lightAltitudeDeg={mode === "story" ? 24 : 35}
        burn={burn}
        showHistory={showHistory}
      />
      <Borders
        borders={borders}
        heightTexture={textures.height}
        exaggeration={exaggeration}
        maxSegmentKm={terrain.meta.pixelSizeM / 1000}
      />
      {showRecent
        ? recentColumns && (
            <FirePoints detections={recentColumns} fixedDay={0} heightTexture={textures.height} exaggeration={exaggeration} />
          )
        : detections.data && (
            <FirePoints detections={detections.data} heightTexture={textures.height} exaggeration={exaggeration} />
          )}
      {selected && <SelectedFire fire={selected} heightTexture={textures.height} exaggeration={exaggeration} />}
      {explore && (
        <MapProbe terrain={terrain} mask={mask} exaggeration={exaggeration} fires={current.data?.fires} />
      )}
    </>
  );
}
