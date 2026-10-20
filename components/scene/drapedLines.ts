import * as THREE from "three";
import { SCENE_SIZE } from "@/lib/geo/frame";
import { readColorToken, type ColorToken } from "@/lib/tokens";
import { drapedLineFragmentShader, drapedLineVertexShader } from "./shaders";

/**
 * Flat [x, z, …] lines (scene km) → line segments no longer than
 * `maxSegmentKm`, so the draped line follows the relief between vertices.
 * `closed` adds each ring's closing segment. `aProgress` runs from 0 to 1
 * along every line, for a draw-on reveal.
 */
export function segmentGeometry(
  lines: readonly ArrayLike<number>[],
  maxSegmentKm: number,
  closed = false,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const progress: number[] = [];
  for (const line of lines) {
    const n = line.length / 2;
    const count = closed ? n : n - 1;
    const segmentLength = (k: number) => {
      const j = (k + 1) % n;
      return Math.hypot(line[2 * j] - line[2 * k], line[2 * j + 1] - line[2 * k + 1]);
    };
    let total = 0;
    for (let k = 0; k < count; k++) total += segmentLength(k);
    let travelled = 0;
    for (let k = 0; k < count; k++) {
      const j = (k + 1) % n;
      const [x0, z0, x1, z1] = [line[2 * k], line[2 * k + 1], line[2 * j], line[2 * j + 1]];
      const length = segmentLength(k);
      const steps = Math.max(1, Math.ceil(length / maxSegmentKm));
      for (let s = 0; s < steps; s++) {
        const a = s / steps;
        const b = (s + 1) / steps;
        positions.push(x0 + (x1 - x0) * a, 0, z0 + (z1 - z0) * a);
        positions.push(x0 + (x1 - x0) * b, 0, z0 + (z1 - z0) * b);
        progress.push(
          total > 0 ? (travelled + a * length) / total : 1,
          total > 0 ? (travelled + b * length) / total : 1,
        );
      }
      travelled += length;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aProgress", new THREE.Float32BufferAttribute(progress, 1));
  return geometry;
}

/** Line draped on the relief by sampling the same height texture as the terrain. */
export function drapedLineMaterial(
  height: THREE.Texture,
  exaggeration: number,
  color: ColorToken,
  opacity: number,
): THREE.ShaderMaterial {
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
      uProgress: { value: 1 },
    },
  });
}
