import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/brand/SiteFooter";
import type { ReactNode } from "react";
import bdiffAnnualJson from "@/public/data/bdiff/annuel.json";
import effisIndexJson from "@/public/data/effis/index.json";
import matchesJson from "@/public/data/bdiff/rapprochements.json";
import firmsIndexJson from "@/public/data/firms/index.json";
import { formatDate, formatInteger } from "@/lib/format";
import { manifest } from "@/lib/data/manifest";
import { BdiffAnnualSchema, BdiffMatchesSchema, EffisIndexSchema, FirmsIndexSchema } from "@/lib/data/schemas";

export const metadata: Metadata = {
  title: "Méthode",
  description: "Sources, licences, limites et traitements des données de la carte des feux de forêt.",
};

// Validated at build time: the page fails to build rather than show malformed figures.
const effisIndex = EffisIndexSchema.parse(effisIndexJson);
const bdiffAnnual = BdiffAnnualSchema.parse(bdiffAnnualJson);
const rule = BdiffMatchesSchema.shape.rule.parse(matchesJson.rule);
const linkCount = Object.keys(matchesJson.matches).length;
const firmsLatest = FirmsIndexSchema.parse(firmsIndexJson).years.at(-1);

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-12 border-t border-rule pt-6">
      <h2 className="text-xl">{title}</h2>
      <div className="mt-3 space-y-4 text-[15px] leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

export default function MethodePage() {
  const files = Object.entries(manifest.files);
  return (
    <>
      <main id="contenu" className="mx-auto max-w-3xl px-5 pb-24">
        <h1 className="mt-10 text-3xl md:text-4xl">Sources, limites, traitements</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-2">
          D’où viennent les surfaces, les dates et les points chauds de la carte, ce que mesure chaque source, et pourquoi
          leurs chiffres diffèrent.
        </p>

        <Section title="EFFIS : surfaces brûlées vues par satellite">
          <p>
            Le système européen d’information sur les feux de forêt (EFFIS, programme Copernicus, Commission européenne –
            JRC) cartographie les surfaces brûlées à partir d’images satellitaires, toute végétation confondue : forêt,
            landes, cultures. La carte en affiche les contours pour la France métropolitaine de {effisIndex.years[0].year}{" "}
            à {effisIndex.years.at(-1)?.year}, sous licence CC BY 4.0, après reprojection et simplification.
          </p>
          <p>
            Les totaux annuels retiennent les feux de 30 ha ou plus, comme les statistiques officielles d’EFFIS. Recalculés à
            partir des contours, ils leur sont identiques pour chaque année, à une exception près : en 2011, la statistique
            française d’EFFIS inclut un feu à La Réunion, que la carte n’affiche pas.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              La date donnée est celle de la <strong className="font-medium text-ink">première détection
              satellite</strong>, pas l’heure d’alerte des pompiers. EFFIS ne publie pas de date de fin.
            </li>
            <li>
              La commune associée par EFFIS à un contour n’est pas nécessairement celle où le feu a démarré, et un même
              incendie peut être découpé en plusieurs contours.
            </li>
            <li>
              Les petites surfaces deviennent beaucoup plus nombreuses dans EFFIS à partir de 2019 : les comparaisons entre
              années portent sur les feux de 30 ha ou plus, jamais sur le nombre de feux.
            </li>
          </ul>
        </Section>

        <Section title="Les douze derniers mois, mis à jour chaque heure">
          <p>
            La carte s’ouvre sur les feux détectés depuis le 1er du mois, onze mois plus tôt : le serveur du site interroge
            l’API d’EFFIS, garde la France métropolitaine, reprojette et simplifie les contours (40 m), et conserve la
            réponse environ une heure. L’heure de l’interrogation est affichée au-dessus de la liste. Si EFFIS ne répond
            pas, la carte reprend les fichiers du site, à leur date, et le signale.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Chaque contour EFFIS compte pour un feu dans la liste et les totaux ; un grand incendie peut en compter
              plusieurs. Les totaux du suivi incluent les petites surfaces (moins de 30 ha), contrairement aux comparaisons
              entre années ci-dessous.
            </li>
            <li>
              À l’échelle de la France, chaque feu est un disque dont l’aire suit la surface brûlée, avec une taille
              minimale pour que les petits feux restent visibles. En zoomant, le disque s’efface quand le contour réel
              devient plus grand que lui.
            </li>
            <li>
              La couleur donne l’âge de la première détection à la date des données : moins de 7 jours, moins d’un mois,
              plus ancien. Un feu détecté il y a longtemps peut encore être actif : EFFIS ne publie pas de date de fin.
            </li>
            <li>
              Les archives ({effisIndex.years[0].year}–{effisIndex.years.at(-1)?.year}) viennent des fichiers du site,
              année civile par année civile.
            </li>
          </ul>
        </Section>

        <Section title="BDIFF : feux déclarés par les services d’incendie">
          <p>
            La Base de données sur les incendies de forêt en France (BDIFF, IGN pour le ministère de l’Agriculture)
            recense les feux déclarés par les services d’incendie et de secours, localisés à la commune de départ, avec une
            surface souvent estimée sur le terrain. Licence Ouverte 2.0.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              La consultation publique s’arrête à l’année précédente : les feux de 2026 ne sont pas encore diffusés.
              La carte affiche donc la BDIFF de {bdiffAnnual.years[0].year} à {bdiffAnnual.availableUpTo}.
            </li>
            <li>
              Les données proviennent de l’export par période de la BDIFF, qui applique le filtre « Type de feu : F » ; la
              documentation publique ne détaille pas ce type, retenu ici comme celui des incendies de forêt.
            </li>
            <li>
              Les catégories de surface ont changé avec la campagne 2023, et l’export signale que certaines fiches
              anciennes relèvent d’une version antérieure du formulaire.
            </li>
          </ul>
        </Section>

        <Section title="Pourquoi les deux sources ne s’additionnent pas">
          <p>
            EFFIS mesure ce que le satellite voit brûlé ; la BDIFF enregistre ce que les services d’incendie déclarent. Les
            deux chiffres décrivent les mêmes feux par des méthodes différentes : les additionner compterait deux fois les
            mêmes hectares. La carte les affiche toujours séparément.
          </p>
          <p>
            L’écart change de sens selon les années. Jusqu’en 2018, la BDIFF déclare nettement plus que les feux EFFIS de 30
            ha ou plus ; à partir de 2019, c’est souvent l’inverse. Les petits feux échappent au seuil de 30 ha, tandis
            qu’EFFIS cartographie aussi des surfaces non forestières qu’un feu de type F de la BDIFF ne couvre pas
            toujours.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] border-y border-rule tabular text-[12px] tabular">
              <caption className="sr-only">Surfaces annuelles selon EFFIS et selon la BDIFF</caption>
              <thead className="text-left text-ink-3">
                <tr>
                  <th scope="col" className="py-2 font-normal">Année</th>
                  <th scope="col" className="py-2 text-right font-normal">EFFIS, feux ≥ 30 ha</th>
                  <th scope="col" className="py-2 text-right font-normal">BDIFF, feux déclarés</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule text-ink-2">
                {effisIndex.years.map((year) => {
                  const declared = bdiffAnnual.years.find((y) => y.year === year.year);
                  return (
                    <tr key={year.year}>
                      <th scope="row" className="py-1.5 text-left font-normal text-ink">
                        {year.year}
                      </th>
                      <td className="py-1.5 text-right">{formatInteger(year.areaHaAtLeast30)} ha</td>
                      <td className="py-1.5 text-right">
                        {declared ? `${formatInteger(declared.areaHa)} ha` : "non diffusé"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="tabular text-[11px] text-ink-3">
            Sources : EFFIS (données du {formatDate(effisIndex.years.at(-1)?.lastUpdate ?? manifest.updatedAt)}),
            BDIFF ; récupérées le {formatDate(manifest.files["bdiff/annuel.json"]?.retrievedAt ?? manifest.updatedAt)}.
          </p>
        </Section>

        <Section title="Rapprochement d’un contour EFFIS et d’une fiche BDIFF">
          <p>
            Pour un contour EFFIS antérieur à 2026, la fiche du feu affiche la surface déclarée dans la BDIFF seulement si une
            fiche correspond sans ambiguïté. Règle appliquée : {rule.description.charAt(0).toLowerCase()}
            {rule.description.slice(1)}
          </p>
          <p>
            {formatInteger(linkCount)} contours sont ainsi rapprochés. Les autres restent sans surface BDIFF : soit plusieurs
            fiches étaient possibles, soit aucune (petites surfaces, brûlages, communes ayant changé de code INSEE). Le lien
            est toujours signalé comme un rapprochement automatique.
          </p>
        </Section>

        <Section title="NASA FIRMS : points chauds">
          <p>
            Les points chauds sont des détections d’anomalies thermiques des satellites VIIRS (NASA FIRMS, résolution
            375 m), jamais converties en hectares. La carte affiche celles des 72 dernières heures, demandées par le
            serveur à FIRMS (S-NPP, NOAA-20, NOAA-21, temps quasi réel) et conservées environ une heure ; la clé d’accès
            reste sur le serveur. Une détection s’estompe en trois jours.
          </p>
          <p>
            La fiche d’un feu compte, jour par jour, les détections à moins de 400 m de son contour, de deux jours avant
            sa date EFFIS à soixante jours après, à partir des fichiers annuels du site
            {firmsLatest && firmsLatest.lastDate < `${firmsLatest.year}-12-31` ? `, publiés jusqu’au ${formatDate(firmsLatest.lastDate)}` : ""}.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              2026 combine trois satellites (S-NPP, NOAA-20, NOAA-21) : produit standard jusqu’au 30 juin, temps quasi réel
              ensuite. Les années 2012 à 2025 viennent des archives du seul S-NPP : les nombres de détections ne se comparent
              pas entre ces deux périodes.
            </li>
            <li>
              Les sources de chaleur fixes (industrie) sont écartées : par le champ prévu à cet effet dans le produit
              standard, et, pour le temps quasi réel qui n’en dispose pas, par exclusion des mailles de 750 m où une source
              fixe a été signalée.
            </li>
          </ul>
        </Section>

        <Section title="Rendu et accessibilité">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              La{" "}
              <Link href="/liste" className="underline decoration-rule underline-offset-4 hover:text-ink">
                liste des feux
              </Link> donne les mêmes données que la carte sous forme de tableau triable, utilisable au clavier et avec un
              lecteur d’écran ; chaque commune mène au feu sur la carte.
            </li>
            <li>
              Sans WebGL 2, ou sans accélération graphique (rendu logiciel, où chaque image du relief coûte plusieurs
              secondes), la carte s’affiche en 2D : mêmes feux, mêmes détections, sans relief. L’adresse accepte{" "}
              <code className="tabular text-[13px]">rendu=2d</code> et <code className="tabular text-[13px]">rendu=3d</code>{" "}
              pour forcer l’un ou l’autre.
            </li>
            <li>
              Fonds de carte : relief ombré calculé à partir de la BD ALTI, Plan IGN ou photographies aériennes
              (BD ORTHO), sous Licence Ouverte 2.0, toujours en Lambert-93. L’image de toute la France est demandée une
              fois à l’IGN par la chaîne de données et servie par le site ; en zoomant, la zone regardée se complète de
              tuiles pré-calculées de la Géoplateforme, chargées du centre vers les bords. Les images sont antérieures aux
              feux récents, qui n’y apparaissent pas : les surfaces brûlées viennent toujours d’EFFIS. Les mosaïques
              satellite SPOT ne sont plus proposées : l’IGN ne les diffuse qu’image par image, en plusieurs secondes.
            </li>
            <li>
              Les pays voisins sont dessinés à plat, en gris, sans relief ni donnée de feu : ils situent la France sans
              rien mesurer. Leurs contours viennent de Natural Earth (Admin 0, 1:10m, domaine public), simplifiés à 400 m.
            </li>
            <li>
              Avec la préférence « réduire les animations », les déplacements de caméra deviennent des coupes.
            </li>
            <li>
              La carte en relief se manipule au clavier : flèches pour se déplacer, plus et moins pour zoomer, Maj et
              flèches pour pivoter et incliner, zéro pour revenir à la vue d’ensemble.
            </li>
          </ul>
        </Section>

        <Section title="Contrôles">
          <p>
            Un script de validation vérifie chaque fichier publié (taille, empreinte sha256, structure) et confronte les
            totaux aux statistiques officielles et aux chiffres de presse. Son rapport est versionné avec le code (
            <code className="tabular text-[13px]">docs/VALIDATION_REPORT.md</code>).
          </p>
        </Section>

        <Section title="Fichiers publiés">
          <p className="tabular text-xs text-ink-3">Dernière mise à jour des données : {formatDate(manifest.updatedAt)}</p>
          <details className="border-y border-rule">
            <summary className="cursor-pointer py-3 text-sm text-ink">
              Les {files.length} fichiers, avec source, licence, date de récupération et traitements
            </summary>
            <ul className="divide-y divide-rule border-t border-rule">
              {files.map(([path, file]) => (
                <li key={path} className="py-5">
                  <h3 className="font-sans text-sm font-medium tracking-normal text-ink">{file.title}</h3>
                  <p className="mt-1 text-sm text-ink-2">{file.source}</p>
                  <dl className="mt-3 grid grid-cols-[8rem_1fr] gap-x-4 gap-y-1 tabular text-[11px] leading-4 text-ink-2">
                    <dt className="text-ink-3">Licence</dt>
                    <dd>
                      <a href={file.licenceUrl} className="underline decoration-rule hover:text-ink">
                        {file.licence}
                      </a>
                    </dd>
                    <dt className="text-ink-3">Récupéré le</dt>
                    <dd>{formatDate(file.retrievedAt)}</dd>
                    <dt className="text-ink-3">Traitements</dt>
                    <dd>{file.transformations.join(" · ")}</dd>
                    <dt className="text-ink-3">Fichier</dt>
                    <dd className="break-all">
                      {path} · {file.bytes < 1000 ? `${file.bytes} o` : `${formatInteger(file.bytes / 1000)} ko`} · sha256{" "}
                      {file.sha256.slice(0, 12)}…
                    </dd>
                    <dt className="text-ink-3">Requête</dt>
                    <dd>
                      <a href={file.sourceUrl} className="break-all underline decoration-rule hover:text-ink">
                        URL de téléchargement
                      </a>
                    </dd>
                  </dl>
                </li>
              ))}
            </ul>
          </details>
        </Section>
      </main>
      <SiteFooter />
    </>
  );
}
