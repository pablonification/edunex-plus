// Back from SIX or Edunex: the Student opened one of them in the browser from
// the demo (to press Tandai Hadir, record a Presence, hand in a Task) and comes
// back to the window. What they did there shows at once: the app reads that
// source's attendance again then (Engine.recheckAttendance), not at its next
// sync. Outside the demo they open in the app's own windows, which say so
// themselves as they close (./open-page.ts).
import { EDUNEX_WEB, SIX_WEB } from "../core/links";

type Source = "six" | "edunex";

/** Back after longer than this, the trip is over: coming back reads nothing extra. */
const AWAY = 30 * 60_000;

const SITES: readonly [string, Source][] = [
  [SIX_WEB, "six"],
  [EDUNEX_WEB, "edunex"],
];

/** SIX or Edunex, for a page of either opened in the browser. */
export function siteOf(url: string): Source | null {
  try {
    const { protocol, host } = new URL(url);
    return SITES.find(([site]) => `${protocol}//${host}` === site)?.[1] ?? null;
  } catch {
    return null;
  }
}

export interface Away {
  /** A page opened in the browser from the app. */
  opened(url: string): void;
  /** The window came to the front. */
  back(): void;
}

export function awayFromApp(options: { now(): number; recheck(source: Source): void }): Away {
  const left = new Map<Source, number>();
  return {
    opened(url) {
      const source = siteOf(url);
      if (source) left.set(source, options.now());
    },
    back() {
      for (const [source, at] of left) {
        if (options.now() - at > AWAY) left.delete(source);
        else options.recheck(source);
      }
    },
  };
}
