import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** Raw downloads, kept out of git; re-fetched with `--refresh`. */
export const RAW_DIR = join(import.meta.dirname, "..", "..", "data", "raw");

const USER_AGENT = "FireStrain data pipeline (personal non-commercial project)";

export const refreshRequested = process.argv.includes("--refresh");

export type Fetched = {
  body: Buffer;
  url: string;
  contentType: string;
  /** When the body was actually downloaded — preserved when served from cache. */
  retrievedAt: string;
  fromCache: boolean;
};

type CacheMeta = { url: string; retrievedAt: string; contentType: string };

/**
 * GET `url`, caching the body under data/raw/<cacheName> together with the
 * download date, so provenance stays truthful when the cache is reused.
 */
export async function fetchCached(
  url: string,
  cacheName: string,
  { refresh = false, accept }: { refresh?: boolean; accept?: RegExp } = {},
): Promise<Fetched> {
  const bodyPath = join(RAW_DIR, cacheName);
  const metaPath = `${bodyPath}.meta.json`;

  if (!refresh) {
    try {
      const meta = JSON.parse(await readFile(metaPath, "utf8")) as CacheMeta;
      if (meta.url === url) {
        return { body: await readFile(bodyPath), ...meta, fromCache: true };
      }
    } catch {
      // Not cached yet.
    }
  }

  const attempts = 4;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(300_000),
      });
      const contentType = response.headers.get("content-type") ?? "";
      const body = Buffer.from(await response.arrayBuffer());
      const excerpt = body.subarray(0, 300).toString("utf8");
      if (!response.ok) throw new Error(`HTTP ${response.status} — ${excerpt}`);
      if (accept && !accept.test(contentType)) {
        throw new Error(`unexpected content-type "${contentType}" — ${excerpt}`);
      }
      const meta: CacheMeta = { url, retrievedAt: new Date().toISOString(), contentType };
      await mkdir(RAW_DIR, { recursive: true });
      await writeFile(bodyPath, body);
      await writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
      return { body, ...meta, fromCache: false };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        const delay = 2 ** attempt * 1000;
        console.warn(`  attempt ${attempt} failed (${String(error).slice(0, 160)}); retry in ${delay / 1000} s`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw new Error(`could not download ${url}`, { cause: lastError });
}
