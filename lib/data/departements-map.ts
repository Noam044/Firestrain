import { SCENE_SIZE } from "../geo/frame.ts";
import { bboxContains, pointInRings, type BBox, type FlatRing } from "../geo/polygon.ts";
import { slugify } from "../slug.ts";
import { useMapStore } from "../store.ts";

/**
 * The départements as map shapes: the 2D map's outlines (Lambert-93 km, SVG
 * frame) turned into scene rings, for the 3D map's hover and selection and the
 * département mask the relief is lifted with. Index 1–96 (0 = none).
 */
export type MapDepartement = {
  index: number;
  code: string;
  nom: string;
  slug: string;
  /** Scene km, [x0, z0, x1, z1]. */
  bbox: BBox;
  /** Closed rings, flat [x, z, …] in scene km (outer rings and islands). */
  rings: FlatRing[];
};

type Outline = { code: string; nom: string; d: string };

/** "M1 2L3 4Z M…" → one flat ring per sub-path, moved from the SVG frame to the scene's centre. */
function parseRings(d: string): FlatRing[] {
  const rings: FlatRing[] = [];
  for (const part of d.split("M").slice(1)) {
    const numbers = part.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    const ring = new Float32Array(numbers.length);
    for (let k = 0; k + 1 < numbers.length; k += 2) {
      ring[k] = numbers[k] - SCENE_SIZE.width / 2;
      ring[k + 1] = numbers[k + 1] - SCENE_SIZE.depth / 2;
    }
    if (ring.length >= 6) rings.push(ring);
  }
  return rings;
}

/** The last list built, so a "back" button can frame the chosen département without loading anything. */
let known: MapDepartement[] = [];

export function mapDepartements(features: readonly Outline[]): MapDepartement[] {
  known = features.map((feature, k) => {
    const rings = parseRings(feature.d);
    let [x0, z0, x1, z1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i += 2) {
        x0 = Math.min(x0, ring[i]);
        x1 = Math.max(x1, ring[i]);
        z0 = Math.min(z0, ring[i + 1]);
        z1 = Math.max(z1, ring[i + 1]);
      }
    }
    return { index: k + 1, code: feature.code, nom: feature.nom, slug: slugify(feature.nom), bbox: [x0, z0, x1, z1], rings };
  });
  return known;
}

/**
 * Back from a fire: the camera returns one level up, to the chosen département
 * when there is one, else to the whole of France.
 */
export function zoomBack() {
  const { departement, requestCamera } = useMapStore.getState();
  const framed = departement ? known.find((d) => d.slug === departement) : undefined;
  requestCamera(framed ? { kind: "bbox", bbox: framed.bbox } : { kind: "preset", preset: "france" });
}

/** Département under a scene point, if any. */
export function departementAt(list: readonly MapDepartement[], x: number, z: number): MapDepartement | null {
  for (const departement of list) {
    if (bboxContains(departement.bbox, x, z) && pointInRings(x, z, departement.rings)) return departement;
  }
  return null;
}

/** EFFIS names the département of each fire: matched by slug ("Côtes-d’Armor" = "Côtes-d'Armor"). */
export const inDepartement = (province: string, slug: string) => slugify(province) === slug;
