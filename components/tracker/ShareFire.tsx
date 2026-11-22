"use client";

import { Check, Copy, ShareNetwork, X } from "@phosphor-icons/react";
import { Dialog } from "radix-ui";
import { useState } from "react";
import { formatArea } from "@/lib/format";
import type { SpanFire } from "@/lib/data/fires";
import { SITE_URL } from "@/lib/site";
import { useMapStore } from "@/lib/store";

/**
 * "Partager" at the foot of a fire's card: a window showing the link preview
 * the fire gets in messaging apps and social networks, its address to copy,
 * and the device's own share sheet where there is one.
 */
export function ShareFire({ fire }: { fire: SpanFire }) {
  const archiveYear = useMapStore((state) => state.archiveYear);
  const [copied, setCopied] = useState(false);
  const query = archiveYear !== null ? `annee=${archiveYear}&fire=${fire.id}` : `fire=${fire.id}`;
  const url = `${SITE_URL}/carte?${query}`;
  const image = `/api/apercu/feu/${fire.id}${archiveYear !== null ? `?annee=${archiveYear}` : ""}`;
  const title = `Feu de ${fire.commune || "commune non renseignée"} (${fire.province}) : ${formatArea(fire.areaHa)} ha`;
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Dialog.Root onOpenChange={(open) => !open && setCopied(false)}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-rule-strong bg-sheet text-sm font-bold text-ink hover:border-ink"
        >
          <ShareNetwork size={16} weight="bold" aria-hidden />
          Partager
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-paper/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-rule-strong bg-sheet p-5 shadow-pop">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-xl leading-tight">Partager ce feu</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-ink-2">
                L’aperçu que verront vos contacts dans une messagerie ou sur un réseau social.
              </Dialog.Description>
            </div>
            <Dialog.Close className="grid size-8 shrink-0 place-items-center rounded-md text-ink-2 hover:bg-paper hover:text-ink" aria-label="Fermer">
              <X size={16} weight="bold" aria-hidden />
            </Dialog.Close>
          </div>

          {/* The preview as a messaging app shows it: the image, then the title and the site. */}
          <figure className="m-0 mt-4 overflow-hidden rounded-md border border-rule">
            {/* eslint-disable-next-line @next/next/no-img-element -- the generated preview itself, not a page image */}
            <img src={image} alt={`Aperçu : ${title}`} width={1200} height={630} className="block aspect-[1200/630] w-full bg-paper" />
            <figcaption className="border-t border-rule bg-paper px-3 py-2">
              <p className="truncate text-sm font-bold text-ink">{title}</p>
              <p className="text-xs text-ink-3">firestrain.vercel.app</p>
            </figcaption>
          </figure>

          <div className="mt-4 flex gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Adresse du feu</span>
              <input
                readOnly
                value={url}
                onFocus={(event) => event.currentTarget.select()}
                className="h-9 w-full rounded-md border border-rule-strong bg-paper px-2.5 text-sm text-ink-2"
              />
            </label>
            <button
              type="button"
              onClick={copy}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-ink px-3 text-sm font-bold text-sheet"
            >
              {copied ? <Check size={15} weight="bold" aria-hidden /> : <Copy size={15} weight="bold" aria-hidden />}
              {copied ? "Copié" : "Copier"}
            </button>
          </div>
          <p aria-live="polite" className="sr-only">
            {copied ? "Adresse copiée" : ""}
          </p>
          {canShare && (
            <button
              type="button"
              onClick={() => void navigator.share({ title, url }).catch(() => {})}
              className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-md border border-rule-strong text-sm font-bold text-ink hover:border-ink"
            >
              <ShareNetwork size={16} weight="bold" aria-hidden />
              Partager avec une application
            </button>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
