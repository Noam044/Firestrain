"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SCENE_SIZE } from "@/lib/geo/frame";
import type { TerrainData } from "@/lib/data/queries";
import type { LandMask } from "@/lib/data/land-mask";
import { readColorToken } from "@/lib/tokens";
import { useMapStore } from "@/lib/store";
import { terrainFragmentShader, terrainVertexShader } from "./shaders";

/** uDay beyond any day of the year: every burnt area of the year is shown. */
const WHOLE_YEAR = 1000;

export type TerrainTextures = { height: THREE.DataTexture; mask: THREE.CanvasTexture };

/** GPU textures shared by the relief and the draped lines. */
export function useTerrainTextures(terrain: TerrainData, mask: LandMask): TerrainTextures {
  const textures = useMemo(() => {
    const [base] = terrain.levels;
    const height = new THREE.DataTexture(base.data, base.width, base.height, THREE.RGFormat, THREE.HalfFloatType);
    // Pyramid built in the worker: half-float mipmaps cannot be generated on the GPU.
    height.mipmaps = terrain.levels.map(({ data, width, height: h }) => ({ data, width, height: h }));
    height.minFilter = THREE.LinearMipmapLinearFilter;
    height.magFilter = THREE.LinearFilter;
    height.generateMipmaps = false;
    height.needsUpdate = true;

    const maskTexture = new THREE.CanvasTexture(mask.canvas);
    maskTexture.flipY = false;
    maskTexture.colorSpace = THREE.NoColorSpace;
    maskTexture.minFilter = THREE.LinearMipmapLinearFilter;
    maskTexture.magFilter = THREE.LinearFilter;
    return { height, mask: maskTexture };
  }, [terrain, mask]);

  useEffect(
    () => () => {
      textures.height.dispose();
      textures.mask.dispose();
    },
    [textures],
  );
  return textures;
}

/** Direction towards the light; azimuth clockwise from north (315° = north-west). */
export function lightDirection(altitudeDeg: number, azimuthDeg = 315): THREE.Vector3 {
  const altitude = THREE.MathUtils.degToRad(altitudeDeg);
  const azimuth = THREE.MathUtils.degToRad(azimuthDeg);
  return new THREE.Vector3(
    Math.sin(azimuth) * Math.cos(altitude),
    Math.sin(altitude),
    -Math.cos(azimuth) * Math.cos(altitude),
  ).normalize();
}

type TerrainProps = {
  terrain: TerrainData;
  textures: TerrainTextures;
  exaggeration: number;
  /** Mesh spacing in km; the shading itself uses the full DEM resolution. */
  meshKm: number;
  lightAltitudeDeg: number;
  /** Burn mask (BurnMask.ts); an empty texture shows no burnt area. */
  burn: THREE.Texture;
  showHistory: boolean;
};

export function Terrain({
  terrain,
  textures,
  exaggeration,
  meshKm,
  lightAltitudeDeg,
  burn,
  showHistory,
}: TerrainProps) {
  const invalidate = useThree((state) => state.invalidate);
  const meshRef = useRef<THREE.Mesh>(null);
  const light = useMemo(() => lightDirection(lightAltitudeDeg), [lightAltitudeDeg]);

  const geometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(
      SCENE_SIZE.width,
      SCENE_SIZE.depth,
      Math.round(SCENE_SIZE.width / meshKm),
      Math.round(SCENE_SIZE.depth / meshKm),
    );
    plane.rotateX(-Math.PI / 2);
    plane.deleteAttribute("normal");
    plane.deleteAttribute("uv");
    return plane;
  }, [meshKm]);

  const material = useMemo(() => {
    const { width, height } = terrain.meta;
    const vec3 = (rgb: [number, number, number]) => new THREE.Vector3(...rgb);
    return new THREE.ShaderMaterial({
      vertexShader: terrainVertexShader,
      fragmentShader: terrainFragmentShader,
      uniforms: {
        uHeight: { value: textures.height },
        uMask: { value: textures.mask },
        uSceneSize: { value: new THREE.Vector2(SCENE_SIZE.width, SCENE_SIZE.depth) },
        uTexel: { value: new THREE.Vector2(1 / width, 1 / height) },
        // Dynamic values below are refreshed every frame from props (see useFrame).
        uExag: { value: 1 },
        uShadeExag: { value: 1 },
        uLightDir: { value: new THREE.Vector3(0, 1, 0) },
        uHistory: { value: 1 },
        uPixelRatio: { value: 1 },
        uDay: { value: WHOLE_YEAR },
        uBurn: { value: burn },
        uColShadow: { value: vec3(readColorToken("--ash-900")) },
        uColFlat: { value: vec3(readColorToken("--ash-700")) },
        uColLight: { value: vec3(readColorToken("--ash-400")) },
        uColHigh: { value: vec3(readColorToken("--bone-300")) },
        uColWater: { value: vec3(readColorToken("--sea")) },
        uColChar: { value: vec3(readColorToken("--char")) },
        uColHatch: { value: vec3(readColorToken("--bone-300")) },
      },
    });
  }, [terrain, textures, burn]);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const uniforms = (mesh.material as THREE.ShaderMaterial).uniforms;
    uniforms.uExag.value = exaggeration;
    // Shading is slightly stronger than the geometry so lowland relief stays legible.
    uniforms.uShadeExag.value = exaggeration * 1.5;
    uniforms.uLightDir.value.copy(light);
    uniforms.uHistory.value = showHistory ? 1 : 0;
    uniforms.uPixelRatio.value = state.viewport.dpr;
    // Timeline day (WHOLE_YEAR when no day is chosen), read without re-rendering React.
    uniforms.uDay.value = useMapStore.getState().timelineDay ?? WHOLE_YEAR;
  });

  useEffect(() => invalidate(), [geometry, material, exaggeration, light, showHistory, invalidate]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  return <mesh ref={meshRef} geometry={geometry} material={material} frustumCulled={false} />;
}
