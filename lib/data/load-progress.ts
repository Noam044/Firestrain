import { create } from "zustand";

/**
 * Progress of the live requests (NASA FIRMS hotspots, EFFIS burnt areas), for
 * the map's loading popup. Each request goes through three steps: waiting for
 * the server (which queries NASA or EFFIS first), receiving the answer, then
 * decoding it. The routes send no length, so the wait and the download are
 * shown as steps, not as a byte count.
 */
export type LiveSource = "firms" | "effis";
export type LoadStep = "waiting" | "receiving" | "done" | "error";
export type SourceProgress = { step: LoadStep; since: number };

type LoadProgressState = {
  sources: Partial<Record<LiveSource, SourceProgress>>;
  set: (source: LiveSource, step: LoadStep) => void;
};

export const useLoadProgress = create<LoadProgressState>((set) => ({
  sources: {},
  set: (source, step) =>
    set((state) => ({ sources: { ...state.sources, [source]: { step, since: performance.now() } } })),
}));

const mark = (source: LiveSource, step: LoadStep) => useLoadProgress.getState().set(source, step);

/**
 * Fetches a live route as bytes and reports each step; `decode` runs on the
 * bytes, and the source counts as done only once it returns.
 */
export async function fetchLive<T>(
  source: LiveSource,
  url: string,
  decode: (bytes: Uint8Array<ArrayBuffer>) => T | Promise<T>,
): Promise<T> {
  mark(source, "waiting");
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url} : HTTP ${response.status}`);
    mark(source, "receiving");
    const result = await decode(new Uint8Array(await response.arrayBuffer()));
    mark(source, "done");
    return result;
  } catch (error) {
    mark(source, "error");
    throw error;
  }
}

/**
 * The share of one source that is loaded, 0 to 1. While the server waits on
 * NASA or EFFIS nothing is known: the share creeps towards the next step and
 * never reaches it, so the bar keeps moving without claiming more than it knows.
 */
export function sourceShare(progress: SourceProgress | undefined, now: number): number {
  if (!progress) return 0;
  const elapsed = Math.max(0, now - progress.since) / 1000;
  switch (progress.step) {
    case "waiting":
      return 0.6 * (1 - Math.exp(-elapsed / 5));
    case "receiving":
      return 0.6 + 0.3 * (1 - Math.exp(-elapsed / 0.5));
    case "done":
    case "error":
      return 1;
  }
}
