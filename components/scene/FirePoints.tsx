"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SCENE_SIZE } from "@/lib/geo/frame";
import { useMapStore } from "@/lib/store";
import { readColorToken } from "@/lib/tokens";
import { firePointsFragmentShader, firePointsVertexShader } from "./shaders";

/** Days over which a detection fades out after its day. */
export const FADE_DAYS = 3;

/** Hotspots as columns; `day` may be fractional, `frp` is in 0.1 MW. */
export type HotspotColumns = {
  count: number;
  positions: ArrayLike<number>;
  day: ArrayLike<number>;
  frp: ArrayLike<number>;
};

type FirePointsProps = {
  detections: HotspotColumns;
  heightTexture: THREE.Texture;
  exaggeration: number;
  /** Fixed "today" instead of the timeline day (last 72 hours: days are ≤ 0, today = 0). */
  fixedDay?: number;
};

/**
 * FIRMS hotspots, shown only while the timeline is in use or for the last
 * 72 hours (ember: active detections).
 */
export function FirePoints({ detections, heightTexture, exaggeration, fixedDay }: FirePointsProps) {
  const pointsRef = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const n = detections.count;
    const positions = new Float32Array(3 * n);
    const day = new Float32Array(n);
    const frp = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      positions[3 * k] = detections.positions[2 * k];
      positions[3 * k + 2] = detections.positions[2 * k + 1];
      day[k] = detections.day[k];
      frp[k] = detections.frp[k] / 10;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("aDay", new THREE.BufferAttribute(day, 1));
    g.setAttribute("aFrp", new THREE.BufferAttribute(frp, 1));
    return g;
  }, [detections]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: firePointsVertexShader,
        fragmentShader: firePointsFragmentShader,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uHeight: { value: heightTexture },
          uSceneSize: { value: new THREE.Vector2(SCENE_SIZE.width, SCENE_SIZE.depth) },
          uExag: { value: exaggeration },
          uDay: { value: -1000 },
          uFadeDays: { value: FADE_DAYS },
          uPixelRatio: { value: 1 },
          uColor: { value: new THREE.Vector3(...readColorToken("--ember")) },
        },
      }),
    [heightTexture, exaggeration],
  );

  useFrame((state) => {
    const points = pointsRef.current;
    if (!points) return;
    const uniforms = (points.material as THREE.ShaderMaterial).uniforms;
    const day = fixedDay ?? useMapStore.getState().timelineDay;
    uniforms.uDay.value = day ?? -1000;
    uniforms.uPixelRatio.value = state.viewport.dpr;
  });

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  return <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} renderOrder={4} />;
}
