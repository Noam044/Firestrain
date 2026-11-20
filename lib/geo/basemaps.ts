/**
 * Base maps under the burnt areas: the relief (computed in the shader) or an
 * IGN Géoplateforme layer, always in Lambert-93 so that images line up with the
 * scene without reprojection. No key; CORS allowed.
 *
 * Each IGN layer comes in two forms:
 * - a whole-France image, requested once by WMS by the data pipeline
 *   (09-basemaps) and served by the site, so it is on screen at once;
 * - Lambert-93 WMTS tiles for close-up views: pre-rendered, cached by the
 *   Géoplateforme and the browser, drawn as they arrive.
 * Layers offered only by WMS (rendered on request, several seconds per image,
 * such as the SPOT satellite mosaics) are not offered.
 */
import type { L93 } from "./frame.ts";

export type BasemapId = "relief" | "plan" | "ortho";

export type Basemap = {
  id: BasemapId;
  label: string;
  /** IGN layer names: WMS for the whole-France image, WMTS (Lambert-93) for the tiles. */
  ign?: { wms: string; tiles: string; maxLevel: number };
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
    ign: { wms: "GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2", tiles: "GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2.L93", maxLevel: 17 },
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
    id: "ortho",
    label: "Photos aériennes",
    ign: { wms: "ORTHOIMAGERY.ORTHOPHOTOS", tiles: "HR.ORTHOIMAGERY.ORTHOPHOTOS.L93", maxLevel: 17 },
    shade: 0.6,
    source: {
      name: "IGN",
      fullName: "IGN — BD ORTHO®, photographies aériennes (20 à 50 cm)",
      ...LICENCE_OUVERTE,
      url: "https://cartes.gouv.fr/rechercher-une-donnee/dataset/IGNF_BD-ORTHO",
      note: "Prises de vue de dates différentes selon les départements, en général antérieures aux feux récents, qui n’y apparaissent pas.",
    },
  },
];

export const basemapById = (id: string): Basemap => BASEMAPS.find((b) => b.id === id) ?? BASEMAPS[0];

/** Whole-France image of a base map, published by 09-basemaps under public/data. */
export const farImagePath = (id: BasemapId) => `fonds/${id}-france.jpg`;

/** GetMap URL for a Lambert-93 box (metres); image row 0 is the north edge, like the scene textures. */
export function wmsUrl(layer: string, [xmin, ymin]: L93, [xmax, ymax]: L93, width: number, height: number): string {
  const params = new URLSearchParams({
    SERVICE: "WMS",
    VERSION: "1.3.0",
    REQUEST: "GetMap",
    LAYERS: layer,
    STYLES: "",
    CRS: "EPSG:2154",
    BBOX: [xmin, ymin, xmax, ymax].map((v) => Math.round(v)).join(","),
    WIDTH: String(Math.round(width)),
    HEIGHT: String(Math.round(height)),
    FORMAT: "image/jpeg",
  });
  return `https://data.geopf.fr/wms-r?${params}`;
}

/**
 * The Géoplateforme's Lambert-93 tile grid (TileMatrixSet 2154_10cm_6_20):
 * 256 px tiles from the corner (0 m, 12 000 000 m), 3 276.8 m per pixel at
 * level 6, halved at each level.
 */
export const L93_TILES = { matrixSet: "2154_10cm_6_20", originX: 0, originY: 12_000_000, size: 256, minLevel: 6 } as const;

/** Ground size of one tile at `level`, in metres. */
export const tileMetres = (level: number) => (L93_TILES.size * 3276.8) / 2 ** (level - L93_TILES.minLevel);

export function tileUrl(layer: string, level: number, row: number, col: number): string {
  const params = new URLSearchParams({
    SERVICE: "WMTS",
    REQUEST: "GetTile",
    VERSION: "1.0.0",
    LAYER: layer,
    STYLE: "normal",
    TILEMATRIXSET: L93_TILES.matrixSet,
    TILEMATRIX: String(level),
    TILEROW: String(row),
    TILECOL: String(col),
    FORMAT: "image/jpeg",
  });
  return `https://data.geopf.fr/wmts?${params}`;
}
