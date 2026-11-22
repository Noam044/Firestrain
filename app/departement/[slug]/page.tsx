import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/brand/SiteFooter";
import { LargestFires, WhereFigure, YearsChart } from "@/components/departements/figures";
import { formatCount, formatDate, formatInteger } from "@/lib/format";
import { archiveInfo, departementBySlug, listDepartements } from "@/lib/server/departements";

/** One page per département, built with the site from the EFFIS archive. */
export function generateStaticParams() {
  return listDepartements().map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: PageProps<"/departement/[slug]">): Promise<Metadata> {
  const departement = departementBySlug((await params).slug);
  if (!departement) return {};
  const { first } = archiveInfo();
  return {
    title: `Feux de forêt : ${departement.nom}`,
    description: `Les feux de forêt cartographiés par EFFIS en ${departement.nom} (${departement.code}) depuis ${first} : ${formatInteger(departement.areaHa)} ha brûlés, ${formatCount(departement.fires, "feu", "feux")}, année par année et plus grands feux.`,
  };
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="flex flex-col px-3 py-2">
      <dt className="label">{label}</dt>
      <dd className="figure mt-auto text-xl leading-7 text-ink">
        {value}
        {unit && <span className="ml-1 text-xs text-ink-3">{unit}</span>}
      </dd>
    </div>
  );
}

export default async function DepartementPage({ params }: PageProps<"/departement/[slug]">) {
  const departement = departementBySlug((await params).slug);
  if (!departement) notFound();
  const { dataDate, first, last } = archiveInfo();
  const worst = departement.years.reduce((best, y) => (y.areaHa > best.areaHa ? y : best));
  const hasFires = departement.fires > 0;

  return (
    <>
      <main id="contenu" className="mx-auto max-w-6xl px-5 pb-24 md:px-8">
        <nav aria-label="Fil d’Ariane" className="mt-8 text-sm text-ink-3">
          <Link href="/departements" className="link-draw">
            Départements
          </Link>
          <span aria-hidden> / </span>
          <span aria-current="page">{departement.nom}</span>
        </nav>
        <h1 className="mt-3 text-3xl md:text-4xl">
          {departement.nom} <span className="figure text-ink-3">{departement.code}</span>
        </h1>
        <p className="mt-3 max-w-3xl leading-relaxed text-ink-2">
          Les feux de forêt et de végétation cartographiés par EFFIS (Copernicus) dans le département depuis {first},
          d’après les archives du site, à jour au {formatDate(dataDate)}.
        </p>

        <div className="mt-10 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-14">
          <div className="min-w-0">
            <dl className="grid grid-cols-3 divide-x divide-rule rounded-md border border-rule">
              <Stat label="Feux" value={formatInteger(departement.fires)} />
              <Stat label="Surface brûlée" value={formatInteger(departement.areaHa)} unit="ha" />
              <Stat label="Pire année" value={hasFires ? String(worst.year) : "–"} />
            </dl>

            {hasFires ? (
              <>
                <section aria-labelledby="annees-titre" className="mt-12">
                  <h2 id="annees-titre" className="text-2xl">
                    Année par année
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-ink-2">
                    Surface brûlée chaque année ; {worst.year} en tête avec{" "}
                    <span className="figure text-ink">{formatInteger(worst.areaHa)} ha</span>. Une année s’ouvre sur la carte
                    d’un clic.
                  </p>
                  <div className="mt-6">
                    <YearsChart departement={departement} />
                  </div>
                </section>

                <section aria-labelledby="grands-titre" className="mt-12">
                  <h2 id="grands-titre" className="text-2xl">
                    Les plus grands feux
                  </h2>
                  <div className="mt-4">
                    <LargestFires departement={departement} />
                  </div>
                </section>
              </>
            ) : (
              <p className="mt-8 leading-relaxed text-ink-2">
                EFFIS n’a cartographié aucun feu dans ce département depuis {first}. Les petits feux, sous le seuil de
                détection des satellites, n’y figurent pas : la BDIFF les recense.
              </p>
            )}
          </div>

          <div className="mt-12 lg:sticky lg:top-24 lg:mt-0 lg:self-start">
            <WhereFigure departement={departement} last={last} />
          </div>
        </div>

        <p className="mt-14">
          <Link href="/departements" className="link-draw font-semibold text-ink-2">
            Tous les départements
          </Link>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
