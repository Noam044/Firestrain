"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { SpanFire } from "@/lib/data/fires";
import { SCENE_SIZE } from "@/lib/geo/frame";
import { useMapStore } from "@/lib/store";
import { readColorToken } from "@/lib/tokens";
import { AGE_CLASSES, ageClass, markerRadius, realRadiusKm } from "./markers";
import { fireMarkersFragmentShader, fireMarkersVertexShader } from "./shaders";

type FireMarkersProps = {
  fires: readonly SpanFire[];
  heightTexture: THREE.Texture;
  exaggeration: number;
  /** Window days shown (one month); null shows the whole window. */
  dayRange: readonly [number, number] | null;
};

/** CSS px per scene unit at view depth 1, for a perspective camera. */
export function pxPerUnit(camera: THREE.Camera, heightPx: number): number {
  const fov = (camera as THREE.PerspectiveCamera).fov ?? 30;
  return heightPx / 2 / Math.tan(THREE.MathUtils.degToRad(fov) / 2);
}

/** One disc per fire of the window: the tracker view at national scale. */
export function FireMarkers({ fires, heightTexture, exaggeration, dayRange }: FireMarkersProps) {
  const pointsRef = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    // Largest first: small fires are drawn on top of the large ones around them.
    const sorted = [...fires].sort((a, b) => b.areaHa - a.areaHa);
    const n = sorted.length;
    const positions = new Float32Array(3 * n);
    const day = new Float32Array(n);
    const radius = new Float32Array(n);
    const realKm = new Float32Array(n);
    const ageClasses = new Float32Array(n);
    const ids = new Float32Array(n);
    sorted.forEach((fire, k) => {
      positions[3 * k] = fire.center[0];
      positions[3 * k + 2] = fire.center[1];
      day[k] = fire.day;
      radius[k] = markerRadius(fire.areaHa);
      realKm[k] = realRadiusKm(fire.areaHa);
      ageClasses[k] = ageClass(fire.ageDays);
      ids[k] = fire.id;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("aDay", new THREE.BufferAttribute(day, 1));
    g.setAttribute("aRadius", new THREE.BufferAttribute(radius, 1));
    g.setAttribute("aRealKm", new THREE.BufferAttribute(realKm, 1));
    g.setAttribute("aClass", new THREE.BufferAttribute(ageClasses, 1));
    g.setAttribute("aId", new THREE.BufferAttribute(ids, 1));
    return g;
  }, [fires]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: fireMarkersVertexShader,
        fragmentShader: fireMarkersFragmentShader,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uHeight: { value: heightTexture },
          uSceneSize: { value: new THREE.Vector2(SCENE_SIZE.width, SCENE_SIZE.depth) },
          uExag: { value: exaggeration },
          uDayFrom: { value: 0 },
          uDayTo: { value: 1000 },
          uPixelRatio: { value: 1 },
          uPxPerUnit: { value: 1 },
          uSelected: { value: -1 },
          uHover: { value: -1 },
          uColors: { value: AGE_CLASSES.map((c) => new THREE.Vector3(...readColorToken(c.token))) },
          uInk: { value: new THREE.Vector3(...readColorToken("--ink")) },
        },
      }),
    [heightTexture, exaggeration],
  );

  useFrame((state) => {
    const points = pointsRef.current;
    if (!points) return;
    const uniforms = (points.material as THREE.ShaderMaterial).uniforms;
    const [from, to] = dayRange ?? [0, 1000];
    uniforms.uDayFrom.value = from;
    uniforms.uDayTo.value = to;
    uniforms.uPixelRatio.value = state.viewport.dpr;
    uniforms.uPxPerUnit.value = pxPerUnit(state.camera, state.size.height);
    // Read without re-rendering React: selection and hover change often.
    const { selectedFireId, hover } = useMapStore.getState();
    uniforms.uSelected.value = selectedFireId ?? -1;
    uniforms.uHover.value = hover?.id ?? -1;
  });

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  return <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} renderOrder={6} />;
}
