import type { Metadata } from "next";
import { AppShell } from "@/components/tracker/AppShell";
import { formatArea, formatDate } from "@/lib/format";
import { findFire } from "@/lib/server/fire-lookup";
import bdiffAnnualJson from "@/public/data/bdiff/annuel.json";
import effisIndexJson from "@/public/data/effis/index.json";
import { BdiffAnnualSchema, EffisIndexSchema } from "@/lib/data/schemas";

// The archive index and the BDIFF totals ship with the page: no request before the fires themselves.
const initialData = {
  effisIndex: EffisIndexSchema.parse(effisIndexJson),
  bdiffAnnual: BdiffAnnualSchema.parse(bdiffAnnualJson),
};

const DESCRIPTION =
  "Carte en relief des feux de forêt des douze derniers mois en France métropolitaine, mois par mois, avec les points chauds des 72 dernières heures.";

/**
 * A shared fire (?fire=…) gets its own title, description and preview image,
 * so the link shows the fire in messaging apps and social networks.
 */
export async function generateMetadata({ searchParams }: PageProps<"/carte">): Promise<Metadata> {
  const params = await searchParams;
  const id = Number(params.fire);
  const yearParam = Number(params.annee ?? params.year);
  const year = Number.isInteger(yearParam) && yearParam > 0 ? yearParam : null;
  const fire = Number.isInteger(id) && id > 0 ? await findFire(id, year) : null;
  if (!fire) return { title: "Carte des feux", description: DESCRIPTION };
  const title = `Feu de ${fire.commune || "commune non renseignée"} (${fire.province}) : ${formatArea(fire.areaHa)} ha`;
  const description = `Surface brûlée cartographiée par EFFIS, première détection le ${formatDate(fire.firedate)}. Contour, végétation touchée et points chauds sur la carte FireStrain.`;
  const image = { url: `/api/apercu/feu/${fire.id}${year ? `?annee=${year}` : ""}`, width: 1200, height: 630, alt: title };
  return {
    title,
    description,
    openGraph: { title, description, images: [image], type: "article" },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}

export default function MapPage() {
  return <AppShell initialData={initialData} />;
}
