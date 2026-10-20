import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  ManifestSchema,
  type Manifest,
  type ManifestEntry,
} from "../../lib/data/schemas.ts";

export const PUBLIC_DATA_DIR = join(import.meta.dirname, "..", "..", "public", "data");
const MANIFEST_PATH = join(PUBLIC_DATA_DIR, "manifest.json");

export type Provenance = Omit<ManifestEntry, "bytes" | "sha256">;

export const IGN_OPEN_LICENCE = {
  licence: "Licence Ouverte Etalab 2.0",
  licenceUrl: "https://www.etalab.gouv.fr/licence-ouverte-open-licence/",
} as const;

async function readManifest(): Promise<Manifest> {
  try {
    return ManifestSchema.parse(JSON.parse(await readFile(MANIFEST_PATH, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { schemaVersion: 1, updatedAt: new Date().toISOString(), files: {} };
    }
    throw error;
  }
}

/** Write a file under public/data and record its provenance in manifest.json. */
export async function writeDataFile(
  relativePath: string,
  content: Buffer | string,
  provenance: Provenance,
): Promise<ManifestEntry> {
  const bytes = typeof content === "string" ? Buffer.from(content, "utf8") : content;
  const absolute = join(PUBLIC_DATA_DIR, relativePath);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, bytes);

  const entry: ManifestEntry = {
    ...provenance,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
  const manifest = await readManifest();
  manifest.files[relativePath] = entry;
  manifest.files = Object.fromEntries(
    Object.entries(manifest.files).sort(([a], [b]) => a.localeCompare(b)),
  );
  manifest.updatedAt = new Date().toISOString();
  await writeFile(MANIFEST_PATH, `${JSON.stringify(ManifestSchema.parse(manifest), null, 2)}\n`);
  return entry;
}
