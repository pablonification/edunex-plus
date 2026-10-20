// Alerts on the Student's phone, through ntfy (https://ntfy.sh): a free,
// open-source push service with Android and iPhone apps and no account. No
// server of ours: the laptop posts to a topic only the Student's phone
// listens to. Every alert the center delivers goes there too, and planned
// ones (deadline reminders, Presence opening) are booked ahead with ntfy's
// scheduled delivery, so they arrive with the laptop closed. Rules:
// - only what changed is posted: ntfy.sh takes 250 messages a day per
//   address, and a campus Wi-Fi shares one;
// - a booking's sequence ID comes from its alert's id: posting again
//   replaces it while it waits, DELETE cancels it;
// - a booked alert the laptop raises itself isn't sent twice;
// - a booking for something the Student does ends with a phone-only line
//   ("Abaikan kalau sudah dikumpulkan."): handed in from the phone while the
//   laptop is off, it can't be cancelled;
// - one more booking warns when the laptop hasn't read Edunex for a day;
// - during the Student's quiet hours (22:00 to 06:00 unless changed), what can
//   wait is held until they end: sent now, it's booked for then; booked ahead,
//   it's booked for then if it still matters then (before its `until`).
//   Presence, a class about to start and other urgent alerts always come at their time;
// - nothing here blocks or throws into the alert center: what fails waits
//   (longer each time) and goes on a later replan.
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import type { PhoneLink, PhoneProblem } from "../../core/actions/phone";
import { dateVars } from "../../core/dates";
import { edunexCourseUrl } from "../../core/links";
import { ALERT_GROUP, type AlertGroup, type AlertKind, type AlertText, type Course, type Lang, type QuietHours } from "../../core/models";
import type { Route } from "../../core/route";
import { type StringKey, translate } from "../../core/strings";
import { edunexTaskUrl } from "../../core/tasks";
import type { Clock } from "../clock";
import { EngineError } from "../errors";
import type { Vault } from "../store/storage";
import type { AlertNotice } from "./center";
import { clockTime, type PlannedAlert } from "./detector";

/** ntfy's public server. */
export const NTFY_HOST = "ntfy.sh";

/** One message as ntfy's JSON publishing takes it (https://docs.ntfy.sh/publish/#publish-as-json). */
export interface NtfyMessage {
  topic: string;
  message: string;
  title?: string;
  /** 3 is ntfy's default, 4 high. */
  priority: 3 | 4;
  /** The page a tap opens. */
  click?: string;
  /** Posting again with the same one replaces the message, even one still waiting for its time. */
  sequence_id: string;
  /** Delivered then (a unix time, in seconds), not now. */
  delay?: string;
}

export type NtfyRequest = { method: "POST"; message: NtfyMessage } | { method: "DELETE"; topic: string; sequenceId: string };

/** Sends one request to ntfy and resolves with its HTTP status; rejects when no answer came at all. */
export type Ntfy = (request: NtfyRequest) => Promise<number>;

export interface PhoneDeps {
  /** The way out to ntfy (src/desktop/ntfy.ts). Without one, no phone can be linked. */
  ntfy?: Ntfy;
  /** A new topic; random by default. */
  newTopic?: () => string;
  clock: Clock;
  vault: Vault;
  lang(): Lang;
  /** The Student's quiet hours on the phone, or null: off. */
  quiet(): QuietHours | null;
  /** This term's courses, for the Edunex page a tap on a course's alert opens. */
  courses(): readonly Course[];
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** ntfy.sh books up to 3 days ahead; the margin keeps a clock that's a little off inside it. */
const HORIZON = 3 * DAY - 2 * HOUR;
/** Closer than this, the laptop raises it itself (ntfy's own minimum is 10 seconds). */
const LEAD = 2 * MINUTE;
/** The "laptop hasn't checked" warning comes this long after the last good read of Edunex, booked again at most once an hour. */
const WATCHDOG_AFTER = DAY;
const WATCHDOG_EVERY = HOUR;
const WATCHDOG = "ep-watchdog";
/** ntfy.sh takes a burst of 60 requests, then one every 5 seconds: the rest waits for the next replan. */
const ROUND = 40;
/** Far more than 3 days of reminders; past it, nothing more is booked. */
const BOOKED_LIMIT = 300;
/** A message the laptop couldn't send is tried again this long, then let go. */
const OUTBOX_TTL = 3 * HOUR;
const OUTBOX_LIMIT = 20;
/** ntfy's messages are at most 4096 bytes. */
const MESSAGE_BYTES = 3_500;
const TITLE_BYTES = 250;
/** How long to wait after a failure, doubling each time it fails again. */
const BACKOFF: Record<PhoneProblem, { first: number; most: number }> = {
  offline: { first: MINUTE, most: 30 * MINUTE },
  busy: { first: 15 * MINUTE, most: 4 * HOUR },
};

/** A booked alert's last line on the phone, by group: what the Student may have done since, from the phone. */
const FOOTNOTE: Partial<Record<AlertGroup, StringKey>> = {
  deadline: "phone.footnote.deadline",
  presence: "phone.footnote.presence",
};

/** ntfy's topics and sequence IDs: letters, digits, "-" and "_", up to 64. */
const Name = z.string().regex(/^[-_A-Za-z0-9]{1,64}$/);

const Booking = z.object({
  seq: Name,
  /** When it reaches the phone. */
  at: z.number(),
  until: z.number(),
  hash: z.string().max(64),
  /** When the laptop raises it, when quiet hours moved `at` later. */
  raisedAt: z.number().optional(),
});

// Kept in the vault, beside the sign-in sessions: the topic is the only thing
// keeping the Student's messages from anyone else, so it's a secret like a
// session, encrypted by the OS keychain and never in the plain data folder
// (state.json, the datasets) that the window and its events see. Without a
// keychain it lasts until the app quits, like the sessions do. What's booked
// goes with it: without the topic it can't be cancelled anyway.
const VAULT_KEY = "phone.ntfy";
const Saved = z.object({
  format: z.literal(1),
  topic: Name,
  /** By alert id. */
  booked: z.record(z.string().max(500), Booking).refine((booked) => Object.keys(booked).length <= BOOKED_LIMIT),
  /** The "laptop hasn't checked" warning: when it's set to arrive, and when that was booked. */
  watchdog: z.object({ at: z.number(), bookedAt: z.number() }).nullable(),
});
type Saved = z.infer<typeof Saved>;

type Message = Omit<NtfyMessage, "topic">;
type Outcome = "ok" | "refused" | "later";

/** What a phone message is made from: a notice, or a planned alert. */
type PhoneAlert = Pick<AlertNotice, "id" | "kind" | "title" | "body" | "target"> & { urgent?: boolean };

/**
 * When the quiet hours `at` falls in end, on this computer's clock (so where
 * clocks change for summer, they still end at the same hour); null when `at`
 * isn't in them or they're off. From 22 to 6 they cross midnight.
 */
export function quietUntil(at: number, quiet: QuietHours | null): number | null {
  if (!quiet || quiet.start === quiet.end) return null;
  const hour = new Date(at).getHours();
  const inside = quiet.start < quiet.end ? hour >= quiet.start && hour < quiet.end : hour >= quiet.start || hour < quiet.end;
  if (!inside) return null;
  const end = new Date(at);
  end.setHours(quiet.end, 0, 0, 0);
  // In the evening part of hours across midnight: they end tomorrow.
  if (end.getTime() <= at) {
    end.setDate(end.getDate() + 1);
    end.setHours(quiet.end, 0, 0, 0);
  }
  return end.getTime();
}

/** Presence opening or closing, a class about to start, and other urgent alerts never wait for quiet hours to end. */
const ON_TIME: ReadonlySet<AlertKind> = new Set(["presenceOpen", "presenceClosing", "classSoon"]);
const canWait = (alert: Pick<PhoneAlert, "kind" | "urgent">) => !alert.urgent && !ON_TIME.has(alert.kind);

/** When a planned alert reaches the phone: when quiet hours end if it can wait and still matters then, else at its time. */
export function phoneTime(planned: Pick<PlannedAlert, "kind" | "urgent" | "at" | "until">, quiet: QuietHours | null): number {
  const end = canWait(planned) ? quietUntil(planned.at, quiet) : null;
  return end !== null && end < planned.until ? end : planned.at;
}

/** Letters and digits that can't be read as one another (no 0/o, 1/l/i), all lowercase: typed on an iPhone, nothing gets capitalised or misread. */
const TOPIC_LETTERS = "23456789abcdefghjkmnpqrstuvwxyz";

/**
 * A new topic, short enough to type on an iPhone: "ep-" and three groups of
 * four, 12 random characters (about 59 bits). Nobody can guess that by trying
 * topics on ntfy.sh, which limits how fast one address asks.
 */
export function newTopic(): string {
  const chars = [...randomBytes(24)].filter((byte) => byte < 248).slice(0, 12);
  // 248 is a multiple of 31: every letter as likely. 24 bytes leave fewer than 12 almost never; then draw again.
  if (chars.length < 12) return newTopic();
  const code = chars.map((byte) => TOPIC_LETTERS[byte % TOPIC_LETTERS.length]).join("");
  return `ep-${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8)}`;
}

/** The link the Android app subscribes from. */
export const subscribeLink = (topic: string) => `ntfy://${NTFY_HOST}/${topic}?display=${encodeURIComponent("Edunex Plus")}`;

/** A stable sequence ID for an alert id, in the characters ntfy takes. */
export const sequenceId = (id: string) => `ep-${digest(id)}`;

const digest = (text: string) => createHash("sha256").update(text).digest("base64url").slice(0, 22);

const utf8 = new TextEncoder();

/** At most `bytes` of UTF-8, cut between characters. */
function clip(text: string, bytes: number): string {
  if (utf8.encode(text).length <= bytes) return text;
  let out = "";
  let used = 0;
  for (const char of text) {
    used += utf8.encode(char).length;
    if (used > bytes - 3) break;
    out += char;
  }
  return `${out}…`;
}

/** The Edunex page a tap opens: a Task's, or a course's. Other screens have none. */
export function clickUrl(target: Route, courses: readonly Course[]): string | undefined {
  if (target.screen === "task") return edunexTaskUrl(target.taskId);
  if (target.screen === "course") {
    const course = courses.find((c) => c.code === target.code);
    return course ? edunexCourseUrl(course.edunex.courseId) : undefined;
  }
  return undefined;
}

/**
 * An alert as a phone message, in the Student's language. `ahead`: booked
 * before its time, so it ends with what the Student may have done since.
 */
export function phoneMessage(alert: PhoneAlert, lang: Lang, options: { ahead: boolean; courses: readonly Course[] }): Message {
  const text = (part: AlertText) => translate(lang, part.key, part.vars);
  const footnote = options.ahead ? FOOTNOTE[ALERT_GROUP[alert.kind]] : undefined;
  const lines = [alert.body ? text(alert.body) : null, footnote ? translate(lang, footnote) : null].filter((line) => line !== null);
  const click = clickUrl(alert.target, options.courses);
  return {
    sequence_id: sequenceId(alert.id),
    ...(lines.length ? { title: clip(text(alert.title), TITLE_BYTES) } : {}),
    message: clip(lines.length ? lines.join("\n") : text(alert.title), MESSAGE_BYTES),
    // Presence opening, and every other alert that goes out at once, comes through first.
    priority: alert.urgent || alert.kind === "presenceOpen" ? 4 : 3,
    ...(click ? { click } : {}),
  };
}

const delay = (at: number) => String(Math.floor(at / 1000));

/** Sends one request of a round; null once the round is over (out of turns, a failure, or the phone unlinked). */
type Send = (request: NtfyRequest) => Promise<"ok" | "refused" | null>;

export class PhoneChannel {
  private saved: Saved | null = null;
  /** Null until the first replan: what's booked stays as it is until there's a plan to compare it with. */
  private upcomingAlerts: readonly PlannedAlert[] | null = null;
  /** The last good read of Edunex. Undefined: not known yet (the warning stays as booked); null: signed out of Edunex. */
  private lastCheck: number | null | undefined;
  private problem: PhoneProblem | null = null;
  private failures = 0;
  private retryAt = 0;
  /** Messages the laptop sends now, tried again with the bookings when they don't get through. Only in memory. */
  private outbox: { id: string; message: Message; until: number; holdUntil: number | null }[] = [];
  /** Bookings ntfy turned down (not for being busy), by alert id: not asked again until they change. */
  private readonly refused = new Map<string, string>();
  private running: Promise<void> | null = null;
  private again = false;

  constructor(private readonly deps: PhoneDeps) {}

  async load(): Promise<void> {
    try {
      const parsed = Saved.safeParse(JSON.parse((await this.deps.vault.get(VAULT_KEY)) ?? "null"));
      this.saved = parsed.success ? parsed.data : null;
    } catch {
      // Unreadable: not linked. The Student links the phone again.
      this.saved = null;
    }
  }

  link(): PhoneLink {
    const saved = this.saved;
    return saved ? { connected: true, topic: saved.topic, link: subscribeLink(saved.topic), problem: this.problem } : { connected: false };
  }

  /** Makes a topic (or keeps the one there is) and books what's coming. */
  async connect(): Promise<PhoneLink> {
    if (!this.deps.ntfy) throw new EngineError("Rejected", "This app can't send to a phone");
    if (!this.saved) {
      const topic = Name.parse((this.deps.newTopic ?? newTopic)());
      this.saved = { format: 1, topic, booked: {}, watchdog: null };
      this.clearFailures();
      await this.save();
      this.kick();
    }
    return this.link();
  }

  /** A sample message, now, whatever the wait after a failure: the Student asked for it. */
  async test(): Promise<PhoneLink> {
    const saved = this.saved;
    if (!saved) throw new EngineError("Rejected", "No phone is linked");
    const lang = this.deps.lang();
    const outcome = await this.request({
      method: "POST",
      message: {
        topic: saved.topic,
        sequence_id: "ep-test",
        title: translate(lang, "phone.message.test"),
        message: translate(lang, "phone.message.testBody"),
        priority: 3,
      },
    });
    if (outcome === "ok") this.kick();
    return this.link();
  }

  /** Cancels everything still booked, then forgets the topic. False: ntfy couldn't be reached, so some may still come. */
  async disconnect(): Promise<{ cancelled: boolean }> {
    const saved = this.saved;
    if (!saved) return { cancelled: true };
    this.saved = null;
    this.outbox = [];
    this.refused.clear();
    await this.deps.vault.delete(VAULT_KEY);
    // A round still sending stops at its next step; what it booked by then is cancelled too.
    await this.idle();
    const now = this.deps.clock.now();
    const waiting = Object.values(saved.booked)
      .filter((booking) => booking.at > now)
      .map((booking) => booking.seq);
    if (saved.watchdog && saved.watchdog.at > now) waiting.push(WATCHDOG);
    const outcomes = await Promise.all(waiting.map((sequenceId) => this.request({ method: "DELETE", topic: saved.topic, sequenceId })));
    this.clearFailures();
    return { cancelled: outcomes.every((outcome) => outcome !== "later") };
  }

  /** The center's planned alerts still to come, at every replan. */
  upcoming(planned: readonly PlannedAlert[]): void {
    this.upcomingAlerts = planned;
    this.kick();
  }

  /** Edunex was read (at), or signed out of (null). */
  checked(at: number | null): void {
    this.lastCheck = at;
    this.kick();
  }

  /**
   * An alert reached the Student on this computer: on the phone too, unless
   * every alert in it was booked ahead. In quiet hours, what can wait is
   * booked for when they end. Not a deadline reminder: without its deadline
   * at hand, it might come after it (booked ahead, phoneTime has it).
   */
  deliver(notice: AlertNotice): void {
    const saved = this.saved;
    if (!saved) return;
    if (notice.ids.length > 0 && notice.ids.every((id) => Object.hasOwn(saved.booked, id))) return;
    const now = this.deps.clock.now();
    const holdUntil = canWait(notice) && notice.kind !== "deadline" ? quietUntil(now, this.deps.quiet()) : null;
    const message = phoneMessage(notice, this.deps.lang(), { ahead: false, courses: this.deps.courses() });
    this.outbox = [...this.outbox, { id: notice.id, message, until: now + OUTBOX_TTL, holdUntil }].slice(-OUTBOX_LIMIT);
    this.kick();
  }

  /** Done with what's being sent now. */
  async idle(): Promise<void> {
    while (this.running) await this.running;
  }

  /** One round at a time; a call during one runs another after it. */
  private kick(): void {
    if (!this.saved || !this.deps.ntfy) return;
    if (this.running) {
      this.again = true;
      return;
    }
    this.running = (async () => {
      do {
        this.again = false;
        await this.round();
      } while (this.again);
    })()
      .catch((error: unknown) => console.error("[phone] sending failed:", error instanceof Error ? error.name : "unknown"))
      .finally(() => {
        this.running = null;
      });
  }

  /** Sends what waited, books ahead, and keeps the warning booked. Saves what's booked once, at the end. */
  private async round(): Promise<void> {
    const saved = this.saved;
    const now = this.deps.clock.now();
    if (!saved || now < this.retryAt) return;
    let turns = ROUND;
    let over = false;
    const send: Send = async (request) => {
      if (over || turns <= 0) return null;
      turns--;
      const outcome = await this.request(request);
      // Unlinked meanwhile, or failed: nothing more goes out this round.
      if (this.saved !== saved || outcome === "later") {
        over = true;
        return null;
      }
      return outcome;
    };
    let changed = false;
    try {
      this.outbox = this.outbox.filter((item) => item.until > now);
      while (this.outbox.length) {
        const { id, message, holdUntil } = this.outbox[0];
        // Held until quiet hours end, unless they ended while it waited to get through.
        const held = holdUntil !== null && holdUntil - now >= LEAD ? holdUntil : null;
        const outcome = await send({ method: "POST", message: { ...message, ...(held ? { delay: delay(held) } : {}), topic: saved.topic } });
        if (!outcome) return;
        this.outbox.shift();
        // Kept with the bookings, so unlinking cancels it too.
        if (held && outcome === "ok" && Object.keys(saved.booked).length < BOOKED_LIMIT) {
          saved.booked[id] = { seq: message.sequence_id, at: held, until: held, hash: "", raisedAt: now };
          changed = true;
        }
      }
      if (this.upcomingAlerts && (await this.book(saved, this.upcomingAlerts, now, send))) changed = true;
      if (await this.keepWatch(saved, now, send)) changed = true;
    } finally {
      if (changed && this.saved === saved) await this.save();
    }
  }

  /** Cancels what left the plan, and books what's new or changed. True when what's booked changed. */
  private async book(saved: Saved, plan: readonly PlannedAlert[], now: number, send: Send): Promise<boolean> {
    const lang = this.deps.lang();
    const courses = this.deps.courses();
    const quiet = this.deps.quiet();
    // `at`: when it reaches the phone. Its delay is in the hash, so new quiet hours book it again.
    const wanted = new Map<string, { planned: PlannedAlert; at: number; message: Message; hash: string }>();
    for (const planned of plan) {
      const at = phoneTime(planned, quiet);
      const message = { ...phoneMessage(planned, lang, { ahead: true, courses }), delay: delay(at) };
      wanted.set(planned.id, { planned, at, message, hash: digest(JSON.stringify({ lang, message })) });
    }
    const bookable = (at: number) => at - now >= LEAD && at - now <= HORIZON;
    let changed = false;

    for (const [id, booking] of Object.entries(saved.booked)) {
      // Over: forgotten. Delivered already: kept until then, so the laptop doesn't send it again.
      if (booking.until <= now) {
        delete saved.booked[id];
        changed = true;
        continue;
      }
      // Raised on the laptop already, held for the end of quiet hours: kept too.
      if (booking.at <= now || (booking.raisedAt !== undefined && booking.raisedAt <= now)) continue;
      const next = wanted.get(id);
      if (next && (next.hash === booking.hash || bookable(next.at))) continue;
      // Gone from the plan (handed in, moved, muted), or changed too close to its time to book again.
      if (!(await send({ method: "DELETE", topic: saved.topic, sequenceId: booking.seq }))) return changed;
      delete saved.booked[id];
      changed = true;
    }

    const due = [...wanted.values()].filter(({ at }) => bookable(at)).sort((a, b) => a.at - b.at);
    for (const { planned, at, message, hash } of due) {
      const booked = saved.booked[planned.id];
      if (booked?.hash === hash || this.refused.get(planned.id) === hash) continue;
      if (!booked && Object.keys(saved.booked).length >= BOOKED_LIMIT) break;
      // Changed: posted again under the same sequence ID, which replaces the one waiting.
      const outcome = await send({ method: "POST", message: { ...message, topic: saved.topic } });
      if (!outcome) return changed;
      if (outcome === "refused") this.refused.set(planned.id, hash);
      else {
        saved.booked[planned.id] = { seq: message.sequence_id, at, until: planned.until, hash, ...(at !== planned.at ? { raisedAt: planned.at } : {}) };
        changed = true;
      }
    }
    return changed;
  }

  /**
   * Books the "laptop hasn't checked" warning a day after the last good read
   * (or when quiet hours end, if that's in them); cancels it once signed out
   * of Edunex. True when it changed.
   */
  private async keepWatch(saved: Saved, now: number, send: Send): Promise<boolean> {
    const check = this.lastCheck;
    const booked = saved.watchdog;
    if (check === undefined) return false;
    if (check === null) {
      if (!booked) return false;
      if (booked.at > now && (await send({ method: "DELETE", topic: saved.topic, sequenceId: WATCHDOG })) !== "ok") return false;
      saved.watchdog = null;
      return true;
    }
    const at = quietUntil(check + WATCHDOG_AFTER, this.deps.quiet()) ?? check + WATCHDOG_AFTER;
    if (at - now < LEAD || booked?.at === at) return false;
    // Edunex is read every few minutes: the warning moves at most once an hour, unless it already went off.
    if (booked && booked.at > now && now - booked.bookedAt < WATCHDOG_EVERY) return false;
    const lang = this.deps.lang();
    const outcome = await send({
      method: "POST",
      message: {
        topic: saved.topic,
        sequence_id: WATCHDOG,
        title: translate(lang, "phone.watchdog"),
        message: translate(lang, "phone.watchdogBody", { ...dateVars(check), time: clockTime(check) }),
        priority: 3,
        delay: delay(at),
      },
    });
    if (outcome !== "ok") return false;
    saved.watchdog = { at, bookedAt: now };
    return true;
  }

  /** One request. A failure says why (Settings shows it) and makes the next round wait, longer each time. */
  private async request(request: NtfyRequest): Promise<Outcome> {
    let status: number;
    try {
      status = await this.deps.ntfy!(request);
    } catch {
      return this.failed("offline");
    }
    if (status === 429 || status >= 500) return this.failed("busy");
    // Already gone (delivered, or cancelled before) is as good as cancelled.
    if (status >= 400 && !(request.method === "DELETE" && status === 404)) return "refused";
    this.clearFailures();
    return "ok";
  }

  private failed(problem: PhoneProblem): Outcome {
    this.problem = problem;
    this.failures++;
    const { first, most } = BACKOFF[problem];
    this.retryAt = this.deps.clock.now() + Math.min(most, first * 2 ** (this.failures - 1));
    return "later";
  }

  private clearFailures(): void {
    this.problem = null;
    this.failures = 0;
    this.retryAt = 0;
  }

  private async save(): Promise<void> {
    if (this.saved) await this.deps.vault.set(VAULT_KEY, JSON.stringify(this.saved));
  }
}
