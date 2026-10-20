import { useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { SCENE_SIZE } from "@/lib/geo/frame";
import { fireTimelineDay, type DecodedFire } from "@/lib/data/fires";
import { burnMaskFragmentShader, burnMaskVertexShader } from "./shaders";

/**
 * Burnt areas are not extruded over the relief (z-fighting, "video game" look):
 * they are rasterised on the GPU into a texture aligned with the heightmap and
 * draped by the terrain shader. Channels:
 *   R  coverage of the year shown
 *   G  coverage of the earlier years (hatched)
 *   B  high byte of the timeline day of first detection (1 = 1 January)
 *   A  low byte of that day
 * The year shown is drawn without blending, latest fire first, so the earliest
 * detection wins where outlines overlap; the earlier years are then added with
 * MAX blending, which only touches G.
 */

const geometries = new WeakMap<readonly DecodedFire[], THREE.BufferGeometry>();

/** Triangulated outlines of a set of fires, cached per (immutable) query result. */
function fireGeometry(fires: readonly DecodedFire[]): THREE.BufferGeometry {
  const cached = geometries.get(fires);
  if (cached) return cached;
  const positions: number[] = [];
  const values: number[] = [];
  const latestFirst = [...fires].sort((a, b) => fireTimelineDay(b) - fireTimelineDay(a));
  for (const fire of latestFirst) {
    const value = fireTimelineDay(fire);
    for (const shape of fire.shapes) {
      const toPoints = (ring: Float32Array) => {
        const points: THREE.Vector2[] = [];
        for (let k = 0; k < ring.length; k += 2) points.push(new THREE.Vector2(ring[k], ring[k + 1]));
        return points;
      };
      const contour = toPoints(shape[0]);
      const holes = shape.slice(1).map(toPoints);
      // triangulateShape may reorder the arrays in place: read the points afterwards.
      const faces = THREE.ShapeUtils.triangulateShape(contour, holes);
      const points = contour.concat(...holes);
      for (const face of faces) {
        for (const index of face) {
          positions.push(points[index].x, 0, points[index].y);
          values.push(value);
        }
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aValue", new THREE.Float32BufferAttribute(values, 1));
  geometries.set(fires, geometry);
  return geometry;
}

function maskMaterial(history: boolean) {
  return new THREE.ShaderMaterial({
    vertexShader: burnMaskVertexShader,
    fragmentShader: burnMaskFragmentShader,
    uniforms: {
      uHalfSize: { value: new THREE.Vector2(SCENE_SIZE.width / 2, SCENE_SIZE.depth / 2) },
      uHistory: { value: history ? 1 : 0 },
    },
    ...(history
      ? {
          blending: THREE.CustomBlending,
          blendEquation: THREE.MaxEquation,
          blendSrc: THREE.OneFactor,
          blendDst: THREE.OneFactor,
        }
      : { blending: THREE.NoBlending }),
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

const maskCamera = new THREE.OrthographicCamera();

export function useBurnMask(
  current: readonly DecodedFire[] | undefined,
  history: readonly (readonly DecodedFire[])[],
  size: { width: number; height: number },
): THREE.Texture {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);

  const target = useMemo(() => {
    const scale = Math.min(1, gl.capabilities.maxTextureSize / Math.max(size.width, size.height));
    return new THREE.WebGLRenderTarget(Math.floor(size.width * scale), Math.floor(size.height * scale), {
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
    });
  }, [gl, size.width, size.height]);
  useEffect(() => () => target.dispose(), [target]);

  const materials = useMemo(() => ({ current: maskMaterial(false), history: maskMaterial(true) }), []);
  useEffect(
    () => () => {
      materials.current.dispose();
      materials.history.dispose();
    },
    [materials],
  );

  useLayoutEffect(() => {
    const scene = new THREE.Scene();
    // The year shown first, without blending, then the history MAX-blended into G.
    const add = (geometry: THREE.BufferGeometry, material: THREE.Material) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      mesh.renderOrder = scene.children.length;
      scene.add(mesh);
    };
    if (current) add(fireGeometry(current), materials.current);
    for (const fires of history) add(fireGeometry(fires), materials.history);

    const previousTarget = gl.getRenderTarget();
    const previousColor = gl.getClearColor(new THREE.Color());
    const previousAlpha = gl.getClearAlpha();
    gl.setRenderTarget(target);
    gl.setClearColor(0x000000, 0);
    gl.clear(true, false, false);
    gl.render(scene, maskCamera);
    gl.setRenderTarget(previousTarget);
    gl.setClearColor(previousColor, previousAlpha);
    invalidate();
  }, [gl, target, current, history, materials, invalidate]);

  return target.texture;
}
