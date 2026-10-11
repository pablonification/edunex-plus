// Reading SIX's server-rendered pages. Readers find what they need by its
// structure (links, number patterns, table shapes), not by its wording, so
// SIX's English pages read the same as its Indonesian ones. Anything a reader
// can't place for certain is "SIX changed something", never a guess.
import { type Cheerio, type CheerioAPI, load } from "cheerio/slim";
import type { Element } from "domhandler";
import { EngineError } from "../../errors";

export type Page = CheerioAPI;
export type Nodes = Cheerio<Element>;
export type { Element };

/** htmlparser2 (cheerio/slim): it reads SIX's loose markup fine and keeps parse5 and undici out of the app. */
export const parse = (html: string): Page => load(html);

/** SIX's templates indent heavily; text is compared with whitespace collapsed. */
export const clean = (text: string): string => text.replace(/\s+/g, " ").trim();

/** "SIX changed something", with the page and what didn't fit, for the status detail. */
export const changed = (page: string, what: string): EngineError => new EngineError("VendorChanged", `SIX ${page}: ${what}`);

/** Every link target on the page. */
export const links = ($: Page): string[] =>
  $("a[href]")
    .toArray()
    .map((el) => clean($(el).attr("href") ?? ""));

/** An ITB course code: two letters and four digits ("PL3002"). */
export const COURSE_CODE = /^[A-Z]{2}\d{4}$/;
