import Link from "next/link";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/brand/SiteFooter";
import { Hero, LiveFacts } from "@/components/home/Hero";

function Feature({ title, href, link, children }: { title: string; href: string; link: string; children: ReactNode }) {
  return (
    <div className="border-t-2 border-ink pt-4">
      <h3 className="text-lg">{title}</h3>
      <p className="mt-2 text-[15px] leading-6 text-ink-2">{children}</p>
      <Link href={href} className="mt-3 inline-block text-sm font-bold text-link underline underline-offset-4">
        {link}
      </Link>
    </div>
  );
}

/** Home page: what FireStrain is, the state of the moment, and what the map shows. */
export default function HomePage() {
  return (
    <>
      <main id="contenu">
        <Hero />
        <LiveFacts />
        <section aria-labelledby="carte-titre" className="border-t border-rule bg-sheet">
          <div className="mx-auto max-w-6xl px-5 py-12 md:px-8">
            <h2 id="carte-titre" className="text-xl">
              Sur la carte
            </h2>
            <div className="mt-6 grid gap-8 md:grid-cols-3">
              <Feature title="Les douze derniers mois" href="/carte" link="Voir les feux récents">
                Un repère par feu, dont la taille suit la surface brûlée et la couleur l’âge. En zoomant, le repère
                laisse place au contour réel du feu sur le relief. Les mois se filtrent un à un.
              </Feature>
              <Feature title="Les dernières 72 heures" href="/carte" link="Voir les points chauds">
                Les satellites VIIRS de la NASA repèrent des anomalies de chaleur plusieurs fois par jour : ces points
                chauds signalent un feu actif, sans en mesurer la surface.
              </Feature>
              <Feature title="Les archives depuis 2006" href="/liste" link="Ouvrir la liste des feux">
                Chaque année civile depuis 2006 se consulte sur la carte, et toutes les surfaces se trient et se
                filtrent dans la liste, avec la surface déclarée par les services d’incendie quand elle est connue.
              </Feature>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
