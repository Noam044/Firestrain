"use client";

import "lenis/dist/lenis.css";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { MapStageLoader } from "@/components/scene/MapStageLoader";
import { MapCredits } from "@/components/ui/MapCredits";
import { EFFIS, FIRMS, SourceTag } from "@/components/ui/SourceTag";
import type { Credit } from "@/lib/data/manifest";
import { LAND_COVER_LABELS } from "@/lib/data/land-cover";
import { LAND_COVER_KEYS, type EffisStats, type Story as StoryData } from "@/lib/data/schemas";
import { formatDate, formatDateTime, formatDecimal, formatInteger } from "@/lib/format";
import type { CameraPresetId } from "@/lib/geo/presets";
import { useMapStore, type CameraRequest } from "@/lib/store";
import { dateOfTimelineDay, timelineDayOfDate } from "@/lib/timeline";
import { useMediaQuery } from "@/lib/use-media-query";
import { CumulativeChart } from "./CumulativeChart";
import { FactList } from "./FactList";
import { ScaleComparison } from "./ScaleComparison";

gsap.registerPlugin(ScrollTrigger, SplitText);

type Step = {
  id: string;
  camera: CameraRequest["target"];
  /** Timeline days swept by the scroll through the step, or a fixed day (null: whole year). */
  days?: readonly [number, number];
  day?: number | null;
  select?: number | null;
};

export type StoryProps = {
  story: StoryData;
  weekly: EffisStats["weekly"];
  credits: Credit[];
  retrieved: { effis?: string; stats?: string; firms?: string; story?: string };
};

type StoryEvent = StoryData["events"][number];

const preset = (id: CameraPresetId, storyOffset?: number): Step["camera"] => ({ kind: "preset", preset: id, storyOffset });

/** Section of the story: a text card over the map, which stays fixed behind. */
function Chapter({ id, wide = false, children }: { id: string; wide?: boolean; children: ReactNode }) {
  return (
    <section
      data-step={id}
      aria-labelledby={`${id}-titre`}
      // On phones the card follows a stretch of map alone; on wide screens they sit side by side.
      className="pointer-events-none flex min-h-[120svh] items-end px-4 pb-[10svh] pt-[75svh] md:items-center md:px-10 md:py-0"
    >
      <div
        className={`pointer-events-auto w-full border border-ash-800 bg-ash-950 p-5 md:p-6 ${
          wide ? "md:max-w-[40rem]" : "md:max-w-[27rem]"
        }`}
      >
        {children}
      </div>
    </section>
  );
}

function Kicker({ children }: { children: ReactNode }) {
  return <p className="label-caps text-bone-300">{children}</p>;
}

function Title({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={`${id}-titre`} data-split className="mt-2 text-3xl leading-tight md:text-4xl">
      {children}
    </h2>
  );
}

/** Animated once on arrival (not with reduced motion); the full figure is always in the DOM for screen readers. */
function Counter({ value, animate }: { value: number; animate: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || !animate) return;
    const state = { value: 0 };
    const tween = gsap.to(state, {
      value,
      duration: 1.6,
      ease: "power2.out",
      onUpdate: () => {
        element.textContent = formatInteger(Math.round(state.value));
      },
    });
    return () => {
      tween.kill();
      element.textContent = formatInteger(value);
    };
  }, [value, animate]);
  return (
    <>
      <span ref={ref} aria-hidden className="tabular">
        {formatInteger(value)}
      </span>
      <span className="sr-only">{formatInteger(value)}</span>
    </>
  );
}

/** Date shown on the map while the scroll sweeps the timeline. */
function MapDate({ year }: { year: number }) {
  const day = useMapStore((state) => (state.timelineDay === null ? null : Math.floor(state.timelineDay)));
  if (day === null) return null;
  return (
    <div className="absolute right-4 top-4 border border-ash-800 bg-ash-950 px-3 py-2 md:right-10 md:top-6">
      <p className="font-mono text-sm tabular text-bone-100">{formatDate(dateOfTimelineDay(year, day))}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ash-400">
        <svg width="12" height="12" aria-hidden className="shrink-0">
          <circle cx="6" cy="6" r="4" fill="none" stroke="var(--ember)" strokeWidth="1.2" />
        </svg>
        détections FIRMS des 3 derniers jours
      </p>
    </div>
  );
}

/** Main land-cover class of an event (EFFIS, area-weighted), as a sentence fragment. */
function landCoverPhrase(event: StoryEvent, gloss: Partial<Record<string, string>> = {}) {
  const shares = event.effis.landCover;
  if (!shares) return "";
  const k = shares.indexOf(Math.max(...shares));
  const key = LAND_COVER_KEYS[k];
  const extra = gloss[key] ? ` (${gloss[key]})` : "";
  return `${formatDecimal(shares[k], 0)} % de cette surface relève de la classe « ${LAND_COVER_LABELS[key].toLowerCase()} »${extra} selon EFFIS.`;
}

export function Story({ story, weekly, credits, retrieved }: StoryProps) {
  const root = useRef<HTMLDivElement>(null);
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const { headline, year } = story;
  const event = (id: string) => {
    const found = story.events.find((e) => e.id === id);
    if (!found) throw new Error(`événement ${id} absent de story.json`);
    return found;
  };
  const february = event("fevrier-pyrenees-atlantiques");
  const trevillach = event("trevillach");
  const gironde = event("gironde");
  const varFire = event("var");
  const span = (e: StoryEvent) => [timelineDayOfDate(year, e.from) ?? 1, timelineDayOfDate(year, e.to) ?? 1] as const;

  // Cumulated area at the end of the February event, against the 2006–2025 mean (EFFIS weekly estimates).
  const marchWeek = weekly.weeks.find((w) => w.date >= february.to && w.cumulativeHa !== null);
  const outsideSeason = headline.areaHa - headline.seasonAreaHa;
  const effisSource = {
    ...EFFIS,
    url: "https://forest-fire.emergency.copernicus.eu/",
    dataDate: story.effisDataDate,
    retrievedAt: retrieved.effis,
  };
  const firmsSource = { ...FIRMS, retrievedAt: retrieved.firms };

  const steps: Step[] = [
    { id: "ouverture", camera: preset("franceStory"), day: null, select: null },
    { id: "fevrier", camera: { kind: "bbox", bbox: february.effis.bbox }, days: span(february), select: null },
    { id: "trevillach", camera: { kind: "bbox", bbox: trevillach.effis.bbox }, days: span(trevillach), select: trevillach.effis.mainId },
    { id: "gironde", camera: { kind: "bbox", bbox: gironde.effis.bbox }, days: span(gironde), select: gironde.effis.mainId },
    { id: "echelle", camera: { kind: "bbox", bbox: gironde.effis.bbox }, day: null, select: gironde.effis.mainId },
    { id: "var", camera: { kind: "bbox", bbox: varFire.effis.bbox }, days: span(varFire), select: varFire.effis.mainId },
    // The year's card is wider: France moves further right.
    { id: "annee", camera: preset("franceStory", 0.14), day: null, select: null },
    { id: "sortie", camera: preset("franceStory"), day: null, select: null },
  ];
  const stepsRef = useRef(steps);
  useEffect(() => {
    stepsRef.current = steps;
  });

  // Smooth scrolling, only without reduced motion; ScrollTrigger follows Lenis.
  useEffect(() => {
    if (reduceMotion) return;
    const lenis = new Lenis({ autoRaf: false });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, [reduceMotion]);

  // Steps: camera and selection on arrival; the timeline follows the scroll inside a step.
  // The story borrows the map state and gives the Explorer's back on leaving, once its
  // triggers are silenced and reverted (a revert must not select anything afterwards).
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const before = useMapStore.getState();
    const saved = {
      year: before.year,
      showHistory: before.showHistory,
      timelineDay: before.timelineDay,
      selectedFireId: before.selectedFireId,
      showRecent: before.showRecent,
    };
    useMapStore.setState({ year, showHistory: false, timelineDay: null, selectedFireId: null, showRecent: false, playing: false });
    let alive = true;
    const context = gsap.context(() => {
      for (const step of stepsRef.current) {
        const trigger = element.querySelector(`[data-step="${step.id}"]`);
        if (!trigger) continue;
        ScrollTrigger.create({
          trigger,
          start: "top 60%",
          end: "bottom 60%",
          onToggle: (self) => {
            if (!alive || !self.isActive) return;
            const store = useMapStore.getState();
            store.selectFire(step.select ?? null);
            store.requestCamera(step.camera);
            if (!step.days) store.setTimelineDay(step.day ?? null);
          },
        });
        if (step.days) {
          const [from, to] = step.days;
          ScrollTrigger.create({
            trigger,
            start: "top 60%",
            end: "bottom 40%",
            onUpdate: (self) => {
              if (!alive) return;
              const day = from + self.progress * (to + 1 - from);
              // Whole days with reduced motion: no fading in between.
              useMapStore.getState().setTimelineDay(Math.min(to, reduceMotion ? Math.floor(day) : day));
            },
          });
        }
      }
      if (!reduceMotion) {
        for (const title of element.querySelectorAll<HTMLElement>("[data-split]")) {
          SplitText.create(title, {
            type: "lines",
            mask: "lines",
            autoSplit: true,
            onSplit: (self) =>
              gsap.from(self.lines, {
                yPercent: 100,
                duration: 0.7,
                stagger: 0.08,
                ease: "power3.out",
                scrollTrigger: { trigger: title, start: "top 85%", once: true },
              }),
          });
        }
      }
    }, element);
    return () => {
      alive = false;
      context.revert();
      useMapStore.setState({ ...saved, playing: false, cameraRequest: null });
    };
  }, [reduceMotion, year]);

  return (
    <div ref={root} className="relative">
      <div className="sticky top-0 h-[100svh] w-full overflow-hidden">
        <MapStageLoader mode="story" />
        <MapDate year={year} />
      </div>

      <div className="relative z-10 -mt-[100svh]">
        <a
          href="#annee-titre"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:bg-ash-950 focus:px-3 focus:py-2"
        >
          Passer le récit et aller au bilan de l’année
        </a>

        <section
          data-step="ouverture"
          aria-labelledby="ouverture-titre"
          className="pointer-events-none flex min-h-[100svh] items-end px-4 pb-16 md:px-10 md:pb-24"
        >
          <div className="pointer-events-auto max-w-[34rem]">
            <p className="label-caps text-bone-300">Feux de végétation · France métropolitaine · {year}</p>
            <h1 id="ouverture-titre" className="mt-3 text-[clamp(3.25rem,9vw,7.5rem)] leading-[0.92] tracking-[-0.025em]">
              FireStrain
            </h1>
            <p className="mt-6 font-serif text-xl leading-snug text-bone-300 md:text-2xl">
              En {year}, le service européen EFFIS a cartographié par satellite les surfaces brûlées en France
              métropolitaine. Leur total est le plus élevé de sa série, commencée en 2006.
            </p>
            <p className="mt-6 font-serif text-[clamp(2.75rem,6vw,4.5rem)] leading-none text-bone-100">
              <Counter value={headline.areaHa} animate={!reduceMotion} /> <span className="text-[0.5em]">ha</span>
            </p>
            <p className="mt-2 max-w-[30rem] text-sm leading-6 text-bone-300">
              brûlés en {year} (feux de 30 ha ou plus), contre {formatInteger(headline.previousMax.areaHa)} ha en{" "}
              {headline.previousMax.year}, le précédent maximum. L’été, du 1er juin au 30 septembre, en compte{" "}
              {formatInteger(headline.seasonAreaHa)} : {formatInteger(outsideSeason)} ha ont brûlé en dehors.
            </p>
            <div className="mt-2">
              <SourceTag source={effisSource} />
            </div>
            <p className="mt-8 font-mono text-xs text-ash-400">Faire défiler pour parcourir l’année.</p>
          </div>
        </section>

        <Chapter id="fevrier">
          <Kicker>
            {formatDate(february.from)} – {formatDate(february.to)}
          </Kicker>
          <Title id="fevrier">L’hiver, en montagne</Title>
          <p className="mt-4 leading-7 text-bone-300">
            Avant l’été, les Pyrénées-Atlantiques. En deux semaines, EFFIS y cartographie{" "}
            {formatInteger(february.effis.polygons)} surfaces brûlées, pour {formatInteger(february.effis.areaHa)} ha, dans
            les vallées basques et béarnaises.{" "}
            {landCoverPhrase(february, { othernatlc: "landes, pelouses, végétation clairsemée" })}
          </p>
          {marchWeek && marchWeek.cumulativeHa !== null && (
            <p className="mt-3 leading-7 text-bone-300">
              Au {formatDate(marchWeek.date)}, la France compte déjà {formatInteger(marchWeek.cumulativeHa)} ha brûlés
              depuis janvier, contre {formatInteger(Math.round(marchWeek.cumulativeMeanHa))} ha en moyenne de{" "}
              {weekly.referenceFrom} à {year - 1} à la même date.
            </p>
          )}
          <p className="mt-3 text-sm leading-6 text-ash-400">EFFIS ne publie pas la cause des feux.</p>
          <div className="mt-3 flex flex-col gap-1">
            <SourceTag source={effisSource} />
            <SourceTag source={firmsSource} />
          </div>
        </Chapter>

        <Chapter id="trevillach">
          <Kicker>
            {formatDate(trevillach.from)} – {formatDate(trevillach.to)}
          </Kicker>
          <Title id="trevillach">Trévillach, Pyrénées-Orientales</Title>
          <p className="mt-4 leading-7 text-bone-300">
            EFFIS cartographie {formatInteger(trevillach.effis.areaHa)} ha brûlés en {trevillach.effis.polygons}{" "}
            polygones. {landCoverPhrase(trevillach, { scleroph: "garrigue, maquis" })} La préfecture parle de surface
            parcourue, estimée sur le terrain pendant la crise : les deux chiffres ne mesurent pas la même chose.
          </p>
          <FactList facts={trevillach.facts} retrievedAt={story.retrievedAt} />
        </Chapter>

        <Chapter id="gironde">
          <Kicker>
            {formatDate(gironde.from)} – {formatDate(gironde.to)}
          </Kicker>
          <Title id="gironde">Gironde, du bassin d’Arcachon à Lacanau</Title>
          <p className="mt-4 leading-7 text-bone-300">
            Première détection satellite le {formatDateTime(gironde.effis.firstDetection)}. EFFIS cartographie{" "}
            {formatInteger(gironde.effis.areaHa)} ha brûlés en {gironde.effis.polygons} polygones.{" "}
            {landCoverPhrase(gironde)}
          </p>
          <FactList facts={gironde.facts} retrievedAt={story.retrievedAt} />
        </Chapter>

        <Chapter id="echelle">
          <Kicker>À la même échelle</Kicker>
          <Title id="echelle">{formatDecimal(gironde.effis.areaHa / story.paris.areaHa, 1)} fois Paris</Title>
          <div className="mt-4">
            <ScaleComparison story={story} eventId="gironde" retrievedAt={retrieved.story} />
          </div>
        </Chapter>

        <Chapter id="var">
          <Kicker>
            {formatDate(varFire.from)} – {formatDate(varFire.to)}
          </Kicker>
          <Title id="var">Var, le feu du Gros Bessillon</Title>
          <p className="mt-4 leading-7 text-bone-300">
            Parti de Pontevès, le feu s’étend par reprises jusqu’à Correns, Montfort-sur-Argens et Châteauvert. EFFIS
            cartographie {formatInteger(varFire.effis.areaHa)} ha brûlés en {varFire.effis.polygons} polygones.
          </p>
          <FactList facts={varFire.facts} retrievedAt={story.retrievedAt} />
        </Chapter>

        <Chapter id="annee" wide>
          <Kicker>1er janvier – {formatDate(story.effisDataDate)}</Kicker>
          <Title id="annee">Toute l’année</Title>
          <p className="mt-4 leading-7 text-bone-300">
            Sur la carte, toutes les surfaces brûlées en {year}. Le cumul n’attend pas l’été : il décroche dès février,
            puis bondit en juillet ({formatInteger(headline.monthlyAreaHa[6])} ha pour ce seul mois, feux de 30 ha ou
            plus).
          </p>
          <div className="mt-5">
            <CumulativeChart weekly={weekly} retrievedAt={retrieved.stats} />
          </div>
          <h3 className="mt-6 text-lg">Les dommages assurés</h3>
          <FactList facts={story.insurance} retrievedAt={story.retrievedAt} />
          <p className="mt-3 text-xs leading-5 text-ash-400">
            Estimations des assureurs pour les feux de Gironde, des Landes et du Var.
          </p>
        </Chapter>

        <section
          data-step="sortie"
          aria-labelledby="sortie-titre"
          className="pointer-events-none flex min-h-[90svh] flex-col justify-end px-4 pb-6 md:px-10"
        >
          <div className="pointer-events-auto max-w-[34rem] border border-ash-800 bg-ash-950 p-5 md:p-6">
            <h2 id="sortie-titre" className="text-3xl">
              À vous d’explorer
            </h2>
            <p className="mt-3 leading-7 text-bone-300">
              Chaque surface brûlée depuis 2006, jour par jour, avec les détections satellite et la source de chaque
              chiffre.
            </p>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
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
          <MapCredits credits={credits} className="pointer-events-auto mt-6 max-w-[60rem]" />
        </section>
      </div>
    </div>
  );
}
