"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SCENE_SIZE, sceneToL93 } from "@/lib/geo/frame";
import { l93ToLonLat, lonLatToScene, sceneToLonLat } from "@/lib/geo/projection";
import { createGridSampler, intersectHeightfield, type Vec3 } from "@/lib/geo/heightfield";
import type { TerrainData } from "@/lib/data/queries";
import { findFireAt, type DecodedFire } from "@/lib/data/fires";
import type { LandMask } from "@/lib/data/land-mask";
import { useMapStore } from "@/lib/store";

type MapProbeProps = {
  terrain: TerrainData;
  mask: LandMask;
  exaggeration: number;
  /** Fires of the year shown, clickable. */
  fires: readonly DecodedFire[] | undefined;
};

/**
 * Measures the view for the map furniture (scale at the centre, north), reads
 * the ground under the pointer (coordinates, BD ALTI altitude) and turns a click
 * on a burnt area into a selection.
 */
export function MapProbe({ terrain, mask, exaggeration, fires }: MapProbeProps) {
  const camera = useThree((state) => state.camera);
  const canvas = useThree((state) => state.gl.domElement);
  const events = useThree((state) => state.events);
  const size = useThree((state) => state.size);
  const setView = useMapStore((state) => state.setView);
  const setCursor = useMapStore((state) => state.setCursor);
  const selectFire = useMapStore((state) => state.selectFire);

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const sampler = useMemo(
    () =>
      createGridSampler(
        { width: terrain.meta.width, height: terrain.meta.height, meters: terrain.meters },
        exaggeration,
      ),
    [terrain, exaggeration],
  );
  const maxHeight = (terrain.meta.stats.maxM / 1000) * exaggeration + 0.5;

  const pick = useCallback(
    (ndc: THREE.Vector2): Vec3 | null => {
      raycaster.setFromCamera(ndc, camera);
      const { origin, direction } = raycaster.ray;
      return intersectHeightfield(origin, direction, sampler, {
        maxHeight,
        step: 0.25,
        maxDistance: 20_000,
      });
    },
    [raycaster, camera, sampler, maxHeight],
  );

  const lastMatrix = useRef(new THREE.Matrix4());
  const lastSize = useRef("");
  useFrame(() => {
    const sizeKey = `${size.width}×${size.height}`;
    if (lastMatrix.current.equals(camera.matrixWorld) && lastSize.current === sizeKey) return;
    lastMatrix.current.copy(camera.matrixWorld);
    lastSize.current = sizeKey;

    const centre = pick(new THREE.Vector2(0, 0));
    if (!centre) {
      setView({ kmPer100px: null, northDeg: 0 });
      return;
    }
    // Scale: ground distance between the centre and a point 100 CSS px to its right.
    raycaster.setFromCamera(new THREE.Vector2(200 / size.width, 0), camera);
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -centre.y);
    const right = raycaster.ray.intersectPlane(ground, new THREE.Vector3());
    const kmPer100px = right ? Math.hypot(right.x - centre.x, right.z - centre.z) : null;

    // Geographic north (not Lambert-93 grid north, which differs by the meridian
    // convergence, up to ±4° across France): screen direction of a short step
    // in latitude from the centre.
    const [lon, lat] = sceneToLonLat({ x: centre.x, z: centre.z });
    const north = lonLatToScene([lon, lat + 0.05]);
    const a = new THREE.Vector3(centre.x, centre.y, centre.z).project(camera);
    const b = new THREE.Vector3(north.x, centre.y, north.z).project(camera);
    const northDeg = THREE.MathUtils.radToDeg(
      Math.atan2((b.x - a.x) * size.width, (b.y - a.y) * size.height),
    );
    setView({ kmPer100px, northDeg });
  });

  useEffect(() => {
    let frame = 0;
    let lastEvent: PointerEvent | null = null;
    let pressed: { x: number; y: number; at: number } | null = null;
    const { width, height } = terrain.meta;
    // camera-controls captures the pointer on the element R3F listens to, so
    // pointerup reaches that element, not the canvas.
    const surface = (events.connected as HTMLElement | null | undefined) ?? canvas;

    const groundAt = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return pick(
        new THREE.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -((event.clientY - rect.top) / rect.height) * 2 + 1,
        ),
      );
    };

    const update = () => {
      frame = 0;
      if (!lastEvent) return;
      const hit = groundAt(lastEvent);
      // Hint that burnt areas can be clicked (standard pointer, no custom cursor).
      surface.style.cursor = hit && fires && findFireAt(fires, hit.x, hit.z) ? "pointer" : "";
      if (!hit) {
        setCursor(null);
        return;
      }
      const [x, y] = sceneToL93({ x: hit.x, z: hit.z });
      const [lon, lat] = l93ToLonLat([x, y]);
      const i = Math.floor(((hit.x + SCENE_SIZE.width / 2) / SCENE_SIZE.width) * width);
      const j = Math.floor(((hit.z + SCENE_SIZE.depth / 2) / SCENE_SIZE.depth) * height);
      const onGrid = i >= 0 && j >= 0 && i < width && j < height;
      const inFrance = onGrid && mask.inside[j * width + i] === 1;
      const meters = onGrid ? terrain.meters[j * width + i] : Number.NaN;
      setCursor({
        lon,
        lat,
        x,
        y,
        inFrance,
        altitudeM: inFrance && !Number.isNaN(meters) ? meters : null,
      });
    };

    const onMove = (event: PointerEvent) => {
      lastEvent = event;
      if (!frame) frame = requestAnimationFrame(update);
    };
    const onLeave = () => {
      lastEvent = null;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      setCursor(null);
    };
    // A click (no drag) selects the burnt area under the pointer, or clears the selection.
    const onDown = (event: PointerEvent) => {
      pressed = event.button === 0 ? { x: event.clientX, y: event.clientY, at: performance.now() } : null;
    };
    const onUp = (event: PointerEvent) => {
      if (!pressed || !fires) return;
      const moved = Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y);
      const quick = performance.now() - pressed.at < 600;
      pressed = null;
      if (moved > 6 || !quick) return;
      const hit = groundAt(event);
      selectFire(hit ? (findFireAt(fires, hit.x, hit.z)?.id ?? null) : null);
    };

    surface.addEventListener("pointermove", onMove);
    surface.addEventListener("pointerleave", onLeave);
    surface.addEventListener("pointerdown", onDown);
    surface.addEventListener("pointerup", onUp);
    return () => {
      surface.removeEventListener("pointermove", onMove);
      surface.removeEventListener("pointerleave", onLeave);
      surface.removeEventListener("pointerdown", onDown);
      surface.removeEventListener("pointerup", onUp);
      surface.style.cursor = "";
      onLeave();
    };
  }, [canvas, events, pick, terrain, mask, fires, setCursor, selectFire]);

  return null;
}
