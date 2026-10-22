"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import type * as THREE from "three";
import type { DecodedFire } from "@/lib/data/fires";
import { drapedLineMaterial, segmentGeometry } from "./drapedLines";

const REVEAL_SECONDS = 0.7;
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type SelectedFireProps = { fire: DecodedFire; heightTexture: THREE.Texture; exaggeration: number };

/** Thin ink outline of the selected fire, drawn on once (static with reduced motion). */
export function SelectedFire({ fire, heightTexture, exaggeration }: SelectedFireProps) {
  const invalidate = useThree((state) => state.invalidate);
  const [reduceMotion] = useState(prefersReducedMotion);
  const geometry = useMemo(() => segmentGeometry(fire.rings, 0.25, true), [fire]);
  const material = useMemo(
    () => drapedLineMaterial(heightTexture, exaggeration, "--ink", 1),
    [heightTexture, exaggeration],
  );
  const lineRef = useRef<THREE.LineSegments>(null);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    startedAt.current = null;
    invalidate();
  }, [fire, invalidate]);

  useFrame((state) => {
    const line = lineRef.current;
    if (!line) return;
    const uniforms = (line.material as THREE.ShaderMaterial).uniforms;
    if (reduceMotion) {
      uniforms.uProgress.value = 1;
      return;
    }
    startedAt.current ??= state.clock.elapsedTime;
    const t = Math.min(1, (state.clock.elapsedTime - startedAt.current) / REVEAL_SECONDS);
    uniforms.uProgress.value = easeOutCubic(t);
    if (t < 1) invalidate();
  });

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  return <lineSegments ref={lineRef} geometry={geometry} material={material} frustumCulled={false} renderOrder={3} />;
}
