import type { Metadata } from "next";
import { formatDate, formatInteger } from "@/lib/format";
import { manifest } from "@/lib/data/manifest";

export const metadata: Metadata = {
  title: "Méthode",
  description: "Sources, licences et traitements des données affichées par FireStrain.",
};

const UPCOMING = [
  {
    name: "EFFIS — European Forest Fire Information System (Copernicus, JRC)",
    use: "Contours des surfaces brûlées 2006–2026 et statistiques annuelles.",
    licence: "CC BY 4.0",
    status: "En cours d’intégration.",
  },
  {
    name: "NASA FIRMS — détections VIIRS",
    use: "Anomalies thermiques jour par jour : elles ne mesurent pas des surfaces brûlées.",
    licence: "Données ouvertes de la NASA, citation demandée",
    status: "En cours d’intégration ; l’archive de l’été 2026 nécessite une clé d’accès.",
  },
  {
    name: "BDIFF — Base de données sur les incendies de forêt en France (IGN, ministère de l’Agriculture)",
    use: "Feux déclarés par les services d’incendie, localisés à la commune, 2006–2025.",
    licence: "Licence Ouverte 2.0",
    status: "Les données 2026 ne sont pas encore diffusées publiquement.",
  },
];

export default function MethodePage() {
  const files = Object.entries(manifest.files);
  return (
    <main id="contenu" className="mx-auto max-w-3xl px-4 pb-24 pt-12 md:pt-16">
      <p className="label-caps text-ash-400">Méthode</p>
      <h1 className="mt-2 text-4xl md:text-5xl">Sources, licences, traitements</h1>
      <p className="mt-6 font-serif text-lg leading-relaxed text-bone-300">
        Chaque fichier utilisé par FireStrain est listé ci-dessous avec sa source, sa licence, sa date
        de récupération et les traitements appliqués. Cette page sera complétée à mesure que les données
        sur les feux seront intégrées.
      </p>

      <h2 className="mt-14 text-2xl">Fichiers publiés</h2>
      <p className="mt-2 font-mono text-xs text-ash-400">
        Dernière mise à jour des données : {formatDate(manifest.updatedAt)}
      </p>
      <ul className="mt-6 divide-y divide-ash-800 border-y border-ash-800">
        {files.map(([path, file]) => (
          <li key={path} className="py-5">
            <h3 className="font-sans text-sm font-medium tracking-normal text-bone-100">{file.title}</h3>
            <p className="mt-1 text-sm text-bone-300">{file.source}</p>
            <dl className="mt-3 grid grid-cols-[8rem_1fr] gap-x-4 gap-y-1 font-mono text-[11px] leading-4 text-bone-300">
              <dt className="text-ash-400">Licence</dt>
              <dd>
                <a href={file.licenceUrl} className="underline decoration-ash-600 hover:text-bone-100">
                  {file.licence}
                </a>
              </dd>
              <dt className="text-ash-400">Récupéré le</dt>
              <dd>{formatDate(file.retrievedAt)}</dd>
              <dt className="text-ash-400">Traitements</dt>
              <dd>{file.transformations.join(" · ")}</dd>
              <dt className="text-ash-400">Fichier</dt>
              <dd className="break-all">
                {path} ·{" "}
                {file.bytes < 1000 ? `${file.bytes} o` : `${formatInteger(file.bytes / 1000)} ko`} · sha256{" "}
                {file.sha256.slice(0, 12)}…
              </dd>
              <dt className="text-ash-400">Requête</dt>
              <dd>
                <a href={file.sourceUrl} className="break-all underline decoration-ash-600 hover:text-bone-100">
                  URL de téléchargement
                </a>
              </dd>
            </dl>
          </li>
        ))}
      </ul>

      <h2 className="mt-14 text-2xl">Sources sur les feux</h2>
      <ul className="mt-6 divide-y divide-ash-800 border-y border-ash-800">
        {UPCOMING.map((source) => (
          <li key={source.name} className="py-5 text-sm">
            <h3 className="font-sans text-sm font-medium tracking-normal text-bone-100">{source.name}</h3>
            <p className="mt-1 text-bone-300">{source.use}</p>
            <p className="mt-2 font-mono text-[11px] text-ash-400">
              {source.licence} · {source.status}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
