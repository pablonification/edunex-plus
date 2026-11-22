// Usage data (ADR 0016): counts how the app is used, one day at a time, kept on disk until the day
// is over, then sent to the maintainer's relay, one post a day. Only names from the app's own code
// and how many times (src/core/usage.ts); off when the Student turns it off in Settings, which
// forgets what was counted and not sent yet. Nothing is counted in a build without a relay, in the
// demo, or in development (the shell passes no `usage` then).
import { z } from "zod";
import type { Lang } from "../core/models";
import { USAGE_LIMITS, UsageDay, UsageDayKey, type UsageKind, type UsagePlatform, usageDayOf, usageName } from "../core/usage";
import type { Clock, TimerHandle } from "./clock";
import { NetworkError, type Transport } from "./http/transport";
import type { Storage } from "./store/storage";

const FILE = "usage.json";
/** Days kept waiting to go (offline for a week, say): older ones are dropped unsent. */
const KEEP_DAYS = 7;
/** How long after a count the day is saved: a quit loses at most this much. */
const SAVE_AFTER_MS = 30_000;
/** The first send after a start (the phone's starts are short), then every few hours while the app runs. */
const FIRST_SEND_MS = 10_000;
const SEND_EVERY_MS = 3 * 3_600_000;
const TIMEOUT_MS = 30_000;

const Counts = z.record(z.string(), z.number().int().min(0));
const Kept = z.object({
  install: z.uuid(),
  days: z.record(
    UsageDayKey,
    z.object({
      version: z.string(),
      os: z.string(),
      lang: z.enum(["id", "en"]),
      signedIn: z.object({ edunex: z.boolean(), six: z.boolean() }),
      screens: Counts,
      actions: Counts,
      reads: Counts,
      errors: Counts,
    }),
  ),
});
type Kept = z.infer<typeof Kept>;
type Day = Kept["days"][string];

export interface UsageOptions {
  clock: Clock;
  storage: Storage;
  transport: Transport;
  /** The relay's address (relayBase), https, no trailing slash. */
  relay: string;
  userAgent: string;
  version: string;
  platform: UsagePlatform;
  os(): string;
  lang(): Lang;
  /** The Student's setting (usageDataOf). */
  enabled(): boolean;
  /** Signed in to each system now. */
  signedIn(): { edunex: boolean; six: boolean };
}

/** A random UUID (v4) from the system's secure random numbers. */
function randomUuid(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** One more of `name` in `counts`, under the day's limits; false when it's past them. Only the record's own names count. */
function addOne(counts: Record<string, number>, name: string): boolean {
  const before = Object.hasOwn(counts, name) ? counts[name]! : null;
  if (before === null && Object.keys(counts).length >= USAGE_LIMITS.names) return false;
  counts[name] = Math.min(USAGE_LIMITS.count, (before ?? 0) + 1);
  return true;
}

export class Usage {
  private kept: Kept | null = null;
  private saveTimer: TimerHandle | null = null;
  private sendTimer: TimerHandle | null = null;
  private sending: Promise<void> | null = null;
  private running = false;

  constructor(private readonly options: UsageOptions) {}

  /** What was counted and not sent yet, from disk. */
  async load(): Promise<void> {
    const text = await this.options.storage.read(FILE).catch(() => null);
    if (!text) return;
    try {
      const parsed = Kept.safeParse(JSON.parse(text));
      if (parsed.success) this.kept = parsed.data;
    } catch {
      // A file cut short: start again.
    }
  }

  /** Sends the days that are over, soon after a start and then every few hours. */
  start(): void {
    this.stopTimers();
    this.running = true;
    const loop = (after: number) => {
      this.sendTimer = this.options.clock.setTimeout(() => {
        void this.send()
          .catch(() => undefined)
          .finally(() => {
            if (this.running) loop(SEND_EVERY_MS);
          });
      }, after);
    };
    loop(FIRST_SEND_MS);
  }

  /** Stops sending, and saves what's counted. */
  async stop(): Promise<void> {
    this.running = false;
    this.stopTimers();
    await this.save();
  }

  /** One more of `name` today. Nothing while usage data is off. */
  count(kind: UsageKind, name: string): void {
    if (!this.options.enabled()) return;
    if (addOne(this.today()[kind], usageName(name))) this.saveSoon();
  }

  /**
   * Forgets this app's id and what it counted and didn't send: usage data turned off, or the Student signed out of
   * everything (the next one's days aren't this one's). Counting again starts under a new id.
   */
  async forget(): Promise<void> {
    if (this.saveTimer) this.options.clock.clearTimeout(this.saveTimer);
    this.saveTimer = null;
    this.kept = null;
    await this.options.storage.remove(FILE).catch(() => undefined);
  }

  /** The days that are over, to the relay, oldest first; days older than a week are dropped. One send at a time. */
  send(): Promise<void> {
    this.sending ??= this.sendDays().finally(() => {
      this.sending = null;
    });
    return this.sending;
  }

  private async sendDays(): Promise<void> {
    const kept = this.kept;
    if (!this.options.enabled() || !kept) return;
    const today = usageDayOf(this.options.clock.now());
    const oldest = usageDayOf(this.options.clock.now() - KEEP_DAYS * 86_400_000);
    let changed = false;
    for (const key of Object.keys(kept.days).sort()) {
      if (key >= today) break;
      const day = kept.days[key]!;
      if (key < oldest) {
        delete kept.days[key];
        changed = true;
        continue;
      }
      const sent = UsageDay.safeParse({ usage: 1, install: kept.install, day: key, platform: this.options.platform, ...day });
      const answer = sent.success ? await this.post(sent.data) : "refused";
      if (answer === "later") break;
      // Taken, or refused for good (a day the relay can't read won't read tomorrow either).
      if (this.kept !== kept) return; // forgotten while it went
      delete kept.days[key];
      changed = true;
    }
    if (changed) await this.save();
  }

  private async post(day: UsageDay): Promise<"taken" | "refused" | "later"> {
    try {
      const response = await this.options.transport.request({
        method: "POST",
        url: `${this.options.relay}/v1/usage`,
        headers: { "content-type": "application/json", accept: "application/json", "user-agent": this.options.userAgent },
        body: JSON.stringify(day),
        timeoutMs: TIMEOUT_MS,
      });
      if (response.status >= 200 && response.status < 300) return "taken";
      if (response.status === 400 || response.status === 413 || response.status === 422) return "refused";
      return "later";
    } catch (error) {
      if (error instanceof NetworkError) return "later";
      throw error;
    }
  }

  /** Today's counts, begun if they aren't yet; who's signed in, the version, the system and language, as they are now. */
  private today(): Day {
    this.kept ??= { install: randomUuid(), days: {} };
    const key = usageDayOf(this.options.clock.now());
    const signedIn = this.options.signedIn();
    const before = this.kept.days[key];
    const day: Day = before ?? { version: "", os: "", lang: "en", signedIn, screens: {}, actions: {}, reads: {}, errors: {} };
    day.version = this.options.version;
    day.os = this.options.os().slice(0, 80);
    day.lang = this.options.lang();
    day.signedIn = { edunex: day.signedIn.edunex || signedIn.edunex, six: day.signedIn.six || signedIn.six };
    this.kept.days[key] = day;
    return day;
  }

  private saveSoon(): void {
    if (this.saveTimer) return;
    this.saveTimer = this.options.clock.setTimeout(() => {
      this.saveTimer = null;
      void this.save();
    }, SAVE_AFTER_MS);
  }

  /** What's counted, to disk now: the phone calls it as the app leaves the front, where it may be closed before the timer. */
  async save(): Promise<void> {
    if (this.saveTimer) this.options.clock.clearTimeout(this.saveTimer);
    this.saveTimer = null;
    if (!this.kept || !this.options.enabled()) return;
    await this.options.storage.write(FILE, JSON.stringify(this.kept)).catch(() => undefined);
  }

  private stopTimers(): void {
    if (this.sendTimer) this.options.clock.clearTimeout(this.sendTimer);
    this.sendTimer = null;
  }
}
