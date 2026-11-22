"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { SCENE_SIZE } from "@/lib/geo/frame";
import type { MapDepartement } from "@/lib/data/departements-map";
import { useMapStore } from "@/lib/store";
import { drapedLineMaterial, segmentGeometry } from "./drapedLines";

/**
 * The départements in the 3D map: a mask texture holding each département's
 * index (the relief lifts and lights the hovered one, see shaders.ts), the
 * eased values of the hover, and the glowing outline of the hovered or chosen
 * département.
 */

/**
 * Height the hovered département rises to, in scene km: a share of the ground
 * covered by 100 px at the centre, so the lift reads the same at every zoom.
 */
const liftKmFor = (kmPer100px: number | null) => Math.min(30, Math.max(1.5, (kmPer100px ?? 100) * 0.14));

const maskVertexShader = /* glsl */ `
uniform vec2 uHalfSize;
attribute float aValue;
varying float vValue;
void main() {
  vValue = aValue;
  gl_Position = vec4(position.x / uHalfSize.x, position.z / uHalfSize.y, 0.0, 1.0);
}
`;
const maskFragmentShader = /* glsl */ `
varying float vValue;
void main() {
  gl_FragColor = vec4(vValue / 255.0, 0.0, 0.0, 1.0);
}
`;

const maskCamera = new THREE.OrthographicCamera();

/**
 * Index of the département at every point of the map, rendered once on the GPU
 * without antialiasing (an edge pixel never mixes two indices). Larger
 * départements first, so an enclave drawn inside another one wins.
 */
export function useDepartementMask(list: readonly MapDepartement[] | null, size: { width: number; height: number }) {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const target = useMemo(
    () =>
      new THREE.WebGLRenderTarget(size.width, size.height, {
        depthBuffer: false,
        stencilBuffer: false,
        generateMipmaps: false,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
      }),
    [size.width, size.height],
  );
  useEffect(() => () => target.dispose(), [target]);

  useLayoutEffect(() => {
    const previousTarget = gl.getRenderTarget();
    const previousColor = gl.getClearColor(new THREE.Color());
    const previousAlpha = gl.getClearAlpha();
    gl.setRenderTarget(target);
    gl.setClearColor(0x000000, 0);
    gl.clear(true, false, false);
    if (list) {
      const positions: number[] = [];
      const values: number[] = [];
      const area = (d: MapDepartement) => (d.bbox[2] - d.bbox[0]) * (d.bbox[3] - d.bbox[1]);
      for (const departement of [...list].sort((a, b) => area(b) - area(a))) {
        for (const ring of departement.rings) {
          const contour: THREE.Vector2[] = [];
          for (let k = 0; k < ring.length; k += 2) contour.push(new THREE.Vector2(ring[k], ring[k + 1]));
          for (const face of THREE.ShapeUtils.triangulateShape(contour, [])) {
            for (const index of face) {
              positions.push(contour[index].x, 0, contour[index].y);
              values.push(departement.index);
            }
          }
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute("aValue", new THREE.Float32BufferAttribute(values, 1));
      const material = new THREE.ShaderMaterial({
        vertexShader: maskVertexShader,
        fragmentShader: maskFragmentShader,
        uniforms: { uHalfSize: { value: new THREE.Vector2(SCENE_SIZE.width / 2, SCENE_SIZE.depth / 2) } },
        blending: THREE.NoBlending,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      const scene = new THREE.Scene();
      scene.add(mesh);
      gl.render(scene, maskCamera);
      geometry.dispose();
      material.dispose();
    }
    gl.setRenderTarget(previousTarget);
    gl.setClearColor(previousColor, previousAlpha);
    invalidate();
  }, [gl, target, list, invalidate]);

  return target.texture;
}

/** Eased values the relief and the outline read every frame. */
export type DepartementEase = {
  /** 0 → 1 as the mode turns on. */
  mode: number;
  /** Index lifted (the hovered one, or the one coming down). */
  liftIndex: number;
  /** 0 → 1 as it rises. */
  lift: number;
  /** Full height of the lift for the current zoom, in scene km. */
  liftKm: number;
};

const approach = (value: number, target: number, delta: number, seconds: number) =>
  value + (target - value) * (1 - Math.exp(-delta / seconds));

/** Eases the mode and the lift towards the store; keeps drawing frames while they move. */
export function useDepartementEase(): RefObject<DepartementEase> {
  const ease = useRef<DepartementEase>({ mode: 0, liftIndex: 0, lift: 0, liftKm: liftKmFor(null) });
  const invalidate = useThree((state) => state.invalidate);
  const reduce = useRef(false);
  useEffect(() => {
    reduce.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);
  useFrame((_, delta) => {
    const { departementsMode, hoverDepartement, kmPer100px } = useMapStore.getState();
    const state = ease.current;
    state.liftKm = liftKmFor(kmPer100px);
    const hovered = departementsMode && hoverDepartement ? hoverDepartement.index : 0;
    // A new département starts rising from the ground.
    if (hovered && hovered !== state.liftIndex) {
      state.liftIndex = hovered;
      state.lift = 0;
    }
    const targets = { mode: departementsMode ? 1 : 0, lift: hovered ? 1 : 0 };
    if (reduce.current) {
      state.mode = targets.mode;
      state.lift = targets.lift;
      return;
    }
    const step = Math.min(delta, 0.1);
    state.mode = approach(state.mode, targets.mode, step, 0.12);
    state.lift = approach(state.lift, targets.lift, step, 0.07);
    if (Math.abs(state.mode - targets.mode) > 0.002 || Math.abs(state.lift - targets.lift) > 0.002) invalidate();
  });
  return ease;
}

/** Glowing outline of a département, raised with it while it is lifted. */
export function DepartementOutline({
  departement,
  heightTexture,
  exaggeration,
  maxSegmentKm,
  ease,
}: {
  departement: MapDepartement;
  heightTexture: THREE.Texture;
  exaggeration: number;
  maxSegmentKm: number;
  ease: RefObject<DepartementEase>;
}) {
  const geometry = useMemo(() => segmentGeometry(departement.rings, maxSegmentKm, true), [departement, maxSegmentKm]);
  const material = useMemo(() => drapedLineMaterial(heightTexture, exaggeration, "--signal", 0.95), [heightTexture, exaggeration]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  const lineRef = useRef<THREE.LineSegments>(null);
  useFrame(() => {
    const line = lineRef.current;
    if (!line) return;
    const { liftIndex, lift, liftKm } = ease.current;
    (line.material as THREE.ShaderMaterial).uniforms.uRaise.value = liftIndex === departement.index ? lift * liftKm : 0;
  });
  return <lineSegments ref={lineRef} geometry={geometry} material={material} frustumCulled={false} renderOrder={3} />;
}
