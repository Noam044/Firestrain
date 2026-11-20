"use client";

import { ArrowRight } from "@phosphor-icons/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { useLiveSummary } from "./live";
import { ThermalView } from "./ThermalView";

/** Live status: when EFFIS was last read. The pulsing dot is a real state, not a decoration. */
function LiveStatus({ asOf, error }: { asOf: string | undefined; error: boolean }) {
  return (
    <p className="inline-flex items-center gap-2 rounded-md border border-rule-strong bg-sheet/80 px-2.5 py-1 text-xs text-ink-2">
      <span aria-hidden className="relative flex size-2">
        {asOf && <span className="absolute inline-flex size-full animate-ping rounded-full bg-signal opacity-60 motion-reduce:hidden" />}
        <span className={`relative inline-flex size-2 rounded-full ${asOf ? "bg-signal" : "bg-ink-3"}`} />
      </span>
      <span className="figure">
        {asOf ? `Relevé EFFIS du ${formatDateTime(asOf)}` : error ? "Relevé en direct indisponible" : "Relevé EFFIS en cours"}
      </span>
    </p>
  );
}

/** The home page's opening: the promise, the way to the map, and the map's picture. */
export function Hero() {
  const { summary, error } = useLiveSummary();
  return (
    <section aria-labelledby="accueil-titre" className="relative overflow-hidden border-b border-rule">
      <div aria-hidden className="sensor-grid pointer-events-none absolute inset-0" />
      <div className="relative mx-auto grid max-w-[1320px] items-center gap-10 px-5 pb-14 pt-10 md:px-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-12 lg:pb-20 lg:pt-14">
        <div>
          <LiveStatus asOf={summary?.asOf} error={error} />
          <h1
            id="accueil-titre"
            className="mt-6 text-[2.5rem] leading-[1.02] tracking-[-0.04em] sm:text-[3.4rem] xl:text-[3.9rem]"
          >
            Les feux de forêt en France, <span className="text-signal-ink">en direct.</span>
          </h1>
          <p className="mt-6 max-w-[36ch] text-lg leading-8 text-ink-2">
            Chaque surface brûlée détectée par satellite depuis douze mois, sur une carte en relief relevée chaque heure.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button asChild variant="signal" size="lg">
              <Link href="/carte">
                Explorer la carte
                <ArrowRight size={18} weight="bold" />
              </Link>
            </Button>
            <Link href="/methode" className="text-sm font-semibold text-ink-2 underline decoration-rule-strong underline-offset-4 hover:text-ink">
              Comment c’est mesuré
            </Link>
          </div>
        </div>
        <ThermalView fires={summary?.fires} />
      </div>
    </section>
  );
}
