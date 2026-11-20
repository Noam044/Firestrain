import { useThree } from "@react-three/fiber";
import type CameraControlsImpl from "camera-controls";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { L93_TILES, basemapById, farImagePath, tileMetres, tileUrl, type BasemapId } from "@/lib/geo/basemaps";
import { L93_EXTENT, SCENE_SIZE, l93ToScene, sceneToL93 } from "@/lib/geo/frame";

/**
 * Imagery draped on the relief: a whole-France image served by the site (on
 * screen at once), and a sharp mosaic of the Géoplateforme's Lambert-93 tiles
 * around the camera target, built when the camera comes to rest — centre tiles
 * first, each drawn as soon as it arrives, already-seen tiles from memory.
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
/** Tile requests in flight at once (HTTP/2 to the Géoplateforme). */
const CONCURRENCY = 12;
/** Decoded tiles kept in memory, most recently used last. */
const CACHE_SIZE = 600;
const tileCache = new Map<string, ImageBitmap>();

function cacheTile(url: string, bitmap: ImageBitmap) {
  tileCache.delete(url);
  tileCache.set(url, bitmap);
  if (tileCache.size > CACHE_SIZE) {
    const [oldest, image] = tileCache.entries().next().value as [string, ImageBitmap];
    tileCache.delete(oldest);
    image.close();
  }
}

async function loadBitmap(url: string, signal: AbortSignal): Promise<ImageBitmap> {
  const response = await fetch(url, { signal });
  if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) {
    throw new Error(`fond de carte : HTTP ${response.status}`);
  }
  return createImageBitmap(await response.blob());
}

/** A texture aligned with the scene (row 0 = north), values passed through unchanged. */
function sceneTexture<T extends THREE.Texture>(texture: T, anisotropy: number): T {
  texture.flipY = false;
  // The canvas renders linearly without output conversion: image values pass through unchanged.
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
}

/** Lambert-93 box of a mosaic: [west, north, east, south], metres. */
type Box = [number, number, number, number];
type Mosaic = { key: string; canvas: HTMLCanvasElement; box: Box };

export function useImagery(basemapId: BasemapId, enabled: boolean, light: boolean): Imagery {
  const controls = useThree((state) => state.controls) as unknown as CameraControlsImpl | null;
  const anisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());
  const invalidate = useThree((state) => state.invalidate);
  const basemap = basemapById(basemapId);
  const active = enabled && basemap.ign !== undefined;
  const [far, setFar] = useState<THREE.Texture | null>(null);
  const [near, setNear] = useState<{ texture: THREE.Texture; rect: THREE.Vector4 } | null>(null);
  const mosaic = useRef<Mosaic | null>(null);

  // Whole-France image, one per base map, from the site.
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    let texture: THREE.Texture | null = null;
    loadBitmap(`/data/${farImagePath(basemapId)}`, controller.signal)
      .then((bitmap) => {
        texture = sceneTexture(new THREE.Texture(bitmap), anisotropy);
        setFar(texture);
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
  }, [active, basemapId, anisotropy, invalidate]);

  // Sharp mosaic around the camera target, rebuilt when the camera rests.
  useEffect(() => {
    const ign = basemap.ign;
    if (!active || !controls || !ign) return;
    let controller: AbortController | null = null;
    let timer = 0;
    let flush = 0;
    let current: THREE.CanvasTexture | null = null;
    const target = new THREE.Vector3();

    const refresh = () => {
      controls.getTarget(target);
      // Half-width of the area: the visible ground around the target, including the
      // foreground of oblique views (fov 30°: the view spans ≈ 0.55 × distance vertically).
      const half = Math.max(3, controls.distance * 0.6);
      if (half > 300) {
        // Whole-country views: the France image is enough.
        mosaic.current = null;
        setNear(null);
        return;
      }
      // Tile level whose resolution is closest to the image size wanted over the area.
      const metresPerPixel = (2 * half * 1000) / (light ? 1536 : 2048);
      const level = Math.min(ign.maxLevel, Math.max(L93_TILES.minLevel, Math.round(6 + Math.log2(3276.8 / metresPerPixel))));
      const size = tileMetres(level);
      const [cx, cy] = sceneToL93({ x: target.x, z: target.z });
      const west = Math.max(L93_EXTENT.xmin, cx - half * 1000);
      const east = Math.min(L93_EXTENT.xmax, cx + half * 1000);
      const south = Math.max(L93_EXTENT.ymin, cy - half * 1000);
      const north = Math.min(L93_EXTENT.ymax, cy + half * 1000);
      if (east <= west || north <= south) return;
      const c0 = Math.floor((west - L93_TILES.originX) / size);
      const c1 = Math.floor((east - L93_TILES.originX) / size);
      const r0 = Math.floor((L93_TILES.originY - north) / size);
      const r1 = Math.floor((L93_TILES.originY - south) / size);
      const key = `${basemapId}:${level}:${c0}:${r0}:${c1}:${r1}`;
      if (key === mosaic.current?.key) return;

      const box: Box = [
        L93_TILES.originX + c0 * size,
        L93_TILES.originY - r0 * size,
        L93_TILES.originX + (c1 + 1) * size,
        L93_TILES.originY - (r1 + 1) * size,
      ];
      const canvas = document.createElement("canvas");
      canvas.width = (c1 - c0 + 1) * L93_TILES.size;
      canvas.height = (r1 - r0 + 1) * L93_TILES.size;
      const context = canvas.getContext("2d");
      if (!context) return;
      // The previous mosaic, rescaled, until the new tiles cover it: no flash back to the blurry image.
      const previous = mosaic.current;
      if (previous) {
        const sx = canvas.width / (box[2] - box[0]);
        const sy = canvas.height / (box[1] - box[3]);
        context.drawImage(
          previous.canvas,
          (previous.box[0] - box[0]) * sx,
          (box[1] - previous.box[1]) * sy,
          (previous.box[2] - previous.box[0]) * sx,
          (previous.box[1] - previous.box[3]) * sy,
        );
      }
      mosaic.current = { key, canvas, box };

      const texture = sceneTexture(new THREE.CanvasTexture(canvas), anisotropy);
      // Transparent where no tile has arrived yet: the shader shows the France image there.
      texture.premultiplyAlpha = true;
      const nw = l93ToScene([box[0], box[1]]);
      const se = l93ToScene([box[2], box[3]]);
      const rect = new THREE.Vector4(
        nw.x / SCENE_SIZE.width + 0.5,
        nw.z / SCENE_SIZE.depth + 0.5,
        se.x / SCENE_SIZE.width + 0.5,
        se.z / SCENE_SIZE.depth + 0.5,
      );
      window.clearTimeout(flush);
      flush = 0;
      current?.dispose();
      current = texture;
      setNear({ texture, rect });
      invalidate();

      // Uploads are grouped: one texture update for the tiles of the last ~100 ms.
      const draw = (row: number, col: number, bitmap: ImageBitmap) => {
        context.drawImage(bitmap, (col - c0) * L93_TILES.size, (row - r0) * L93_TILES.size);
        if (flush) return;
        flush = window.setTimeout(() => {
          flush = 0;
          texture.needsUpdate = true;
          invalidate();
        }, 100);
      };
      // Centre tiles first.
      const centreCol = (cx - L93_TILES.originX) / size;
      const centreRow = (L93_TILES.originY - cy) / size;
      const distance = ([row, col]: [number, number]) => Math.hypot(row + 0.5 - centreRow, col + 0.5 - centreCol);
      const tiles: [number, number][] = [];
      for (let row = r0; row <= r1; row++) for (let col = c0; col <= c1; col++) tiles.push([row, col]);
      tiles.sort((a, b) => distance(a) - distance(b));
      const missing = tiles.filter(([row, col]) => {
        const cached = tileCache.get(tileUrl(ign.tiles, level, row, col));
        if (cached) draw(row, col, cached);
        return !cached;
      });

      controller?.abort();
      const own = new AbortController();
      controller = own;
      let next = 0;
      const worker = async () => {
        while (next < missing.length && !own.signal.aborted) {
          const [row, col] = missing[next++];
          const url = tileUrl(ign.tiles, level, row, col);
          // A second try after a short pause: the Géoplateforme occasionally fails a tile in a burst.
          for (let attempt = 0; attempt < 2 && !own.signal.aborted; attempt++) {
            try {
              const bitmap = await loadBitmap(url, own.signal);
              cacheTile(url, bitmap);
              if (!own.signal.aborted) draw(row, col, bitmap);
              break;
            } catch {
              // Aborted by a newer view, or no tile there (sea, outside France): the France image shows.
              if (attempt === 0) await new Promise((resolve) => window.setTimeout(resolve, 400));
            }
          }
        }
      };
      for (let k = 0; k < CONCURRENCY; k++) void worker();
    };
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(refresh, 150);
    };
    controls.addEventListener("rest", schedule);
    schedule();
    return () => {
      controls.removeEventListener("rest", schedule);
      window.clearTimeout(timer);
      window.clearTimeout(flush);
      controller?.abort();
      current?.dispose();
      mosaic.current = null;
      setNear(null);
    };
  }, [active, controls, basemap, basemapId, light, anisotropy, invalidate]);

  if (!active) return NO_IMAGERY;
  return { far, near: near?.texture ?? null, nearRect: near?.rect ?? NO_IMAGERY.nearRect, shade: basemap.shade };
}
