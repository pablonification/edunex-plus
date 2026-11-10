// Reading a big page without holding the screens up. On the phone the engine shares the JS thread with the screens,
// and a 300 KB page (SIX's catalog and curriculum pages) parsed at once held it about a second. Here a page is parsed a
// slice at a time, and between slices, once the work since the last break passes `BREAK_MS`, the screens get a turn
// (`pause`: EngineDeps.yieldToScreens, through SourceContext.breathe). Without `pause` (the desktop, the tests) it never
// stops, and reads the same.
import { type CheerioAPI, load } from "cheerio/slim";
import { DomHandler } from "domhandler";
import { Parser } from "htmlparser2";

/** The longest stretch of reading before the screens get a turn. */
const BREAK_MS = 8;
/** How much of the page the parser takes at once (a few ms of work on a small phone). */
const SLICE = 16_000;

/** Calls `pause` once the work since the last call took over `BREAK_MS`; without `pause`, never stops. */
export function breaks(pause?: () => Promise<void>): () => Promise<void> {
  if (!pause) return async () => undefined;
  let since = Date.now();
  return async () => {
    if (Date.now() - since < BREAK_MS) return;
    await pause();
    since = Date.now();
  };
}

/** The page's document, parsed a slice at a time (htmlparser2, as `load` from cheerio/slim does at once). */
export async function parseInSlices(html: string, breathe: () => Promise<void>): Promise<CheerioAPI> {
  const handler = new DomHandler();
  const parser = new Parser(handler, { decodeEntities: true });
  for (let at = 0; at < html.length; at += SLICE) {
    parser.write(html.slice(at, at + SLICE));
    await breathe();
  }
  parser.end();
  return load(handler.root);
}

/** Pages parsed ahead (`parseAhead`), by their text, each waiting for the reader that opens it (`openParsed`). */
const ahead = new Map<string, CheerioAPI>();
/** A feed reads at most a few pages before it reads them (the transcript and the progress page). */
const AHEAD = 4;

/**
 * Parses `html` now, a slice at a time with the screens drawing between (`pause`), for the reader that opens it next:
 * on the phone a SIX page (18–36 KB) parsed at once held the JS thread 50–150 ms. Its reader, a plain function of the
 * page's text, then finds it parsed (`openParsed`).
 */
export async function parseAhead(html: string, pause: () => Promise<void>): Promise<void> {
  const $ = await parseInSlices(html, breaks(pause));
  ahead.delete(html);
  ahead.set(html, $);
  for (const oldest of ahead.keys()) {
    if (ahead.size <= AHEAD) break;
    ahead.delete(oldest);
  }
}

/** The document `parseAhead` made of `html`, handed out once (a reader may change it); undefined when there's none. */
export function parsedAhead(html: string): CheerioAPI | undefined {
  const $ = ahead.get(html);
  if ($) ahead.delete(html);
  return $;
}

/** The page's document: the one parsed ahead in slices when there is one, else parsed now. */
export function openParsed(html: string): CheerioAPI {
  return parsedAhead(html) ?? load(html);
}
