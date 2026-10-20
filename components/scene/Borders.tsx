"use client";

import { useEffect, useMemo } from "react";
import type * as THREE from "three";
import type { Borders as BordersData } from "@/lib/data/schemas";
import { drapedLineMaterial, segmentGeometry } from "./drapedLines";

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
      inner: drapedLineMaterial(heightTexture, exaggeration, "--ash-400", 0.32),
      outer: drapedLineMaterial(heightTexture, exaggeration, "--bone-300", 0.75),
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
