/// Decodes the fs-dem-1 heightmap off the main thread.
import { codeToMeters, decodeCodes, type Quantization } from "./heightmap-codec.ts";
import { extendIntoNoData } from "./fill.ts";
import { toHalfFloat } from "./half-float.ts";
import { mipPyramid } from "./mipmaps.ts";

export type TerrainWorkerRequest = {
  buffer: ArrayBuffer;
  width: number;
  height: number;
  quantization: Quantization;
  fillRadius: number;
};

/** One mip level of the GPU texture: interleaved binary16 [height, has-altitude]. */
export type GpuLevel = { width: number; height: number; data: Uint16Array };

export type TerrainWorkerResponse =
  | { meters: Float32Array; levels: GpuLevel[] }
  | { error: string };

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<TerrainWorkerRequest>) => void) | null;
  postMessage: (message: TerrainWorkerResponse, transfer?: Transferable[]) => void;
};

/** Hosts may already have removed the gzip layer (Content-Encoding): check the magic bytes. */
async function gunzipIfNeeded(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes;
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

scope.onmessage = async ({ data }) => {
  try {
    const planes = await gunzipIfNeeded(new Uint8Array(data.buffer));
    const codes = decodeCodes(planes, data.width, data.height);
    const n = codes.length;
    const meters = new Float32Array(n);
    for (let k = 0; k < n; k++) meters[k] = codeToMeters(codes[k], data.quantization);

    const extended = extendIntoNoData(meters, data.width, data.height, data.fillRadius);
    const hasAltitude = new Float32Array(n);
    for (let k = 0; k < n; k++) hasAltitude[k] = Number.isNaN(meters[k]) ? 0 : 1;

    // Half-float textures cannot get GPU-generated mipmaps in WebGL 2, so the
    // pyramid is built here; without it the hillshade aliases when zoomed out.
    const levels = mipPyramid([extended, hasAltitude], data.width, data.height).map(
      ({ width, height, channels: [h, a] }) => {
        const out = new Uint16Array(width * height * 2);
        for (let k = 0; k < width * height; k++) {
          out[2 * k] = toHalfFloat(h[k]);
          out[2 * k + 1] = toHalfFloat(a[k]);
        }
        return { width, height, data: out };
      },
    );
    scope.postMessage({ meters, levels }, [meters.buffer, ...levels.map((l) => l.data.buffer)]);
  } catch (error) {
    scope.postMessage({ error: String(error) });
  }
};
