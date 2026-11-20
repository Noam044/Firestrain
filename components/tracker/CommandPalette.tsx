"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import { Command } from "cmdk";
import { useMemo, useState, type ReactNode } from "react";
import { Kbd } from "@/components/ui/kbd";
import { AGE_CLASSES, ageClass } from "@/components/scene/markers";
import { formatArea, formatDayMonth, formatMonthYear } from "@/lib/format";
import { useSpanFires } from "@/lib/data/span-fires";
import { BASEMAPS } from "@/lib/geo/basemaps";
import { FIRST_YEAR, LAST_YEAR, useMapStore } from "@/lib/store";

const MAX_FIRES = 30;
/** Accent- and case-insensitive search key. */
const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

function Item({
  onSelect,
  children,
  value,
}: {
  onSelect: () => void;
  children: ReactNode;
  value: string;
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-ink-2 data-[selected=true]:bg-raised data-[selected=true]:text-ink"
    >
      {children}
    </Command.Item>
  );
}

const groupClass =
  "[&_[cmdk-group-heading]]:label [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3";

/**
 * Search everything the map can show, after shadcn/ui's Command (cmdk): a fire
 * by commune or département, a month of the window, an archive year, a base
 * map. Loaded on first use by CommandMenu, which owns the shortcut and the button.
 */
export default function CommandPalette({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const { span, fires } = useSpanFires();

  const needle = fold(query.trim());
  const matchingFires = useMemo(() => {
    if (!fires || needle.length < 2) return [];
    return fires
      .filter((fire) =>
        fold(`${fire.commune} ${fire.province}`).includes(needle),
      )
      .sort((a, b) => b.firedate.localeCompare(a.firedate))
      .slice(0, MAX_FIRES);
  }, [fires, needle]);
  const months = (span?.months ?? [])
    .map((month, index) => ({ index, label: formatMonthYear(month) }))
    .filter((m) => !needle || fold(m.label).includes(needle))
    .reverse();
  const years = Array.from(
    { length: LAST_YEAR - FIRST_YEAR + 1 },
    (_, k) => LAST_YEAR - k,
  ).filter((year) => !needle || String(year).includes(needle));
  const basemaps = BASEMAPS.filter(
    (b) => !needle || fold(`fond ${b.label}`).includes(needle),
  );

  const run = (action: () => void) => {
    action();
    setOpen(false);
    setQuery("");
  };
  const store = useMapStore.getState;

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Rechercher sur la carte"
      shouldFilter={false}
      overlayClassName="fixed inset-0 z-50 bg-paper/70 backdrop-blur-sm"
      contentClassName="fixed left-1/2 top-[12vh] z-50 w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-lg border border-rule-strong bg-sheet shadow-pop"
    >
      <div className="flex items-center gap-2 border-b border-rule px-3">
        <MagnifyingGlass
          size={16}
          weight="bold"
          aria-hidden
          className="text-ink-3"
        />
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder="Une commune, un département, un mois, une année…"
          className="h-12 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
        />
        <Kbd>Échap</Kbd>
      </div>
      <Command.List className="max-h-[min(60vh,440px)] overflow-y-auto p-1.5">
        <Command.Empty className="px-3 py-6 text-center text-sm text-ink-3">
          Rien ne correspond.
        </Command.Empty>
        {matchingFires.length > 0 && (
          <Command.Group heading="Feux de la période" className={groupClass}>
            {matchingFires.map((fire) => (
              <Item
                key={fire.id}
                value={`feu-${fire.id}`}
                onSelect={() =>
                  run(() => {
                    store().selectFire(fire.id);
                    store().requestCamera({ kind: "bbox", bbox: fire.bbox });
                  })
                }
              >
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{
                    background: `var(${AGE_CLASSES[ageClass(fire.ageDays)].token})`,
                  }}
                />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-semibold text-ink">
                    {fire.commune || "Commune non renseignée"}
                  </span>
                  <span className="text-ink-3">, {fire.province}</span>
                </span>
                <span className="figure text-xs text-ink-3">
                  {formatDayMonth(fire.firedate)}
                </span>
                <span className="figure w-20 text-right text-ink">
                  {formatArea(fire.areaHa)} ha
                </span>
              </Item>
            ))}
          </Command.Group>
        )}
        {months.length > 0 && (
          <Command.Group heading="Mois" className={groupClass}>
            {months.slice(0, needle ? 12 : 4).map((month) => (
              <Item
                key={month.index}
                value={`mois-${month.index}`}
                onSelect={() => run(() => store().setMonth(month.index))}
              >
                <span className="first-letter:uppercase">{month.label}</span>
              </Item>
            ))}
          </Command.Group>
        )}
        {years.length > 0 && needle && (
          <Command.Group heading="Archives" className={groupClass}>
            {years.slice(0, 6).map((year) => (
              <Item
                key={year}
                value={`annee-${year}`}
                onSelect={() => run(() => store().setArchiveYear(year))}
              >
                Année {year}
              </Item>
            ))}
          </Command.Group>
        )}
        {basemaps.length > 0 && (
          <Command.Group heading="Fond de carte" className={groupClass}>
            {basemaps.map((basemap) => (
              <Item
                key={basemap.id}
                value={`fond-${basemap.id}`}
                onSelect={() => run(() => store().setBasemap(basemap.id))}
              >
                {basemap.label}
              </Item>
            ))}
          </Command.Group>
        )}
      </Command.List>
      <p className="border-t border-rule px-3 py-2 text-xs text-ink-3">
        Tapez au moins deux lettres pour chercher un feu dans la période
        affichée.
      </p>
    </Command.Dialog>
  );
}
