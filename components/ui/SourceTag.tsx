"use client";

import { Popover } from "radix-ui";
import { formatDate } from "@/lib/format";

export type SourceInfo = {
  /** Short name shown inline, e.g. "EFFIS". */
  name: string;
  fullName: string;
  /** Date of the data itself (last update by the producer). */
  dataDate?: string | null;
  /** When the file was downloaded by the pipeline. */
  retrievedAt?: string | null;
  /** Absent for a press release or an article quoted for a single figure. */
  licence?: string;
  licenceUrl?: string;
  url: string;
  urlLabel?: string;
  note?: string;
  /** Short quote of the source supporting the figure. */
  quote?: string;
};

/** "source · date of the data · retrieval date", with details on demand. Every figure carries one. */
export function SourceTag({ source }: { source: SourceInfo }) {
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5 font-mono text-[11px] leading-4 text-ash-400">
      <span className="text-bone-300">{source.name}</span>
      {source.dataDate && (
        <>
          <span aria-hidden>·</span>
          <span>donnée du {formatDate(source.dataDate)}</span>
        </>
      )}
      {source.retrievedAt && (
        <>
          <span aria-hidden>·</span>
          <span>récupérée le {formatDate(source.retrievedAt)}</span>
        </>
      )}
      <Popover.Root>
        <Popover.Trigger
          className="underline decoration-ash-600 underline-offset-2 hover:text-bone-300"
          aria-label={`Détails de la source ${source.name}`}
        >
          détails
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side="top"
            align="start"
            sideOffset={6}
            collisionPadding={12}
            className="z-50 w-72 border border-ash-700 bg-ash-950 p-3 text-xs leading-5 text-bone-300"
          >
            <p className="font-medium text-bone-100">{source.fullName}</p>
            {source.quote && <p className="mt-1 font-serif text-bone-100">« {source.quote} »</p>}
            {source.note && <p className="mt-1">{source.note}</p>}
            <dl className="mt-2 grid grid-cols-[6.5rem_1fr] gap-x-2 font-mono text-[11px] leading-4">
              {source.licence && (
                <>
                  <dt className="text-ash-400">Licence</dt>
                  <dd>
                    <a href={source.licenceUrl} className="underline decoration-ash-600 hover:text-bone-100">
                      {source.licence}
                    </a>
                  </dd>
                </>
              )}
              {source.dataDate && (
                <>
                  <dt className="text-ash-400">Donnée du</dt>
                  <dd>{formatDate(source.dataDate)}</dd>
                </>
              )}
              {source.retrievedAt && (
                <>
                  <dt className="text-ash-400">Récupérée le</dt>
                  <dd>{formatDate(source.retrievedAt)}</dd>
                </>
              )}
            </dl>
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block underline decoration-ash-600 hover:text-bone-100"
            >
              {source.urlLabel ?? "Consulter la source"}
            </a>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </span>
  );
}

export const EFFIS = {
  name: "EFFIS",
  fullName: "EFFIS — European Forest Fire Information System (Copernicus, Commission européenne / JRC)",
  licence: "CC BY 4.0",
  licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
} as const;

export const BDIFF = {
  name: "BDIFF",
  fullName: "BDIFF — Base de données sur les incendies de forêt en France (IGN, ministère de l’Agriculture)",
  licence: "Licence Ouverte 2.0",
  licenceUrl: "https://www.etalab.gouv.fr/licence-ouverte-open-licence/",
  url: "https://bdiff.agriculture.gouv.fr/incendies",
} as const;

export const FIRMS = {
  name: "NASA FIRMS",
  fullName: "NASA FIRMS — Fire Information for Resource Management System, VIIRS 375 m",
  licence: "Données ouvertes de la NASA",
  licenceUrl: "https://www.earthdata.nasa.gov/data/tools/firms",
  url: "https://firms.modaps.eosdis.nasa.gov/",
} as const;

export const IGN_ADMIN = {
  name: "IGN",
  fullName: "IGN — ADMIN EXPRESS COG CARTO (limites administratives)",
  licence: "Licence Ouverte Etalab 2.0",
  licenceUrl: "https://www.etalab.gouv.fr/licence-ouverte-open-licence/",
  url: "https://geoservices.ign.fr/adminexpress",
} as const;
