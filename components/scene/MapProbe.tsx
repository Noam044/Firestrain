"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SCENE_SIZE, sceneToL93 } from "@/lib/geo/frame";
import { l93ToLonLat, lonLatToScene, sceneToLonLat } from "@/lib/geo/projection";
import { createGridSampler, intersectHeightfield, type Vec3 } from "@/lib/geo/heightfield";
import type { TerrainData } from "@/lib/data/queries";
import { findFireAt, type SpanFire } from "@/lib/data/fires";
import type { LandMask } from "@/lib/data/land-mask";
import { useMapStore } from "@/lib/store";
import { pxPerUnit } from "./FireMarkers";
import { markerFade, markerRadius, realRadiusKm } from "./markers";

type MapProbeProps = {
  terrain: TerrainData;
  mask: LandMask;
  exaggeration: number;
  /** Fires on screen (window, month filter), clickable. */
  fires: readonly SpanFire[] | undefined;
};

/**
 * Measures the view for the map furniture (scale at the centre, north), reads
 * the ground under the pointer (coordinates, BD ALTI altitude) and turns a click
 * on a marker, or on a burnt outline once its marker has faded, into a selection.
 */
export function MapProbe({ terrain, mask, exaggeration, fires }: MapProbeProps) {
  const camera = useThree((state) => state.camera);
  const canvas = useThree((state) => state.gl.domElement);
  const events = useThree((state) => state.events);
  const size = useThree((state) => state.size);
  const setView = useMapStore((state) => state.setView);
  const setCursor = useMapStore((state) => state.setCursor);
  const selectFire = useMapStore((state) => state.selectFire);
  const setHover = useMapStore((state) => state.setHover);

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

  // Marker anchors on the relief, as drawn by FireMarkers.
  const anchors = useMemo(
    () =>
      (fires ?? []).map((fire) => ({
        fire,
        position: new THREE.Vector3(fire.center[0], sampler(fire.center[0], fire.center[1]), fire.center[1]),
        radius: markerRadius(fire.areaHa),
        realKm: realRadiusKm(fire.areaHa),
      })),
    [fires, sampler],
  );

  /** Smallest visible marker under a screen point (CSS px relative to the canvas), if any. */
  const markerAt = useCallback(
    (px: number, py: number): SpanFire | null => {
      const scale = pxPerUnit(camera, size.height);
      const view = new THREE.Vector3();
      const ndc = new THREE.Vector3();
      let best: SpanFire | null = null;
      for (const { fire, position, radius, realKm } of anchors) {
        view.copy(position).applyMatrix4(camera.matrixWorldInverse);
        if (view.z >= 0) continue;
        if (markerFade(radius, (realKm * scale) / -view.z) < 0.3) continue;
        ndc.copy(position).project(camera);
        const sx = ((ndc.x + 1) / 2) * size.width;
        const sy = ((1 - ndc.y) / 2) * size.height;
        if (Math.hypot(sx - px, sy - py) > radius + 2) continue;
        if (!best || fire.areaHa < best.areaHa) best = fire;
      }
      return best;
    },
    [anchors, camera, size],
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

    const markerUnder = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return markerAt(event.clientX - rect.left, event.clientY - rect.top);
    };
    /** Marker under the pointer, else the burnt outline under it. */
    const fireAt = (event: PointerEvent, hit: Vec3 | null) =>
      markerUnder(event) ?? (hit && fires ? findFireAt(fires, hit.x, hit.z) : null);

    const update = () => {
      frame = 0;
      if (!lastEvent) return;
      const hit = groundAt(lastEvent);
      // Hint that fires can be clicked (standard pointer) and name them in a tooltip.
      const hovered = fireAt(lastEvent, hit);
      surface.style.cursor = hovered ? "pointer" : "";
      const previous = useMapStore.getState().hover;
      if (hovered) setHover({ id: hovered.id, x: lastEvent.clientX, y: lastEvent.clientY });
      else if (previous && previous.x !== null) setHover(null);
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
      setHover(null);
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
      // A marker flies to its fire; an outline (already close) is selected where it is.
      const marker = markerUnder(event);
      const fire = marker ?? fireAt(event, groundAt(event));
      selectFire(fire?.id ?? null);
      if (marker) useMapStore.getState().requestCamera({ kind: "bbox", bbox: marker.bbox });
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
  }, [canvas, events, pick, markerAt, terrain, mask, fires, setCursor, selectFire, setHover]);

  return null;
}
