"use client";

import Link from "next/link";
import { Dialog } from "radix-ui";
import type { ElementType, ReactNode } from "react";
import { formatDateTime, formatDecimal, formatInteger, formatLocalDateTime } from "@/lib/format";
import type { DecodedFire } from "@/lib/data/fires";
import { useBdiffAnnual, useBdiffMatches, useEffisYear, useManifest } from "@/lib/data/queries";
import { LAND_COVER_KEYS, type LandCoverKey } from "@/lib/data/schemas";
import { useMapStore } from "@/lib/store";
import { useMediaQuery } from "@/lib/use-media-query";
import { BDIFF, EFFIS, SourceTag } from "./SourceTag";

/** CORINE-based classes used by EFFIS, in French. */
const LAND_COVER_LABELS: Record<LandCoverKey, string> = {
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

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="label-caps text-ash-400">{label}</dt>
      <dd className="mt-1 text-sm leading-5 text-bone-100">{children}</dd>
    </div>
  );
}

function LandCover({ values }: { values: DecodedFire["landCover"] }) {
  if (!values) return <span className="text-bone-300">non renseignée par EFFIS</span>;
  const rows = LAND_COVER_KEYS.map((key, i) => ({ key, value: values[i] }))
    .filter((row) => row.value >= 0.5)
    .sort((a, b) => b.value - a.value);
  return (
    <ul className="space-y-1.5">
      {rows.map((row) => (
        <li key={row.key} className="text-xs text-bone-300">
          <div className="flex justify-between gap-3">
            <span>{LAND_COVER_LABELS[row.key]}</span>
            <span className="font-mono tabular text-bone-100">{formatDecimal(row.value, 1)} %</span>
          </div>
          <div className="mt-0.5 h-1 bg-ash-800" aria-hidden>
            <div className="h-full bg-ash-400" style={{ width: `${row.value}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function FireDetails({ fire, year, Title, onClose }: { fire: DecodedFire; year: number; Title: ElementType; onClose: ReactNode }) {
  const manifest = useManifest();
  const matches = useBdiffMatches();
  const annual = useBdiffAnnual();
  const match = matches.data?.matches[String(fire.id)];
  const bdiffPublished = annual.data ? year <= annual.data.availableUpTo : null;

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label-caps text-ash-400">Surface brûlée · EFFIS</p>
          <Title id="feu-titre" className="mt-1 font-serif text-2xl leading-tight text-bone-100">
            {fire.commune || "Commune non renseignée"}
          </Title>
          <p className="text-sm text-bone-300">{fire.province}</p>
        </div>
        {onClose}
      </div>

      <dl className="mt-4 space-y-4">
        <Row label="Surface brûlée">
          <span className="font-serif text-3xl leading-none tabular">{formatInteger(fire.areaHa)} ha</span>
          <div className="mt-1">
            <SourceTag
              source={{
                ...EFFIS,
                dataDate: fire.lastUpdate,
                retrievedAt: manifest.data?.files[`effis/fires-${year}.json`]?.retrievedAt,
                url: `https://api.effis.emergency.copernicus.eu/rest/2/burntareas/current/${fire.id}/`,
                urlLabel: "Fiche EFFIS de ce polygone",
                note: "Surface cartographiée par satellite. Ce n’est pas la surface déclarée par les services d’incendie.",
              }}
            />
          </div>
        </Row>
        <Row label="Première détection satellite">{formatDateTime(fire.firedate)}</Row>
        <Row label="Fin du feu">
          non renseignée <span className="text-bone-300">(EFFIS ne publie pas de date de fin)</span>
        </Row>
        <Row label="Surface déclarée (BDIFF)">
          {bdiffPublished === false ? (
            <span className="text-bone-300">
              non diffusée : la BDIFF publie les feux jusqu’à l’année précédente.
            </span>
          ) : match ? (
            <>
              <span className="font-mono tabular">
                {match.areaHa === null ? "surface non renseignée" : `${formatDecimal(match.areaHa, match.areaHa < 100 ? 1 : 0)} ha`}
              </span>
              <p className="mt-1 text-xs leading-4 text-bone-300">
                Fiche n° {match.numero} — départ à {match.commune} ({match.departement}), alerte du{" "}
                {formatLocalDateTime(match.alert)}
                {match.cause ? `, cause : ${match.cause.toLowerCase()}` : ""}.
              </p>
              <p className="mt-1 text-xs leading-4 text-ash-400">
                Rapprochement automatique (commune touchée et date proche, candidat unique).
                {match.sharedWith.length > 0 &&
                  ` La même fiche est rapprochée de ${match.sharedWith.length} autre${match.sharedWith.length > 1 ? "s" : ""} polygone${match.sharedWith.length > 1 ? "s" : ""} EFFIS.`}
              </p>
              <div className="mt-1">
                <SourceTag
                  source={{
                    ...BDIFF,
                    retrievedAt: manifest.data?.files["bdiff/rapprochements.json"]?.retrievedAt,
                  }}
                />
              </div>
            </>
          ) : matches.data ? (
            <span className="text-bone-300">
              aucune fiche rapprochée de façon univoque.{" "}
              <Link href="/methode" className="underline decoration-ash-600 hover:text-bone-100">
                Méthode
              </Link>
            </span>
          ) : (
            <span className="font-mono text-xs text-ash-400">{matches.error ? "BDIFF indisponible." : "Chargement…"}</span>
          )}
        </Row>
        <Row label="Couverture du sol (EFFIS)">
          <LandCover values={fire.landCover} />
        </Row>
        <Row label="En zone Natura 2000">
          {fire.natura2000Pct === null ? (
            <span className="text-bone-300">non renseigné</span>
          ) : (
            <span className="font-mono tabular">{formatDecimal(fire.natura2000Pct, 1)} %</span>
          )}
        </Row>
        <Row label="Dégâts">
          <span className="text-bone-300">non renseignés</span>
        </Row>
      </dl>

      <p className="mt-4 border-t border-ash-800 pt-3 text-[11px] leading-4 text-ash-400">
        Commune indiquée par EFFIS : ce n’est pas nécessairement la commune où le feu a démarré. Identifiant EFFIS{" "}
        {fire.id}.
      </p>
    </>
  );
}

/** Details of the selected burnt area: side panel on wide screens, bottom sheet on phones. */
export function FirePanel() {
  const year = useMapStore((state) => state.year);
  const selectedFireId = useMapStore((state) => state.selectedFireId);
  const selectFire = useMapStore((state) => state.selectFire);
  const current = useEffisYear(year);
  const wide = useMediaQuery("(min-width: 768px)", true);
  const fire = current.data?.fires.find((candidate) => candidate.id === selectedFireId) ?? null;

  const announcement = fire
    ? `Surface brûlée sélectionnée : ${fire.commune}, ${fire.province}, ${formatInteger(fire.areaHa)} hectares selon EFFIS.`
    : "";
  const closeButton = (
    <button
      type="button"
      onClick={() => selectFire(null)}
      className="label-caps shrink-0 border border-ash-700 px-2 py-1 text-bone-300 hover:text-bone-100"
    >
      Fermer
    </button>
  );

  return (
    <>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {fire && wide && (
        <aside
          aria-labelledby="feu-titre"
          className="pointer-events-auto min-h-0 w-80 overflow-y-auto border border-ash-800 bg-ash-950 p-4"
        >
          <FireDetails fire={fire} year={year} Title="h2" onClose={closeButton} />
        </aside>
      )}
      <Dialog.Root open={Boolean(fire) && !wide} onOpenChange={(open) => !open && selectFire(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-ash-950/60" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[75dvh] overflow-y-auto border-t border-ash-700 bg-ash-950 p-4"
          >
            {fire && (
              <FireDetails
                fire={fire}
                year={year}
                Title={Dialog.Title}
                onClose={
                  <Dialog.Close className="label-caps shrink-0 border border-ash-700 px-2 py-1 text-bone-300 hover:text-bone-100">
                    Fermer
                  </Dialog.Close>
                }
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
