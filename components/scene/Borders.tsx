"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { SCENE_SIZE } from "@/lib/geo/frame";
import type { Borders as BordersData } from "@/lib/data/schemas";
import { readColorToken, type ColorToken } from "@/lib/tokens";
import { drapedLineFragmentShader, drapedLineVertexShader } from "./shaders";

/**
 * Flat [x, z, …] polylines → line segments, split so that no segment exceeds
 * `maxSegmentKm` and the draped line follows the relief between vertices.
 */
function segmentGeometry(lines: number[][], maxSegmentKm: number): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const line of lines) {
    for (let k = 0; k + 3 < line.length; k += 2) {
      const [x0, z0, x1, z1] = [line[k], line[k + 1], line[k + 2], line[k + 3]];
      const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / maxSegmentKm));
      for (let s = 0; s < steps; s++) {
        const a = s / steps;
        const b = (s + 1) / steps;
        positions.push(x0 + (x1 - x0) * a, 0, z0 + (z1 - z0) * a);
        positions.push(x0 + (x1 - x0) * b, 0, z0 + (z1 - z0) * b);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

function lineMaterial(
  height: THREE.Texture,
  exaggeration: number,
  color: ColorToken,
  opacity: number,
) {
  return new THREE.ShaderMaterial({
    vertexShader: drapedLineVertexShader,
    fragmentShader: drapedLineFragmentShader,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uHeight: { value: height },
      uSceneSize: { value: new THREE.Vector2(SCENE_SIZE.width, SCENE_SIZE.depth) },
      uExag: { value: exaggeration },
      uLift: { value: 0.0015 },
      uColor: { value: new THREE.Vector3(...readColorToken(color)) },
      uOpacity: { value: opacity },
    },
  });
}

type BordersProps = {
  borders: BordersData;
  heightTexture: THREE.Texture;
  exaggeration: number;
  maxSegmentKm: number;
};

export function Borders({ borders, heightTexture, exaggeration, maxSegmentKm }: BordersProps) {
  const geometries = useMemo(
    () => ({
      inner: segmentGeometry(borders.inner, maxSegmentKm),
      outer: segmentGeometry(borders.outer, maxSegmentKm),
    }),
    [borders, maxSegmentKm],
  );
  const materials = useMemo(
    () => ({
      inner: lineMaterial(heightTexture, exaggeration, "--ash-400", 0.32),
      outer: lineMaterial(heightTexture, exaggeration, "--bone-300", 0.75),
    }),
    [heightTexture, exaggeration],
  );

  useEffect(
    () => () => {
      geometries.inner.dispose();
      geometries.outer.dispose();
    },
    [geometries],
  );
  useEffect(
    () => () => {
      materials.inner.dispose();
      materials.outer.dispose();
    },
    [materials],
  );

  return (
    <>
      <lineSegments geometry={geometries.inner} material={materials.inner} frustumCulled={false} renderOrder={1} />
      <lineSegments geometry={geometries.outer} material={materials.outer} frustumCulled={false} renderOrder={2} />
    </>
  );
}
