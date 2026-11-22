"use client";

import { Dialog } from "radix-ui";
import { formatInteger } from "@/lib/format";
import { useSpanFires } from "@/lib/data/span-fires";
import { zoomBack } from "@/lib/data/departements-map";
import { useMapStore } from "@/lib/store";
import { useMediaQuery } from "@/lib/use-media-query";
import { FireCard } from "./FireCard";
import { FireList } from "./FireList";

/**
 * The side panel: the period's fires, or once one is chosen, that fire
 * (a bottom sheet on phones, over the list).
 */
export function FirePanel() {
  const selectedFireId = useMapStore((state) => state.selectedFireId);
  const selectFire = useMapStore((state) => state.selectFire);
  const wide = useMediaQuery("(min-width: 1024px)", true);
  const { fires } = useSpanFires();
  const fire = fires?.find((candidate) => candidate.id === selectedFireId) ?? null;
  // Back to the list: the camera zooms out one level (the chosen département, else France).
  const close = () => {
    selectFire(null);
    zoomBack();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p aria-live="polite" className="sr-only">
        {fire ? `${fire.commune}, ${fire.province} : ${formatInteger(fire.areaHa)} hectares sélectionnés.` : ""}
      </p>
      {fire && wide ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <FireCard fire={fire} onBack={close} />
        </div>
      ) : (
        <FireList />
      )}
      <Dialog.Root open={Boolean(fire) && !wide} onOpenChange={(open) => !open && close()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/30" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto rounded-t-xl bg-sheet pt-2 shadow-lg"
          >
            <Dialog.Title className="sr-only">{fire ? `Feu : ${fire.commune}` : "Feu"}</Dialog.Title>
            <span aria-hidden className="mx-auto mb-1 block h-1 w-10 rounded-full bg-rule-strong" />
            {fire && <FireCard fire={fire} onBack={close} />}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
