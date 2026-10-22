"use client";

import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_text,
  tableFeatures,
  useTable,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import Link from "next/link";
import { parseAsInteger, useQueryState } from "nuqs";
import { useMemo, useState } from "react";
import { formatDateTime, formatDecimal, formatInteger } from "@/lib/format";
import { LAND_COVER_LABELS } from "@/lib/data/land-cover";
import { useBdiffMatches, useEffisIndex, useEffisYear, useManifest } from "@/lib/data/queries";
import { LAND_COVER_KEYS } from "@/lib/data/schemas";
import { FIRST_YEAR, LAST_YEAR } from "@/lib/store";
import { BDIFF, EFFIS, SourceTag } from "./SourceTag";

type FireRow = {
  id: number;
  commune: string;
  department: string;
  firedate: string;
  /** Month of the first detection in Paris, 1–12. */
  month: number;
  areaHa: number;
  /** Undefined when unknown, so that sorting puts these rows last. */
  landCover?: string;
  bdiffHa?: number;
};

const YEARS = Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, i) => LAST_YEAR - i);
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const parisMonth = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", month: "numeric" });

const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  rowPaginationFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text },
  filterFns: { includesString: filterFn_includesString },
});
const helper = createColumnHelper<typeof features, FireRow>();
const columns = helper.columns([
  helper.accessor("commune", { header: "Commune (EFFIS)", sortFn: "text" }),
  helper.accessor("department", { header: "Département", sortFn: "text" }),
  helper.accessor("firedate", {
    header: "Première détection",
    enableGlobalFilter: false,
    cell: (info) => formatDateTime(info.getValue()),
  }),
  helper.accessor("areaHa", {
    header: "Surface EFFIS",
    enableGlobalFilter: false,
    sortDescFirst: true,
    cell: (info) => `${formatInteger(info.getValue())} ha`,
  }),
  helper.accessor("landCover", {
    header: "Couvert principal",
    enableGlobalFilter: false,
    sortUndefined: "last",
    cell: (info) => info.getValue() ?? "non renseigné",
  }),
  helper.accessor("bdiffHa", {
    header: "Surface BDIFF",
    enableGlobalFilter: false,
    sortDescFirst: true,
    sortUndefined: "last",
    cell: (info) => {
      const value = info.getValue();
      return value === undefined ? "—" : `${formatDecimal(value, value < 10 ? 1 : 0)} ha`;
    },
  }),
]);

const NUMERIC = new Set(["areaHa", "bdiffHa", "firedate"]);
const ARIA_SORT = { asc: "ascending", desc: "descending" } as const;

/** Every EFFIS burnt area of a year: sortable, filterable, with a link to the map. The accessible alternative to the 3D view. */
export function FiresTable() {
  const [year, setYear] = useQueryState("year", parseAsInteger.withDefault(LAST_YEAR).withOptions({ history: "replace" }));
  const [month, setMonth] = useState(0);
  const [atLeast30, setAtLeast30] = useState(true);
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "areaHa", desc: true }]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 50 });

  const safeYear = year >= FIRST_YEAR && year <= LAST_YEAR ? year : LAST_YEAR;
  const fires = useEffisYear(safeYear);
  const matches = useBdiffMatches();
  const index = useEffisIndex();
  const manifest = useManifest();
  const entry = index.data?.years.find((y) => y.year === safeYear);

  const allRows = useMemo<FireRow[]>(
    () =>
      (fires.data?.fires ?? []).map((fire) => {
        const shares = fire.landCover;
        const top = shares ? shares.indexOf(Math.max(...shares)) : -1;
        const match = matches.data?.matches[String(fire.id)];
        return {
          id: fire.id,
          commune: fire.commune || "non renseignée",
          department: fire.province,
          firedate: fire.firedate,
          month: Number(parisMonth.format(new Date(fire.firedate))),
          areaHa: fire.areaHa,
          landCover: top >= 0 && shares![top] > 0 ? LAND_COVER_LABELS[LAND_COVER_KEYS[top]] : undefined,
          bdiffHa: match?.areaHa ?? undefined,
        };
      }),
    [fires.data, matches.data],
  );
  const data = useMemo(
    () => allRows.filter((row) => (!atLeast30 || row.areaHa >= 30) && (month === 0 || row.month === month)),
    [allRows, atLeast30, month],
  );

  const table = useTable({
    features,
    columns,
    data,
    state: { sorting, pagination, globalFilter: search },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onGlobalFilterChange: (updater) => setSearch((previous) => (typeof updater === "function" ? updater(previous) : updater) ?? ""),
    globalFilterFn: "includesString",
    enableSortingRemoval: false,
  });

  const filtered = table.getFilteredRowModel().rows;
  const shownArea = filtered.reduce((sum, row) => sum + row.original.areaHa, 0);
  const pageCount = table.getPageCount();
  const resetPage = () => setPagination((p) => ({ ...p, pageIndex: 0 }));

  return (
    <div>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <label className="flex flex-col gap-1 text-xs text-ink-3">
          Année
          <select
            value={safeYear}
            onChange={(event) => {
              void setYear(Number(event.target.value));
              resetPage();
            }}
            className="border border-rule bg-sheet px-2 py-1.5 tabular text-sm text-ink"
          >
            {YEARS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-3">
          Mois de première détection
          <select
            value={month}
            onChange={(event) => {
              setMonth(Number(event.target.value));
              resetPage();
            }}
            className="border border-rule bg-sheet px-2 py-1.5 text-sm text-ink"
          >
            <option value={0}>toute l’année</option>
            {MONTHS.map((label, k) => (
              <option key={label} value={k + 1}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-3">
          Commune ou département
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              resetPage();
            }}
            placeholder="ex. Gironde"
            className="w-56 border border-rule bg-sheet px-2 py-1.5 text-sm text-ink placeholder:text-ink-3"
          />
        </label>
        <label className="flex items-center gap-2 py-1.5 text-sm text-ink-2">
          <input
            type="checkbox"
            checked={atLeast30}
            onChange={(event) => {
              setAtLeast30(event.target.checked);
              resetPage();
            }}
            className="size-4 accent-moss"
          />
          Feux de 30 ha ou plus (seuil des statistiques EFFIS)
        </label>
      </div>

      <p className="mt-5 text-sm text-ink-2" aria-live="polite">
        {fires.isPending
          ? "Chargement des surfaces brûlées…"
          : fires.error
            ? `Les surfaces de ${safeYear} n’ont pas pu être chargées : ${fires.error.message}`
            : `${formatInteger(filtered.length)} surfaces, ${formatInteger(Math.round(shownArea))} ha selon EFFIS.`}
      </p>
      <div className="mt-1 flex flex-col gap-2">
        <SourceTag
          source={{
            ...EFFIS,
            url: "https://forest-fire.emergency.copernicus.eu/apps/effis.statistics/",
            dataDate: entry?.lastUpdate,
            retrievedAt: manifest.data?.files[`effis/fires-${safeYear}.json`]?.retrievedAt,
          }}
        />
        <SourceTag
          source={{
            ...BDIFF,
            retrievedAt: manifest.data?.files["bdiff/rapprochements.json"]?.retrievedAt,
            note: "Surface déclarée au BDIFF, affichée seulement quand une fiche correspond sans ambiguïté au contour (rapprochement automatique). Elle n’est jamais additionnée à EFFIS.",
          }}
        />
      </div>

      <div className="mt-4 overflow-x-auto border-y border-rule">
        <table className="w-full min-w-[52rem] border-collapse text-sm">
          <caption className="sr-only">
            {`Surfaces brûlées cartographiées par EFFIS en ${safeYear}, triables par colonne. Le nom de chaque commune mène au feu sur la carte.`}
          </caption>
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id} className="border-b border-rule text-left">
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={sorted ? ARIA_SORT[sorted] : "none"}
                      className={`px-3 py-2 font-normal text-ink-3 ${NUMERIC.has(header.id) ? "text-right" : ""}`}
                    >
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap hover:text-ink"
                      >
                        <table.FlexRender header={header} />
                        <span aria-hidden className="w-2 tabular text-[10px]">
                          {sorted === "asc" ? "▲" : sorted === "desc" ? "▼" : ""}
                        </span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b border-rule last:border-0 hover:bg-paper">
                {row.getAllCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={`px-3 py-2 ${
                      NUMERIC.has(cell.column.id) ? "whitespace-nowrap text-right tabular" : ""
                    } ${cell.column.id === "commune" ? "text-ink" : "text-ink-2"}`}
                  >
                    {cell.column.id === "commune" ? (
                      // The first column carries the link, so it stays reachable on narrow screens.
                      <Link
                        href={`/?year=${safeYear}&fire=${row.original.id}`}
                        className="underline decoration-rule underline-offset-4 hover:decoration-ink-3"
                      >
                        {row.original.commune}
                        <span className="sr-only"> (voir sur la carte)</span>
                      </Link>
                    ) : (
                      <table.FlexRender cell={cell} />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <nav aria-label="Pages de la liste" className="mt-4 flex items-center gap-3 text-sm text-ink-2">
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="border border-rule px-2.5 py-1 hover:border-ink-3 disabled:opacity-40"
          >
            Précédente
          </button>
          <span className="tabular">
            page {pagination.pageIndex + 1} sur {pageCount}
          </span>
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="border border-rule px-2.5 py-1 hover:border-ink-3 disabled:opacity-40"
          >
            Suivante
          </button>
        </nav>
      )}
    </div>
  );
}
