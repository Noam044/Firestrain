import type { MetadataRoute } from "next";
import { listDepartements } from "@/lib/server/departements";
import { SITE_URL } from "@/lib/site";

/** The pages worth indexing: the four main ones and every département. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...["", "/carte", "/liste", "/methode", "/departements"].map((path) => ({ url: `${SITE_URL}${path}` })),
    ...listDepartements().map((d) => ({ url: `${SITE_URL}/departement/${d.slug}` })),
  ];
}
