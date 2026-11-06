// How the recordings in test/fixtures are looked up, apart from how their files are read: from the
// disk in tests (./fixtures.ts), from a bundle on the phone's demo (mobile/src/demo/fixtures.ts,
// which Metro puts in place of ./fixtures.ts). Both give the pretend world the same answers.

export type System = "edunex" | "six";

export interface Exchange {
  method: "GET";
  path: string;
  query: Record<string, string>;
  status: number;
  file: string;
}

/** A recording's text by its path under test/fixtures ("six/index.json"). */
export type ReadFixture = (file: string) => string;

const matches = (exchange: Exchange, pathname: string | RegExp, query?: Record<string, string>) =>
  (typeof pathname === "string" ? exchange.path === pathname : pathname.test(exchange.path)) &&
  Object.entries(query ?? {}).every(([k, v]) => exchange.query[k] === v);

/** The lookups over recordings that `read` gives. */
export function recordings(read: ReadFixture) {
  const indexes = new Map<System, Exchange[]>();

  /** Every recorded exchange for a system, as listed in its index.json. */
  function exchanges(system: System): Exchange[] {
    let list = indexes.get(system);
    if (!list) {
      list = JSON.parse(read(`${system}/index.json`)) as Exchange[];
      indexes.set(system, list);
    }
    return list;
  }

  /** The recorded exchange for a request; throws when the recording never made it. */
  function exchange(system: System, pathname: string | RegExp, query?: Record<string, string>): Exchange {
    const hit = exchanges(system).find((e) => matches(e, pathname, query));
    if (!hit) throw new Error(`No recorded ${system} response for ${String(pathname)} ${JSON.stringify(query ?? {})}`);
    return hit;
  }

  function bodyText(system: System, file: string): string {
    return read(`${system}/${file}`);
  }

  /** A recorded Edunex JSON response, freshly parsed (safe to change). */
  function edunexJson<T = unknown>(pathname: string | RegExp, query?: Record<string, string>): T {
    return JSON.parse(bodyText("edunex", exchange("edunex", pathname, query).file)) as T;
  }

  /** A recorded SIX page. */
  function sixPage(pathname: string | RegExp): string {
    return bodyText("six", exchange("six", pathname).file);
  }

  /** A page from SIX's public catalog (no sign-in, no personal data): "kur2024" or "kur2024-182". */
  function publicPage(name: string): string {
    return read(`pub/${name}.html`);
  }

  /** ITB's academic calendar feed (the .ics file goitb.id leads to). */
  function calendarFeed(): string {
    return read("itb/kalender-pendidikan.ics");
  }

  return { exchanges, exchange, bodyText, edunexJson, sixPage, publicPage, calendarFeed };
}
