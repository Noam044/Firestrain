import { useThree } from "@react-three/fiber";
import type CameraControlsImpl from "camera-controls";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { basemapById, wmsUrl, type BasemapId } from "@/lib/geo/basemaps";
import { L93_EXTENT, SCENE_SIZE, sceneToL93 } from "@/lib/geo/frame";

/**
 * Imagery draped on the relief: a whole-France image (≈ 570 m per pixel on
 * desktop) always available, and a sharp image of the area around the camera
 * target, requested once the camera comes to rest — like map tiles, with a
 * single WMS image in the scene's own projection.
 */
export type Imagery = {
  far: THREE.Texture | null;
  near: THREE.Texture | null;
  /** Texture coordinates of the near image in the scene: (u0, v0, u1, v1), v = 0 at the north edge. */
  nearRect: THREE.Vector4;
  /** Hillshading laid over the image (0–1). */
  shade: number;
};

const NO_IMAGERY: Imagery = { far: null, near: null, nearRect: new THREE.Vector4(0, 0, 0, 0), shade: 0 };

/** Fetches and decodes an image off the main thread, as a texture aligned with the scene (row 0 = north). */
async function loadTexture(url: string, anisotropy: number, signal: AbortSignal): Promise<THREE.Texture> {
  const response = await fetch(url, { signal });
  if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) {
    throw new Error(`fond de carte : HTTP ${response.status}`);
  }
  const bitmap = await createImageBitmap(await response.blob());
  const texture = new THREE.Texture(bitmap);
  texture.flipY = false;
  // The canvas renders linearly without output conversion: image values pass through unchanged.
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
}

/** Whole-France image, in the scene extent. */
const farUrl = (id: BasemapId, light: boolean) => {
  const width = light ? 1536 : 2048;
  const height = Math.round((width * SCENE_SIZE.depth) / SCENE_SIZE.width);
  return wmsUrl(basemapById(id), [L93_EXTENT.xmin, L93_EXTENT.ymin], [L93_EXTENT.xmax, L93_EXTENT.ymax], width, height);
};

export function useImagery(basemapId: BasemapId, enabled: boolean, light: boolean): Imagery {
  const controls = useThree((state) => state.controls) as unknown as CameraControlsImpl | null;
  const anisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());
  const invalidate = useThree((state) => state.invalidate);
  const basemap = basemapById(basemapId);
  const active = enabled && basemap.layer !== undefined;
  const [far, setFar] = useState<THREE.Texture | null>(null);
  const [near, setNear] = useState<{ texture: THREE.Texture; rect: THREE.Vector4 } | null>(null);
  const nearKey = useRef("");

  // Whole-France image, one per base map.
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    let texture: THREE.Texture | null = null;
    loadTexture(farUrl(basemapId, light), anisotropy, controller.signal)
      .then((loaded) => {
        texture = loaded;
        setFar(loaded);
        invalidate();
      })
      .catch(() => {
        // Aborted or unavailable: the relief stays visible underneath.
      });
    return () => {
      controller.abort();
      setFar(null);
      texture?.dispose();
    };
  }, [active, basemapId, light, anisotropy, invalidate]);

  // Sharp image around the camera target, refreshed when the camera rests.
  useEffect(() => {
    if (!active || !controls) return;
    let controller: AbortController | null = null;
    let timer = 0;
    let current: THREE.Texture | null = null;
    const target = new THREE.Vector3();
    const refresh = () => {
      controls.getTarget(target);
      // Half-width of the area: the visible ground around the target, including the
      // foreground of oblique views (fov 30°: the view spans ≈ 0.55 × distance vertically).
      const half = Math.max(3, controls.distance * 0.6);
      if (half > 300) {
        // Whole-country views: the France image is enough.
        nearKey.current = "";
        setNear(null);
        return;
      }
      const step = half / 4; // reuse the image for small moves
      const cx = Math.round(target.x / step) * step;
      const cz = Math.round(target.z / step) * step;
      const key = `${basemapId}:${cx}:${cz}:${half.toFixed(1)}`;
      if (key === nearKey.current) return;
      nearKey.current = key;
      const x0 = Math.max(-SCENE_SIZE.width / 2, cx - half);
      const x1 = Math.min(SCENE_SIZE.width / 2, cx + half);
      const z0 = Math.max(-SCENE_SIZE.depth / 2, cz - half);
      const z1 = Math.min(SCENE_SIZE.depth / 2, cz + half);
      if (x1 <= x0 || z1 <= z0) return;
      const size = light ? 1536 : 2560;
      const aspect = (x1 - x0) / (z1 - z0);
      const width = aspect >= 1 ? size : Math.round(size * aspect);
      const height = aspect >= 1 ? Math.round(size / aspect) : size;
      const url = wmsUrl(basemap, sceneToL93({ x: x0, z: z1 }), sceneToL93({ x: x1, z: z0 }), width, height);
      const rect = new THREE.Vector4(
        x0 / SCENE_SIZE.width + 0.5,
        z0 / SCENE_SIZE.depth + 0.5,
        x1 / SCENE_SIZE.width + 0.5,
        z1 / SCENE_SIZE.depth + 0.5,
      );
      controller?.abort();
      controller = new AbortController();
      loadTexture(url, anisotropy, controller.signal)
        .then((texture) => {
          current?.dispose();
          current = texture;
          setNear({ texture, rect });
          invalidate();
        })
        .catch(() => {
          // Aborted by a newer request, or unavailable: the France image stays.
          if (nearKey.current === key) nearKey.current = "";
        });
    };
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(refresh, 250);
    };
    controls.addEventListener("rest", schedule);
    schedule();
    return () => {
      controls.removeEventListener("rest", schedule);
      window.clearTimeout(timer);
      controller?.abort();
      current?.dispose();
      nearKey.current = "";
      setNear(null);
    };
  }, [active, controls, basemap, basemapId, light, anisotropy, invalidate]);

  if (!active) return NO_IMAGERY;
  return { far, near: near?.texture ?? null, nearRect: near?.rect ?? NO_IMAGERY.nearRect, shade: basemap.shade };
}
