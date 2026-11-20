import Link from "next/link";
import effisIndexJson from "@/public/data/effis/index.json";
import { EffisIndexSchema } from "@/lib/data/schemas";
import { formatInteger } from "@/lib/format";

const index = EffisIndexSchema.parse(effisIndexJson);

/** Twenty years at a glance: one bar per year (fires of 30 ha or more), each reopening that year on the map. */
export function Archives() {
  const years = index.years;
  const max = Math.max(...years.map((y) => y.areaHaAtLeast30));
  const peak = years.find((y) => y.areaHaAtLeast30 === max);
  return (
    <section
      aria-labelledby="archives-titre"
      className="border-t border-rule bg-sheet"
    >
      <div className="mx-auto max-w-[1320px] px-5 py-16 md:px-8 lg:py-24">
        <div className="max-w-[60ch]">
          <h2
            id="archives-titre"
            className="text-3xl leading-tight sm:text-4xl"
          >
            Vingt ans d’archives, année par année
          </h2>
          <p className="mt-4 leading-7 text-ink-2">
            Surface des feux de 30 ha ou plus depuis {years[0].year}, comme les
            statistiques officielles d’EFFIS. Chaque année se rouvre sur la
            carte.
          </p>
        </div>
        {/* On phones the years scroll sideways: each column stays a comfortable target. */}
        <div className="-mx-5 mt-12 overflow-x-auto px-5 pt-6 md:mx-0 md:px-0">
          <div className="min-w-[640px]">
            <ol
              className="grid h-56 items-end gap-1 sm:gap-2"
              style={{
                gridTemplateColumns: `repeat(${years.length}, minmax(0, 1fr))`,
              }}
            >
              {years.map((year) => {
                const isPeak = year === peak;
                return (
                  <li key={year.year} className="relative h-full">
                    {isPeak && (
                      <span className="figure absolute -top-1 left-1/2 hidden -translate-x-1/2 -translate-y-full whitespace-nowrap text-xs text-ink-2 sm:block">
                        {formatInteger(year.areaHaAtLeast30)} ha
                      </span>
                    )}
                    {/* The whole column is the target, not only the bar (small years are a few pixels high). */}
                    <Link
                      href={`/carte?annee=${year.year}`}
                      aria-label={`${year.year} : ${formatInteger(year.areaHaAtLeast30)} ha. Ouvrir cette année sur la carte`}
                      className="group flex h-full flex-col justify-end"
                    >
                      <span
                        className={`block rounded-t-sm transition-colors ${isPeak ? "bg-signal" : "bg-rule-strong group-hover:bg-ink-3"}`}
                        style={{
                          height: `max(3px, ${(year.areaHaAtLeast30 / max) * 100}%)`,
                        }}
                      />
                    </Link>
                  </li>
                );
              })}
            </ol>
            <ol
              aria-hidden
              className="mt-2 grid gap-1 border-t border-rule-strong pt-2 sm:gap-2"
              style={{
                gridTemplateColumns: `repeat(${years.length}, minmax(0, 1fr))`,
              }}
            >
              {years.map((year, k) => (
                <li
                  key={year.year}
                  className="figure text-center text-[10px] text-ink-3 sm:text-xs"
                >
                  {k % 5 === 0 || k === years.length - 1 ? year.year : ""}
                </li>
              ))}
            </ol>
          </div>
        </div>
        <p className="mt-6">
          <Link
            href="/liste"
            className="font-semibold text-ink-2 underline decoration-rule-strong underline-offset-4 hover:text-ink"
          >
            Toutes les surfaces dans la liste des feux
          </Link>
        </p>
      </div>
    </section>
  );
}
