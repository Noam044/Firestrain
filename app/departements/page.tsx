import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/brand/SiteFooter";
import { formatCount, formatInteger } from "@/lib/format";
import { archiveInfo, listDepartements } from "@/lib/server/departements";

export const metadata: Metadata = {
  title: "Feux de forêt par département",
  description:
    "Les surfaces brûlées cartographiées par EFFIS depuis 2006 dans chaque département de France métropolitaine, du plus touché au moins touché.",
};

/** Every département, most burnt first, each opening its own page. */
export default function DepartementsPage() {
  const all = listDepartements();
  const burnt = all.filter((d) => d.fires > 0);
  const none = all.filter((d) => d.fires === 0).sort((a, b) => a.code.localeCompare(b.code));
  const max = Math.max(1, ...burnt.map((d) => d.areaHa));
  const { first } = archiveInfo();

  return (
    <>
      <main id="contenu" className="mx-auto max-w-4xl px-5 pb-24 md:px-8">
        <h1 className="mt-10 text-3xl md:text-4xl">Les feux par département</h1>
        <p className="mt-3 max-w-3xl leading-relaxed text-ink-2">
          Surface brûlée cartographiée par EFFIS depuis {first}, du département le plus touché au moins touché. Chaque nom
          ouvre la page du département : année par année, plus grands feux et carte.
        </p>

        <ol className="mt-10 border-t border-rule-strong">
          {burnt.map((d) => (
            <li key={d.slug} className="border-b border-rule">
              <Link
                href={`/departement/${d.slug}`}
                className="group grid grid-cols-[2.25rem_minmax(0,1fr)_6.5rem] items-center gap-x-3 py-2.5 sm:grid-cols-[2.25rem_minmax(0,14rem)_minmax(0,1fr)_7rem]"
              >
                <span className="figure text-xs text-ink-3">{d.code}</span>
                <span className="truncate font-bold text-ink group-hover:underline">{d.nom}</span>
                <span aria-hidden className="hidden h-2 sm:block">
                  <span className="block h-full rounded-sm bg-fire-month" style={{ width: `max(2px, ${(d.areaHa / max) * 100}%)` }} />
                </span>
                <span className="text-right">
                  <span className="figure text-sm text-ink">
                    {formatInteger(d.areaHa)}
                    <span className="ml-0.5 text-xs text-ink-3">ha</span>
                  </span>
                  <span className="block text-xs text-ink-3">{formatCount(d.fires, "feu", "feux")}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>

        {none.length > 0 && (
          <section aria-labelledby="sans-feu-titre" className="mt-12">
            <h2 id="sans-feu-titre" className="text-xl">
              Aucun feu cartographié depuis {first}
            </h2>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-ink-2">
              {none.map((d) => (
                <li key={d.slug}>
                  <Link href={`/departement/${d.slug}`} className="link-draw">
                    {d.nom}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
