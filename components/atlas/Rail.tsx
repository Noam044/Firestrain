"use client";

import { Dialog } from "radix-ui";
import { formatInteger } from "@/lib/format";
import { useEffisYear } from "@/lib/data/queries";
import { useMapStore } from "@/lib/store";
import { useMediaQuery } from "@/lib/use-media-query";
import { FireDetail } from "./FireDetail";
import { MapKey } from "./MapKey";
import { TopFires } from "./TopFires";
import { YearSummary } from "./YearSummary";

/**
 * The side panel: what the year shown amounts to, what the map shows, and the
 * fires worth opening — or, once a fire is chosen, that fire (a bottom sheet on phones).
 */
export function Rail() {
  const year = useMapStore((state) => state.year);
  const selectedFireId = useMapStore((state) => state.selectedFireId);
  const selectFire = useMapStore((state) => state.selectFire);
  const wide = useMediaQuery("(min-width: 1024px)", true);
  const fires = useEffisYear(year).data?.fires;
  const fire = fires?.find((candidate) => candidate.id === selectedFireId) ?? null;
  const close = () => selectFire(null);

  return (
    <div className="px-5 py-5 lg:px-6">
      <p aria-live="polite" className="sr-only">
        {fire ? `${fire.commune}, ${fire.province} : ${formatInteger(fire.areaHa)} hectares sélectionnés.` : ""}
      </p>
      {fire && wide ? (
        <FireDetail fire={fire} year={year} onBack={close} />
      ) : (
        <div className="space-y-7">
          <YearSummary />
          <MapKey />
          <TopFires />
        </div>
      )}
      <Dialog.Root open={Boolean(fire) && !wide} onOpenChange={(open) => !open && close()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/30" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto rounded-t-xl bg-sheet px-5 pb-6 pt-3 shadow-lg"
          >
            <Dialog.Title className="sr-only">{fire ? `Surface brûlée : ${fire.commune}` : "Surface brûlée"}</Dialog.Title>
            <span aria-hidden className="mx-auto mb-3 block h-1 w-10 rounded-full bg-rule" />
            {fire && <FireDetail fire={fire} year={year} onBack={close} />}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
