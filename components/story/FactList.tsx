import { formatInteger } from "@/lib/format";
import type { StoryFact } from "@/lib/data/schemas";
import { SourceTag } from "@/components/ui/SourceTag";

/** "environ 42 000 ha", "plus de 220 000 personnes", "jusqu’à 563 M€", or the fact's own wording. */
export function factValue(fact: StoryFact): string {
  if (fact.display) return fact.display;
  const prefix = fact.atLeast ? "plus de " : fact.upTo ? "jusqu’à " : fact.approximate ? "environ " : "";
  return `${prefix}${formatInteger(fact.value ?? 0)} ${fact.unit ?? ""}`.trim();
}

export function factSource(fact: StoryFact, retrievedAt: string) {
  return {
    name: fact.source.split(",")[0],
    fullName: fact.source,
    dataDate: fact.dataDate,
    retrievedAt,
    url: fact.url,
    urlLabel: `Lire la page (publiée le ${fact.published.split("-").reverse().join("/")})`,
    quote: fact.quote,
    note: fact.provisional ? "Bilan provisoire au moment de la publication." : undefined,
  };
}

/** Sourced facts of one event: value, label, and the source tag with its quote. */
export function FactList({ facts, retrievedAt }: { facts: readonly StoryFact[]; retrievedAt: string }) {
  return (
    <dl className="mt-5 divide-y divide-ash-800 border-y border-ash-800">
      {facts.map((fact) => (
        <div key={fact.id} className="py-2.5">
          <dt className="text-xs text-ash-400">{fact.label}</dt>
          <dd className="mt-0.5">
            <span className="font-serif text-xl leading-tight text-bone-100">{factValue(fact)}</span>
            {fact.note && <span className="ml-2 text-xs text-bone-300">{fact.note}</span>}
            <div className="mt-1">
              <SourceTag source={factSource(fact, retrievedAt)} />
            </div>
          </dd>
        </div>
      ))}
    </dl>
  );
}
