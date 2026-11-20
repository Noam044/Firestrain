import Link from "next/link";
import effisIndexJson from "@/public/data/effis/index.json";
import { EffisIndexSchema } from "@/lib/data/schemas";
import { formatInteger } from "@/lib/format";
import { Reveal } from "@/components/motion/reveal";
import { Tooltip } from "@/components/ui/tooltip";

const index = EffisIndexSchema.parse(effisIndexJson);

/**
 * Twenty years at a glance: one bar per year (fires of 30 ha or more), each
 * reopening that year on the map. Columns from tablets up; on phones one row per
 * year with a horizontal bar, so every year stays a full-width target and
 * nothing scrolls sideways.
 */
export function Archives() {
  const years = index.years;
  const max = Math.max(...years.map((y) => y.areaHaAtLeast30));
  const peak = years.find((y) => y.areaHaAtLeast30 === max);
  const label = (year: (typeof years)[number]) =>
    `${year.year} : ${formatInteger(year.areaHaAtLeast30)} ha. Ouvrir cette année sur la carte`;
  const barClass = (isPeak: boolean) =>
    `block rounded-sm transition-[transform,background-color] duration-300 ease-out ${isPeak ? "bg-signal" : "bg-rule-strong group-hover:bg-ink-3"}`;

  return (
    <section aria-labelledby="archives-titre" className="border-t border-rule bg-sheet">
      <div className="mx-auto max-w-[1320px] px-5 py-16 md:px-8 lg:py-24">
        <Reveal className="max-w-[60ch]">
          <h2 id="archives-titre" className="text-3xl leading-tight sm:text-4xl">
            Archives depuis 2006
          </h2>
          <p className="mt-4 leading-7 text-ink-2">
            Surface brûlée par les feux de 30 ha ou plus, année par année, selon EFFIS. Un clic sur une année l’ouvre
            sur la carte.
          </p>
        </Reveal>

        {/* Tablets and up: columns. */}
        <div className="mt-14 hidden md:block">
          <ol className="grid h-56 items-end gap-2" style={{ gridTemplateColumns: `repeat(${years.length}, minmax(0, 1fr))` }}>
            {years.map((year, k) => {
              const isPeak = year === peak;
              return (
                <li key={year.year} className="relative h-full">
                  {isPeak && (
                    <span
                      className={`figure absolute -top-1 -translate-y-full whitespace-nowrap text-xs text-ink-2 ${
                        k === years.length - 1 ? "right-0" : "left-1/2 -translate-x-1/2"
                      }`}
                    >
                      {formatInteger(year.areaHaAtLeast30)} ha
                    </span>
                  )}
                  {/* The whole column is the target, not only the bar (small years are a few pixels high). */}
                  <Tooltip label={`${year.year} : ${formatInteger(year.areaHaAtLeast30)} ha`}>
                    <Link href={`/carte?annee=${year.year}`} aria-label={label(year)} className="group flex h-full flex-col justify-end">
                      <span
                        className={`${barClass(isPeak)} origin-bottom rounded-b-none group-hover:scale-y-[1.04]`}
                        style={{ height: `max(3px, ${(year.areaHaAtLeast30 / max) * 100}%)` }}
                      />
                    </Link>
                  </Tooltip>
                </li>
              );
            })}
          </ol>
          <ol aria-hidden className="mt-2 grid gap-2 border-t border-rule-strong pt-2" style={{ gridTemplateColumns: `repeat(${years.length}, minmax(0, 1fr))` }}>
            {years.map((year, k) => (
              <li key={year.year} className="figure text-center text-xs text-ink-3">
                {k % 5 === 0 || k === years.length - 1 ? year.year : ""}
              </li>
            ))}
          </ol>
        </div>

        {/* Phones: one row per year, newest first. */}
        <ol className="mt-10 space-y-1 md:hidden">
          {[...years].reverse().map((year) => {
            const isPeak = year === peak;
            return (
              <li key={year.year}>
                <Link
                  href={`/carte?annee=${year.year}`}
                  className="group grid min-h-7 grid-cols-[3rem_minmax(0,1fr)_5.5rem] items-center gap-3 rounded-sm py-0.5"
                >
                  <span className="figure text-xs text-ink-3">{year.year}</span>
                  <span className="h-2.5">
                    <span
                      className={`${barClass(isPeak)} h-full origin-left group-hover:scale-x-[1.03]`}
                      style={{ width: `max(3px, ${(year.areaHaAtLeast30 / max) * 100}%)` }}
                    />
                  </span>
                  <span className={`figure text-right text-xs ${isPeak ? "text-ink" : "text-ink-3"}`}>
                    {formatInteger(year.areaHaAtLeast30)} ha
                  </span>
                  {/* The visible year and area are the link's name; this completes it for screen readers. */}
                  <span className="sr-only">. Ouvrir cette année sur la carte</span>
                </Link>
              </li>
            );
          })}
        </ol>

        <p className="mt-6">
          <Link href="/liste" className="link-draw font-semibold text-ink-2">
            Toutes les surfaces dans la liste des feux
          </Link>
        </p>
      </div>
    </section>
  );
}
