"use client";

import Link from "next/link";
import { Select } from "radix-ui";
import { useState } from "react";
import { useMediaQuery } from "@/lib/use-media-query";
import { formatInteger } from "@/lib/format";
import { useBdiffAnnual, useEffisIndex, useManifest } from "@/lib/data/queries";
import { FIRST_YEAR, LAST_YEAR, useMapStore } from "@/lib/store";
import { BDIFF, EFFIS, SourceTag } from "./SourceTag";

const YEARS = Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, i) => LAST_YEAR - i);

/** Year selector with that year's totals, EFFIS and BDIFF kept apart. */
export function YearPanel() {
  const year = useMapStore((state) => state.year);
  const setYear = useMapStore((state) => state.setYear);
  const showHistory = useMapStore((state) => state.showHistory);
  const setShowHistory = useMapStore((state) => state.setShowHistory);
  // Keep only the essentials while a burnt area is inspected, and on phones unless
  // unfolded, so the map stays visible.
  const inspecting = useMapStore((state) => state.selectedFireId !== null);
  const wide = useMediaQuery("(min-width: 768px)", true);
  const [unfolded, setUnfolded] = useState(false);
  const compact = inspecting || (!wide && !unfolded);
  const index = useEffisIndex();
  const bdiff = useBdiffAnnual();
  const manifest = useManifest();

  const effis = index.data?.years.find((entry) => entry.year === year);
  const declared = bdiff.data?.years.find((entry) => entry.year === year);
  const smallPolygons = effis ? effis.fires - effis.firesAtLeast30 : 0;

  return (
    <section aria-labelledby="annee-titre" className="w-full border border-ash-800 bg-ash-950 p-3 md:w-80">
      <div className="flex items-center justify-between gap-3">
        <h2 id="annee-titre" className="label-caps text-bone-100">
          Année
        </h2>
        <Select.Root value={String(year)} onValueChange={(value) => setYear(Number(value))}>
          <Select.Trigger
            aria-label="Année affichée"
            className="flex items-center gap-2 border border-ash-700 px-2.5 py-1 font-mono text-sm tabular text-bone-100 hover:border-bone-300"
          >
            <Select.Value />
            <Select.Icon className="text-ash-400">▾</Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Content
              position="popper"
              sideOffset={4}
              className="z-50 max-h-72 overflow-hidden border border-ash-700 bg-ash-950"
            >
              <Select.Viewport className="p-1">
                {YEARS.map((option) => (
                  <Select.Item
                    key={option}
                    value={String(option)}
                    className="cursor-default px-3 py-1 font-mono text-sm tabular text-bone-300 outline-none data-[highlighted]:bg-ash-800 data-[highlighted]:text-bone-100 data-[state=checked]:text-bone-100"
                  >
                    <Select.ItemText>{option}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      </div>

      {effis ? (
        <div className="mt-3">
          <p className="font-serif text-4xl leading-none tracking-tight tabular">
            {formatInteger(effis.areaHaAtLeast30)} <span className="text-xl">ha</span>
          </p>
          <p className="mt-1.5 text-xs leading-4 text-bone-300">
            brûlés en {year} en France métropolitaine, feux de 30 ha ou plus ({formatInteger(effis.firesAtLeast30)}{" "}
            surfaces)
          </p>
          <div className="mt-1">
            <SourceTag
              source={{
                ...EFFIS,
                dataDate: effis.lastUpdate,
                retrievedAt: manifest.data?.files[effis.file]?.retrievedAt,
                url: "https://forest-fire.emergency.copernicus.eu/apps/effis.statistics/",
                urlLabel: "Statistiques EFFIS par pays",
                note: "Total recalculé à partir des polygones EFFIS de France métropolitaine, selon le seuil de 30 ha des statistiques officielles.",
              }}
            />
          </div>
          {!compact && smallPolygons > 0 && (
            <p className="mt-2 text-[11px] leading-4 text-ash-400">
              {formatInteger(effis.areaHa)} ha en comptant les {formatInteger(smallPolygons)} surfaces de moins de 30 ha.
            </p>
          )}
          {!compact && year < 2019 && (
            <p className="mt-2 text-[11px] leading-4 text-ash-400">
              Les petites surfaces deviennent bien plus nombreuses dans EFFIS à partir de 2019 : comparez les années
              sur les feux de 30 ha ou plus.
            </p>
          )}
        </div>
      ) : (
        <p role="status" className="mt-3 font-mono text-xs text-ash-400">
          {index.error ? "Les totaux EFFIS n’ont pas pu être chargés." : "Chargement des totaux…"}
        </p>
      )}

      <div className={`${compact ? "hidden" : ""} mt-3 border-t border-ash-800 pt-3 text-xs leading-4 text-bone-300`}>
        {bdiff.data && year > bdiff.data.availableUpTo ? (
          <p>
            <span className="text-bone-100">BDIFF</span> : les feux de {year} ne sont pas encore diffusés (la
            consultation publique s’arrête à {bdiff.data.availableUpTo}).
          </p>
        ) : declared ? (
          <>
            <p>
              <span className="text-bone-100">BDIFF</span> : {formatInteger(declared.areaHa)} ha déclarés par les
              services d’incendie ({formatInteger(declared.fires)} feux, toutes tailles).
            </p>
            <div className="mt-1">
              <SourceTag
                source={{
                  ...BDIFF,
                  retrievedAt: manifest.data?.files["bdiff/annuel.json"]?.retrievedAt,
                  note: "Feux de type F (filtre par défaut de la BDIFF), France métropolitaine.",
                }}
              />
            </div>
          </>
        ) : (
          <p className="font-mono text-ash-400">{bdiff.error ? "BDIFF indisponible." : "Chargement BDIFF…"}</p>
        )}
        <p className="mt-2 text-[11px] text-ash-400">
          Les deux sources mesurent différemment : leurs chiffres ne s’additionnent pas.{" "}
          <Link href="/methode" className="underline decoration-ash-600 hover:text-bone-300">
            Pourquoi
          </Link>
        </p>
      </div>

      {!compact && year > FIRST_YEAR && (
        <label className="mt-3 flex items-center gap-2 border-t border-ash-800 pt-3 text-xs text-bone-300">
          <input
            type="checkbox"
            checked={showHistory}
            onChange={(event) => setShowHistory(event.target.checked)}
            className="size-3.5 accent-bone-100"
          />
          Années {FIRST_YEAR}–{year - 1} en hachures
        </label>
      )}
      {!compact && (
        <p className="mt-2 text-[11px] text-ash-400">
          Sélectionnez une surface brûlée sur la carte pour l’examiner, ou consultez la{" "}
          <Link href={`/liste?year=${year}`} className="underline decoration-ash-600 underline-offset-2 hover:text-bone-300">
            liste des feux de {year}
          </Link>
          .
        </p>
      )}
      {!wide && !inspecting && (
        <button
          type="button"
          aria-expanded={unfolded}
          onClick={() => setUnfolded((value) => !value)}
          className="label-caps mt-2 text-bone-300 underline decoration-ash-600 underline-offset-4"
        >
          {unfolded ? "Moins de détails" : "Plus de détails"}
        </button>
      )}
    </section>
  );
}
