"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SCENE_SIZE } from "@/lib/geo/frame";
import type { TerrainData } from "@/lib/data/queries";
import type { LandMask } from "@/lib/data/land-mask";
import { readColorToken } from "@/lib/tokens";
import { useMapStore } from "@/lib/store";
import { monthRange } from "@/lib/timeline";
import type { Imagery } from "./Imagery";
import { terrainFragmentShader, terrainVertexShader } from "./shaders";

/** uDay beyond any day of the year: every burnt area of the year is shown. */
const WHOLE_YEAR = 1000;

/** Bound to the imagery samplers until an image has loaded (a sampler needs a texture). */
const NO_IMAGE = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
NO_IMAGE.needsUpdate = true;

export type TerrainTextures = { height: THREE.DataTexture; mask: THREE.CanvasTexture };

/** GPU textures shared by the relief and the draped lines. */
export function useTerrainTextures(terrain: TerrainData, mask: LandMask): TerrainTextures {
  // Anisotropic filtering keeps the relief sharp in the distance of oblique views,
  // where isotropic mipmaps blur along the receding axis.
  const anisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());
  const textures = useMemo(() => {
    const [base] = terrain.levels;
    const height = new THREE.DataTexture(base.data, base.width, base.height, THREE.RGFormat, THREE.HalfFloatType);
    // Pyramid built in the worker: half-float mipmaps cannot be generated on the GPU.
    height.mipmaps = terrain.levels.map(({ data, width, height: h }) => ({ data, width, height: h }));
    height.minFilter = THREE.LinearMipmapLinearFilter;
    height.magFilter = THREE.LinearFilter;
    height.generateMipmaps = false;
    height.anisotropy = anisotropy;
    height.needsUpdate = true;

    const maskTexture = new THREE.CanvasTexture(mask.canvas);
    maskTexture.flipY = false;
    maskTexture.colorSpace = THREE.NoColorSpace;
    maskTexture.minFilter = THREE.LinearMipmapLinearFilter;
    maskTexture.magFilter = THREE.LinearFilter;
    maskTexture.anisotropy = anisotropy;
    return { height, mask: maskTexture };
  }, [terrain, mask, anisotropy]);

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
  /** Base-map imagery (Imagery.ts); the shaded relief when absent. */
  imagery: Imagery;
};

export function Terrain({
  terrain,
  textures,
  exaggeration,
  meshKm,
  lightAltitudeDeg,
  burn,
  showHistory,
  imagery,
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
        uDayFrom: { value: 0 },
        uBurn: { value: burn },
        uImagery: { value: 0 },
        uImageryFar: { value: NO_IMAGE },
        uImageryNear: { value: NO_IMAGE },
        uNearRect: { value: new THREE.Vector4() },
        uHasNear: { value: 0 },
        uImageryShade: { value: 0 },
        uColShadow: { value: vec3(readColorToken("--relief-shadow")) },
        uColFlat: { value: vec3(readColorToken("--relief-flat")) },
        uColLight: { value: vec3(readColorToken("--relief-light")) },
        uColHigh: { value: vec3(readColorToken("--relief-high")) },
        uColWater: { value: vec3(readColorToken("--water")) },
        uColChar: { value: vec3(readColorToken("--scorch")) },
        uColHatch: { value: vec3(readColorToken("--cendre")) },
        uColEdge: { value: vec3(readColorToken("--scorch-ink")) },
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
    // Day range shown, read without re-rendering React: a month, the timeline day, or the whole year.
    const { timelineDay, month, year } = useMapStore.getState();
    const range = month ? monthRange(year, month) : null;
    uniforms.uDayFrom.value = range ? range[0] : 0;
    uniforms.uDay.value = range ? range[1] : (timelineDay ?? WHOLE_YEAR);
    // Imagery replaces the shaded relief once the whole-France image is there.
    uniforms.uImagery.value = imagery.far ? 1 : 0;
    uniforms.uImageryFar.value = imagery.far ?? NO_IMAGE;
    uniforms.uImageryNear.value = imagery.near ?? NO_IMAGE;
    uniforms.uHasNear.value = imagery.near ? 1 : 0;
    uniforms.uNearRect.value.copy(imagery.nearRect);
    uniforms.uImageryShade.value = imagery.shade;
  });

  useEffect(
    () => invalidate(),
    [geometry, material, exaggeration, light, showHistory, imagery.far, imagery.near, invalidate],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  return <mesh ref={meshRef} geometry={geometry} material={material} frustumCulled={false} />;
}
