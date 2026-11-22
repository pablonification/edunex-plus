// Usage data (ADR 0016): each app's day of counts, as the app sends it once the day is over
// (src/engine/usage.ts), kept in a Durable Object of its own, apart from the reports. Nothing here
// is public: only the maintainer's token reads it, and only as totals for a range of days.
//
// What's kept: per app and day, the counts as they came (screens, actions, reads, errors), its
// version, system, language and whether it was signed in; per app, the first and last day it sent.
// The app's id is random, made on the Student's computer; the address a day came from is never
// kept, only counted (hashed with the day and a secret) for the cap, and forgotten the next day.
import { USAGE_LIMITS, UsageDay } from "../../src/core/usage";
import { readLimited } from "./relay";
import type { Store } from "./store";
import { sha256 } from "./tokens";

export interface UsageLimits {
  /** Bytes one day can be. */
  maxBody: number;
  /**
   * Days a day from one address, and from everyone. A campus network puts many Students behind one address. Each day
   * is about four writes, and the free plan's 100,000 writes a day are shared with the reports: 15,000 leaves them room.
   */
  perAddress: number;
  perDay: number;
  /** Days of usage kept, and the most a summary covers. */
  keepDays: number;
  maxRange: number;
}

export const USAGE_LIMITS_RELAY: UsageLimits = {
  maxBody: 64 * 1024,
  perAddress: 500,
  perDay: 15_000,
  keepDays: 400,
  maxRange: 62,
};

const DAY = 86_400_000;
const dayOf = (at: number) => new Date(at).toISOString().slice(0, 10);
const addDays = (day: string, days: number) => dayOf(Date.parse(`${day}T00:00:00Z`) + days * DAY);

const KEY = {
  day: (day: string, install: string) => `usage:day:${day}:${install}`,
  install: (install: string) => `usage:install:${install}`,
  count: (day: string, name: string) => `usage:count:${day}:${name}`,
};

type Counts = Record<string, number>;
type Kept = Omit<UsageDay, "usage" | "install" | "day">;
interface Install {
  first: string;
  last: string;
}

/** One day's totals, over every app that sent it. */
export interface DayTotals {
  day: string;
  /**
   * Apps the Student opened this day (a screen counted), apps that sent it at all (a phone's sync in the background, a
   * desktop in the tray, with no screen opened), and the ones whose first day it was.
   */
  active: number;
  running: number;
  new: number;
  /** Apps by platform, version, system, language, and what they were signed in to. */
  platforms: Counts;
  versions: Counts;
  os: Counts;
  langs: Counts;
  signedIn: { edunex: number; six: number; both: number; neither: number };
  /** Every count added up, and how many apps counted each name at least once. */
  screens: Counts;
  actions: Counts;
  reads: Counts;
  errors: Counts;
  reach: { screens: Counts; actions: Counts };
  /** Of this day's new apps, how many were opened again the next day and seven days on (null: that day isn't over). */
  returned: { nextDay: number | null; week: number | null };
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

/** A day the Student opened the app: at least one screen showed. */
const opened = (kept: Kept | undefined) => kept !== undefined && Object.keys(kept.screens).length > 0;

const bump = (counts: Counts, name: string, by = 1) => {
  counts[name] = (counts[name] ?? 0) + by;
};

export interface UsageOptions {
  store: Store;
  now: () => number;
  /** Reads the totals. Shorter than 32 characters: nobody can. Also the secret the addresses are hashed with. */
  maintainerToken: string;
  limits?: Partial<UsageLimits>;
  log?: (line: string) => void;
}

export class UsageRelay {
  private readonly limits: UsageLimits;
  private readonly log: (line: string) => void;

  constructor(private readonly options: UsageOptions) {
    this.limits = { ...USAGE_LIMITS_RELAY, ...options.limits };
    this.log = options.log ?? (() => {});
  }

  async handle(request: Request, address: string): Promise<Response> {
    const { pathname } = new URL(request.url);
    try {
      if (pathname === "/v1/usage" && request.method === "POST") return await this.receive(request, address);
      if (pathname === "/v1/usage" && request.method === "GET") return await this.summary(request);
      return json(404, { error: "not-found" });
    } catch (error) {
      this.log(`${request.method} ${pathname} failed: ${String(error)}`);
      return json(500, { error: "failed" });
    }
  }

  /** Forgets what's older than the days kept, a slice at a time (the cron trigger). */
  async cron(): Promise<void> {
    const cutoff = dayOf(this.options.now() - this.limits.keepDays * DAY);
    for (const key of (await this.options.store.list({ prefix: "usage:day:", limit: 500 })).keys()) {
      if (key.slice("usage:day:".length, "usage:day:".length + 10) >= cutoff) break;
      await this.options.store.delete(key);
    }
    const today = dayOf(this.options.now());
    for (const key of (await this.options.store.list({ prefix: "usage:count:", limit: 500 })).keys()) {
      if (key.slice("usage:count:".length, "usage:count:".length + 10) >= today) break;
      await this.options.store.delete(key);
    }
  }

  private async receive(request: Request, address: string): Promise<Response> {
    const text = await readLimited(request, this.limits.maxBody);
    if (text === null) return json(413, { error: "too-big" });
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return json(400, { error: "invalid" });
    }
    const parsed = UsageDay.safeParse(body);
    if (!parsed.success) return json(400, { error: "invalid" });
    const day = parsed.data;
    const now = this.options.now();
    // A day that's over (in any time zone), and not older than the app keeps one waiting.
    if (day.day > dayOf(now) || day.day < dayOf(now - 9 * DAY)) return json(400, { error: "invalid" });

    const today = dayOf(now);
    if (!(await this.take(today, `address:${await this.hash(today, address)}`, this.limits.perAddress))) return slowDown(now);
    if (!(await this.take(today, "all", this.limits.perDay))) return slowDown(now);

    const { usage: _usage, install, day: key, ...kept } = day;
    // Sent again (a retry after an answer that never arrived): the same day, written over.
    await this.options.store.put(KEY.day(key, install), kept satisfies Kept);
    const before = await this.options.store.get<Install>(KEY.install(install));
    await this.options.store.put(KEY.install(install), {
      first: before && before.first < key ? before.first : key,
      last: before && before.last > key ? before.last : key,
    } satisfies Install);
    return json(202, { ok: true });
  }

  /** GET /v1/usage?from=…&to=…: each day's totals, for the maintainer. */
  private async summary(request: Request): Promise<Response> {
    if (!(await this.isMaintainer(request))) return json(401, { error: "unauthorized" });
    const url = new URL(request.url);
    const today = dayOf(this.options.now());
    const to = url.searchParams.get("to") ?? addDays(today, -1);
    const from = url.searchParams.get("from") ?? addDays(to, -6);
    const isDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
    if (!isDay(from) || !isDay(to) || from > to) return json(400, { error: "invalid" });
    const days: string[] = [];
    for (let day = from; day <= to; day = addDays(day, 1)) {
      days.push(day);
      if (days.length > this.limits.maxRange) return json(400, { error: "too-long" });
    }
    const totals: DayTotals[] = [];
    for (const day of days) totals.push(await this.totals(day, today));
    return json(200, { days: totals });
  }

  private async totals(day: string, today: string): Promise<DayTotals> {
    const sent = await this.options.store.list<Kept>({ prefix: `usage:day:${day}:` });
    const out: DayTotals = {
      day,
      active: 0,
      running: 0,
      new: 0,
      platforms: {},
      versions: {},
      os: {},
      langs: {},
      signedIn: { edunex: 0, six: 0, both: 0, neither: 0 },
      screens: {},
      actions: {},
      reads: {},
      errors: {},
      reach: { screens: {}, actions: {} },
      returned: { nextDay: addDays(day, 1) < today ? 0 : null, week: addDays(day, 7) < today ? 0 : null },
    };
    const fresh: string[] = [];
    for (const [key, kept] of sent) {
      const install = key.slice(key.lastIndexOf(":") + 1);
      out.running++;
      if (opened(kept)) out.active++;
      const first = await this.options.store.get<Install>(KEY.install(install));
      if (first?.first === day) {
        out.new++;
        fresh.push(install);
      }
      bump(out.platforms, kept.platform);
      bump(out.versions, kept.version);
      bump(out.os, kept.os.replace(/\s*\(.*\)$/, "") || "unknown");
      bump(out.langs, kept.lang);
      const { edunex, six } = kept.signedIn;
      if (edunex && six) out.signedIn.both++;
      else if (!edunex && !six) out.signedIn.neither++;
      if (edunex) out.signedIn.edunex++;
      if (six) out.signedIn.six++;
      for (const kind of ["screens", "actions", "reads", "errors"] as const) {
        for (const [name, count] of Object.entries(kept[kind])) bump(out[kind], name, Math.min(count, USAGE_LIMITS.count));
      }
      for (const name of Object.keys(kept.screens)) bump(out.reach.screens, name);
      for (const name of Object.keys(kept.actions)) bump(out.reach.actions, name);
    }
    for (const install of fresh) {
      if (out.returned.nextDay !== null && opened(await this.options.store.get<Kept>(KEY.day(addDays(day, 1), install)))) out.returned.nextDay++;
      if (out.returned.week !== null && opened(await this.options.store.get<Kept>(KEY.day(addDays(day, 7), install)))) out.returned.week++;
    }
    return out;
  }

  /** One more for `name` today, if it's under `max`. */
  private async take(day: string, name: string, max: number): Promise<boolean> {
    const key = KEY.count(day, name);
    const count = (await this.options.store.get<number>(key)) ?? 0;
    if (count >= max) return false;
    await this.options.store.put(key, count + 1);
    return true;
  }

  private async hash(day: string, address: string): Promise<string> {
    return (await sha256(`${this.options.maintainerToken}:usage:${day}:${address}`)).slice(0, 16);
  }

  private async isMaintainer(request: Request): Promise<boolean> {
    const token = /^Bearer (\S+)$/.exec(request.headers.get("authorization") ?? "")?.[1] ?? null;
    if (!token || this.options.maintainerToken.length < 32) return false;
    return (await sha256(token)) === (await sha256(this.options.maintainerToken));
  }
}

/** 429, to come back after midnight UTC, when the day's caps start again. */
function slowDown(now: number): Response {
  const seconds = Math.ceil((Date.parse(`${dayOf(now + DAY)}T00:00:00Z`) - now) / 1000);
  return json(429, { error: "slow-down" }, { "retry-after": String(seconds) });
}
