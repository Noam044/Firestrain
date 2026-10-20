import Link from "next/link";
import { MapStageLoader } from "@/components/scene/MapStageLoader";
import { MapCredits } from "@/components/ui/MapCredits";
import { mapCredits } from "@/lib/data/manifest";

export default function StoryPage() {
  return (
    <main id="contenu">
      <section className="relative h-[calc(100dvh-var(--header-h))] min-h-[560px] overflow-hidden">
        <MapStageLoader mode="story" />

        <div className="pointer-events-none relative z-10 mx-auto grid h-full max-w-[1440px] grid-cols-12 px-4 md:px-10">
          <div className="pointer-events-auto col-span-12 self-end pb-24 md:col-span-6 md:pb-28 lg:col-span-5">
            <p className="label-caps text-bone-300">Feux de forêt · France métropolitaine</p>
            <h1 className="mt-3 text-[clamp(3.25rem,9vw,7.5rem)] leading-[0.92] tracking-[-0.025em]">
              FireStrain
            </h1>
            <p className="mt-6 max-w-[30rem] font-serif text-xl leading-snug text-bone-300 md:text-2xl">
              Les surfaces brûlées en France métropolitaine en 2026, relevées par satellite et
              replacées parmi les années 2006 à 2025.
            </p>
            <p className="mt-5 max-w-[30rem] text-sm text-ash-400">
              Le récit pas à pas est en préparation. La carte en relief est déjà consultable.
            </p>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3">
              <Link
                href="/explorer"
                className="label-caps border border-bone-100 px-4 py-2.5 text-bone-100 no-underline transition-colors hover:bg-bone-100 hover:text-ash-950"
              >
                Explorer la carte
              </Link>
              <Link href="/methode" className="label-caps py-2.5 text-bone-300 hover:text-bone-100">
                Méthode et sources
              </Link>
            </div>
          </div>
        </div>

        <MapCredits
          credits={mapCredits()}
          className="absolute inset-x-4 bottom-3 z-10 md:inset-x-10 md:text-right"
        />
      </section>
    </main>
  );
}
