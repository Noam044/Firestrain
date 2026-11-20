"use client";

import { Html } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Neighbours as NeighboursData } from "@/lib/data/schemas";
import { MAP_LABELS } from "@/lib/geo/places";
import { lonLatToScene } from "@/lib/geo/projection";
import { readColorToken } from "@/lib/tokens";

/** Just below sea level, so France (relief and coast) always draws over the neighbours. */
const GROUND_Y = -0.4;

const toPoints = (ring: readonly number[]) => {
  const points: THREE.Vector2[] = [];
  for (let k = 0; k < ring.length; k += 2) points.push(new THREE.Vector2(ring[k], ring[k + 1]));
  return points;
};

/**
 * Countries around France: flat, one neutral tone, a thin outline and their
 * names. No relief and no data, so that France stays the subject of the map.
 */
export function Neighbours({ data }: { data: NeighboursData }) {
  const { fill, lines } = useMemo(() => {
    const positions: number[] = [];
    const segments: number[] = [];
    for (const country of data.countries) {
      for (const polygon of country.polygons) {
        const contour = toPoints(polygon[0]);
        const holes = polygon.slice(1).map(toPoints);
        // triangulateShape may reorder the arrays in place: read the points afterwards.
        const faces = THREE.ShapeUtils.triangulateShape(contour, holes);
        const points = contour.concat(...holes);
        for (const face of faces) for (const index of face) positions.push(points[index].x, GROUND_Y, points[index].y);
        for (const ring of polygon) {
          for (let k = 0; k + 3 < ring.length; k += 2) {
            segments.push(ring[k], GROUND_Y + 0.05, ring[k + 1], ring[k + 2], GROUND_Y + 0.05, ring[k + 3]);
          }
        }
      }
    }
    const fillGeometry = new THREE.BufferGeometry();
    fillGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(segments, 3));
    return { fill: fillGeometry, lines: lineGeometry };
  }, [data]);

  const materials = useMemo(
    () => ({
      fill: new THREE.MeshBasicMaterial({ color: new THREE.Color(...readColorToken("--neighbour")), side: THREE.DoubleSide }),
      line: new THREE.LineBasicMaterial({ color: new THREE.Color(...readColorToken("--neighbour-line")) }),
    }),
    [],
  );
  useEffect(
    () => () => {
      fill.dispose();
      lines.dispose();
    },
    [fill, lines],
  );
  useEffect(
    () => () => {
      materials.fill.dispose();
      materials.line.dispose();
    },
    [materials],
  );

  return (
    <group>
      <mesh geometry={fill} material={materials.fill} frustumCulled={false} renderOrder={-1} />
      <lineSegments geometry={lines} material={materials.line} frustumCulled={false} />
      {MAP_LABELS.map((label) => {
        const p = lonLatToScene(label.at);
        return (
          <Html key={label.name} position={[p.x, 0, p.z]} center zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
            <span
              aria-hidden
              className={`whitespace-nowrap text-[11px] leading-none ${
                label.kind === "sea" ? "italic text-ink-3/80" : "font-medium uppercase tracking-[0.12em] text-ink-3"
              }`}
            >
              {label.name}
            </span>
          </Html>
        );
      })}
    </group>
  );
}
