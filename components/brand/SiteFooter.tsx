import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./Logo";

const SOURCES = [
  { name: "EFFIS", detail: "Copernicus, Commission européenne / JRC, CC BY 4.0", href: "https://forest-fire.emergency.copernicus.eu/" },
  { name: "NASA FIRMS", detail: "détections VIIRS (LANCE / ESDIS)", href: "https://firms.modaps.eosdis.nasa.gov/" },
  { name: "IGN", detail: "BD ALTI, ADMIN EXPRESS, Plan IGN, BD ORTHO, Licence Ouverte 2.0", href: "https://geoservices.ign.fr/" },
  { name: "BDIFF", detail: "IGN, ministère de l’Agriculture, Licence Ouverte 2.0", href: "https://bdiff.agriculture.gouv.fr/" },
  { name: "Natural Earth", detail: "pays voisins, domaine public", href: "https://www.naturalearthdata.com/" },
] as const;

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="label">{title}</h2>
      <div className="mt-2 text-sm leading-6 text-ink-2">{children}</div>
    </div>
  );
}

/** Under every page: what FireStrain is, where its data comes from, and what it is not. */
export function SiteFooter() {
  return (
    <footer className="border-t border-rule bg-sheet">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 md:grid-cols-[1.2fr_1fr_1.4fr] md:px-8">
        <div>
          <Logo tagline />
          <p className="mt-3 max-w-sm text-sm leading-6 text-ink-2">
            Les feux de forêt et de végétation de France métropolitaine et de Corse, cartographiés à partir de données
            satellitaires publiques et mis à jour chaque heure.
          </p>
          <p className="mt-3 max-w-sm text-xs leading-5 text-ink-3">
            En cas d’incendie, suivez les consignes des pompiers et de la préfecture. Urgence : 18 ou 112.
          </p>
        </div>
        <Column title="Le site">
          <ul>
            <li>
              <Link href="/carte" className="link-draw">
                Carte des feux récents
              </Link>
            </li>
            <li>
              <Link href="/liste" className="link-draw">
                Liste des feux
              </Link>
            </li>
            <li>
              <Link href="/methode" className="link-draw">
                Méthode et sources
              </Link>
            </li>
            <li>
              <a href="https://github.com/Noam044/Firestrain" className="link-draw">
                Code source (licence MIT)
              </a>
            </li>
          </ul>
        </Column>
        <Column title="Données">
          <ul className="space-y-1">
            {SOURCES.map((source) => (
              <li key={source.name} className="leading-5">
                <a href={source.href} className="font-bold text-ink hover:underline">
                  {source.name}
                </a>{" "}
                <span className="text-xs text-ink-3">· {source.detail}</span>
              </li>
            ))}
          </ul>
        </Column>
      </div>
      <div className="border-t border-rule">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-4 text-xs leading-5 text-ink-3 md:flex-row md:items-baseline md:justify-between md:gap-8 md:px-8">
          <p>
            FireStrain est un projet indépendant, sans lien avec les organismes cités. Les surfaces sont estimées par
            satellite et peuvent différer des bilans officiels.
          </p>
          <p className="shrink-0">
            Site créé par{" "}
            <a href="https://noambouriche.fr" target="_blank" rel="noopener" className="link-draw font-semibold text-ink-2">
              Noam Bouriche
              <span className="sr-only"> (portfolio, s’ouvre dans un nouvel onglet)</span>
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
