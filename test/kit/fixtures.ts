// Real Edunex responses and SIX pages from a recorded session, with every
// personal detail replaced (scripts/scrub-recording.mjs). Tests read them
// through these helpers instead of hand-written samples, so they always see
// the shapes the real systems send.
import fs from "node:fs";
import path from "node:path";

export const FIXTURES_DIR = path.resolve(import.meta.dirname, "..", "fixtures");

export type System = "edunex" | "six";

export interface Exchange {
  method: "GET";
  path: string;
  query: Record<string, string>;
  status: number;
  file: string;
}

const indexes = new Map<System, Exchange[]>();

/** Every recorded exchange for a system, as listed in its index.json. */
export function exchanges(system: System): Exchange[] {
  let list = indexes.get(system);
  if (!list) {
    list = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, system, "index.json"), "utf8")) as Exchange[];
    indexes.set(system, list);
  }
  return list;
}

const matches = (exchange: Exchange, pathname: string | RegExp, query?: Record<string, string>) =>
  (typeof pathname === "string" ? exchange.path === pathname : pathname.test(exchange.path)) &&
  Object.entries(query ?? {}).every(([k, v]) => exchange.query[k] === v);

/** The recorded exchange for a request; throws when the recording never made it. */
export function exchange(system: System, pathname: string | RegExp, query?: Record<string, string>): Exchange {
  const hit = exchanges(system).find((e) => matches(e, pathname, query));
  if (!hit) throw new Error(`No recorded ${system} response for ${String(pathname)} ${JSON.stringify(query ?? {})}`);
  return hit;
}

export function bodyText(system: System, file: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, system, file), "utf8");
}

/** A recorded Edunex JSON response, freshly parsed (safe to change). */
export function edunexJson<T = unknown>(pathname: string | RegExp, query?: Record<string, string>): T {
  return JSON.parse(bodyText("edunex", exchange("edunex", pathname, query).file)) as T;
}

/** A recorded SIX page. */
export function sixPage(pathname: string | RegExp): string {
  return bodyText("six", exchange("six", pathname).file);
}

/** A page from SIX's public catalog (no sign-in, no personal data): "kur2024" or "kur2024-182". */
export function publicPage(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, "pub", `${name}.html`), "utf8");
}

/** Every committed fixture file, for checks that scan them all. */
export function allFixtureFiles(): string[] {
  const out: string[] = [];
  const visit = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else out.push(full);
    }
  };
  visit(FIXTURES_DIR);
  return out;
}
