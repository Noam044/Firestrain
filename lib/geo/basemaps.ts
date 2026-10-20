/**
 * Base maps under the burnt areas: the atlas relief (computed in the shader) or
 * an IGN Géoplateforme layer, requested by WMS directly in Lambert-93 so that
 * images line up with the scene without reprojection. No key; CORS allowed.
 */
import type { L93 } from "./frame.ts";

export type BasemapId = "relief" | "plan" | "satellite" | "ortho";

export type Basemap = {
  id: BasemapId;
  label: string;
  /** WMS layer name, absent for the relief drawn by the terrain shader. */
  layer?: string;
  format?: "image/jpeg" | "image/png";
  /** How much hillshading is laid over the image (0: none). */
  shade: number;
  source?: {
    name: string;
    fullName: string;
    licence: string;
    licenceUrl: string;
    url: string;
    note: string;
  };
};

const LICENCE_OUVERTE = {
  licence: "Licence Ouverte 2.0",
  licenceUrl: "https://www.etalab.gouv.fr/licence-ouverte-open-licence/",
} as const;

export const BASEMAPS: readonly Basemap[] = [
  { id: "relief", label: "Relief", shade: 0 },
  {
    id: "plan",
    label: "Plan",
    layer: "GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2",
    format: "image/jpeg",
    shade: 0.35,
    source: {
      name: "IGN",
      fullName: "IGN — Plan IGN (cartographie multi-échelles issue des bases vecteur de l’IGN)",
      ...LICENCE_OUVERTE,
      url: "https://cartes.gouv.fr/rechercher-une-donnee/dataset/IGNF_PLAN-IGN",
      note: "Fond cartographique mis à jour en continu par l’IGN.",
    },
  },
  {
    id: "satellite",
    label: "Satellite",
    layer: "ORTHOIMAGERY.ORTHO-SAT.SPOT.2025",
    format: "image/jpeg",
    shade: 0.6,
    source: {
      name: "IGN / CNES",
      fullName: "IGN — ORTHO-SAT® SPOT 2025, images des satellites SPOT 6/7 (CNES, Airbus DS), résolution 1,5 m",
      ...LICENCE_OUVERTE,
      url: "https://www.data.gouv.fr/datasets/ortho-sat",
      note: "Couverture annuelle 2025 : les images sont antérieures aux feux de 2026, qui n’y apparaissent pas.",
    },
  },
  {
    id: "ortho",
    label: "Photos aériennes",
    layer: "ORTHOIMAGERY.ORTHOPHOTOS",
    format: "image/jpeg",
    shade: 0.6,
    source: {
      name: "IGN",
      fullName: "IGN — BD ORTHO®, photographies aériennes (20 à 50 cm)",
      ...LICENCE_OUVERTE,
      url: "https://cartes.gouv.fr/rechercher-une-donnee/dataset/IGNF_BD-ORTHO",
      note: "Prises de vue de dates différentes selon les départements (fiche des dates sur la Géoplateforme), en général antérieures aux feux de 2026.",
    },
  },
];

export const basemapById = (id: string): Basemap => BASEMAPS.find((b) => b.id === id) ?? BASEMAPS[0];

/** GetMap URL for a Lambert-93 box (metres); image row 0 is the north edge, like the scene textures. */
export function wmsUrl(basemap: Basemap, [xmin, ymin]: L93, [xmax, ymax]: L93, width: number, height: number): string {
  if (!basemap.layer) throw new Error(`${basemap.id} has no WMS layer`);
  const params = new URLSearchParams({
    SERVICE: "WMS",
    VERSION: "1.3.0",
    REQUEST: "GetMap",
    LAYERS: basemap.layer,
    STYLES: "",
    CRS: "EPSG:2154",
    BBOX: [xmin, ymin, xmax, ymax].map((v) => Math.round(v)).join(","),
    WIDTH: String(Math.round(width)),
    HEIGHT: String(Math.round(height)),
    FORMAT: basemap.format ?? "image/jpeg",
  });
  return `https://data.geopf.fr/wms-r?${params}`;
}
