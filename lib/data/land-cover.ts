import type { LandCoverKey } from "./schemas.ts";

export const LAND_COVER_LABELS: Record<LandCoverKey, string> = {
  broadlea: "Feuillus",
  conifer: "Résineux",
  mixed: "Forêt mixte",
  scleroph: "Végétation sclérophylle",
  transit: "Forêt et végétation arbustive en mutation",
  othernatlc: "Autres espaces naturels",
  agriareas: "Surfaces agricoles",
  artifsurf: "Surfaces artificialisées",
  otherlc: "Autres",
};
