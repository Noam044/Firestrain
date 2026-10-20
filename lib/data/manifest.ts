import manifestJson from "@/public/data/manifest.json";
import { ManifestSchema, type ManifestEntry } from "./schemas.ts";

/** Provenance of the published data files, validated at build time (server only). */
export const manifest = ManifestSchema.parse(manifestJson);

export type Credit = {
  label: string;
  source: string;
  licence: string;
  licenceUrl: string;
  retrievedAt: string;
};

function entry(path: string): ManifestEntry {
  const found = manifest.files[path];
  if (!found) throw new Error(`${path} est absent de public/data/manifest.json`);
  return found;
}

/** "IGN — BD ALTI® (Géoplateforme, …)" → "IGN — BD ALTI®". */
const shortSource = (source: string) => source.split(" (")[0].split(",")[0];

function credit(label: string, path: string): Credit {
  const e = entry(path);
  return {
    label,
    source: shortSource(e.source),
    licence: e.licence,
    licenceUrl: e.licenceUrl,
    retrievedAt: e.retrievedAt,
  };
}

/** Credits printed at the foot of the map, as on a printed sheet. */
export function mapCredits(): Credit[] {
  return [
    credit("Relief", "terrain/dem-500m.bin"),
    credit("Limites administratives", "admin/departements-lignes.json"),
  ];
}
