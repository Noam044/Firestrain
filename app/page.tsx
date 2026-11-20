import { SiteFooter } from "@/components/brand/SiteFooter";
import { Archives } from "@/components/home/Archives";
import { Hero } from "@/components/home/Hero";
import { LatestFires } from "@/components/home/LatestFires";
import { LiveStrip } from "@/components/home/LiveStrip";
import { Sources } from "@/components/home/Sources";

/** Home page: the promise and the map's picture, the twelve months, the latest fires, the sources, the archives. */
export default function HomePage() {
  return (
    <>
      <main id="contenu">
        <Hero />
        <LiveStrip />
        <LatestFires />
        <Sources />
        <Archives />
      </main>
      <SiteFooter />
    </>
  );
}
