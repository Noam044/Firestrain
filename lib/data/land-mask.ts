import { SCENE_SIZE } from "../geo/frame.ts";
import type { FranceOutline } from "./schemas.ts";

export type LandMask = {
  /** White inside metropolitan France, black elsewhere; uploaded as a texture. */
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  /** 1 inside France, 0 outside — same grid as the DEM (row 0 = north). */
  inside: Uint8Array;
};

/** Rasterises the ADMIN EXPRESS outline onto the DEM grid (browser only). */
export function rasterizeLandMask(outline: FranceOutline, width: number, height: number): LandMask {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas 2D indisponible");

  context.fillStyle = "#000";
  context.fillRect(0, 0, width, height);
  const sx = width / SCENE_SIZE.width;
  const sz = height / SCENE_SIZE.depth;
  context.beginPath();
  for (const ring of outline.rings) {
    for (let k = 0; k < ring.length; k += 2) {
      const px = (ring[k] + SCENE_SIZE.width / 2) * sx;
      const py = (ring[k + 1] + SCENE_SIZE.depth / 2) * sz;
      if (k === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.closePath();
  }
  context.fillStyle = "#fff";
  context.fill("evenodd");

  const rgba = context.getImageData(0, 0, width, height).data;
  const inside = new Uint8Array(width * height);
  for (let k = 0; k < inside.length; k++) inside[k] = rgba[k * 4] >= 128 ? 1 : 0;
  return { canvas, width, height, inside };
}
