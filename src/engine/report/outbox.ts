// Problem reports on their way to the maintainer's relay (ADR 0014): "Kirim langsung", and those
// that go by themselves when the Student said so. Each problem goes once, known by what it is (its
// feed, its kind, its checks with every number a "9"), and only that signature's hash and when it
// went are kept on disk, never what was in it, so a restart doesn't send it again. It goes again
// only once it went away (its page read well) and came back, a week or more after it went. Nothing
// goes while the app can't reach anything, and a relay that didn't answer is tried again later,
// quietly. The token for the Student's story on a report stays in memory.
//
// It also keeps what the window shows ("app.reports"): what was sent (when, which page, its
// issue), and the problem the app is asking about: the first one ever ("send reports like this by
// themselves?", asked once), or each new one when the Student said to ask.
import { createHash } from "node:crypto";
import type { ActionOutput } from "../../core/contract";
import { type ProblemReport, type ReportSending, type ReportsState, reportSendingOf, type SentReport, type Settings } from "../../core/models";
import type { AreaLog } from "../app-log";
import type { Clock, TimerHandle } from "../clock";
import { EngineError } from "../errors";
import type { Storage } from "../store/storage";
import type { Kept } from "./kept-pages";
import { type Posted, postNote, postReport, type Relay } from "./relay";

const LEDGER = "reports-sent.json";
/** A problem that went may go again once it came back this long after. */
const SEND_AGAIN_AFTER = 7 * 24 * 3_600_000;
/** How long a send waits after no answer, longer each time. */
const RETRY_AFTER = [5, 15, 60].map((minutes) => minutes * 60_000);
const MAX_LISTED = 20;
const EMPTY: ReportsState = { sent: [], asking: null };

/** What "Kirim langsung" got: as the window hears it. */
export type Sent = ActionOutput<"report.send">;
/** What adding the Student's story got. */
export type Noted = ActionOutput<"report.note">["result"];

export interface OutboxDeps {
  clock: Clock;
  storage: Storage;
  /** The relay, or null when the app has no address for one: then nothing is sent, or asked. */
  relay: Relay | null;
  /** The computer's system, as a report names it ("macOS 15.3 (arm64)"). */
  os(): string;
  settings(): Settings;
  /** What's kept for a feed now (./kept-pages.ts). */
  keptFor(feed: string): Kept | undefined;
  /** The report about one feed's problem, built and scrubbed as "Laporkan masalah" builds it. */
  build(feed: string): Promise<ProblemReport>;
  get(): ReportsState | undefined;
  set(state: ReportsState): Promise<void>;
  /** False while every source the Student is signed in to gets no answer. */
  online(): boolean;
  log: AreaLog;
}

/** A problem as it's known when deciding whether it went already: its feed, its kind, its checks with every number a "9". */
export function signatureOf(kept: Pick<Kept, "feed" | "kind" | "check" | "rows">): string {
  const checks = kept.kind === "changed" ? [kept.check] : [...new Set(kept.rows.map((row) => row.why))].sort();
  const text = [kept.feed, kept.kind, ...checks.map((check) => check.replace(/\d+/g, "9"))].join("\n");
  return createHash("sha256").update(text).digest("hex").slice(0, 32);
}

interface Ledger {
  /** Signature → when it went (or the relay refused it for good). */
  sent: Record<string, number>;
  /** Signature → when the Student was asked about it. */
  asked: Record<string, number>;
  /** Signature → when its page last read well again. */
  gone: Record<string, number>;
}

export class Outbox {
  private ledger: Ledger = { sent: {}, asked: {}, gone: {} };
  /** Feeds whose problem goes by itself next. */
  private readonly due = new Set<string>();
  private timer: TimerHandle | null = null;
  private timerAt = 0;
  private running: Promise<void> | null = null;
  private failures = 0;
  /** Which Student's reports these are: a sign-out starts a new one, and what an earlier send finds is dropped. */
  private generation = 0;
  /** The story token of each report sent this session, by its id at the relay. */
  private readonly tokens = new Map<string, string>();
  /** A send due now, before it starts: what `idle` waits for too. */
  private soonDone: { promise: Promise<void>; resolve: () => void } | null = null;

  constructor(private readonly deps: OutboxDeps) {}

  /** Whether reports can go to a relay at all. */
  get on(): boolean {
    return this.deps.relay !== null;
  }

  async load(): Promise<void> {
    try {
      const saved = JSON.parse((await this.deps.storage.read(LEDGER)) ?? "null");
      if (saved?.format === 1) this.ledger = { sent: times(saved.sent), asked: times(saved.asked), gone: times(saved.gone) };
    } catch {
      // Unreadable: nothing went, as far as the app knows.
    }
    // The pages behind a question asked before the app last quit are gone with it.
    if (this.deps.get()?.asking) await this.update({ asking: null });
  }

  stop(): void {
    if (this.timer) this.deps.clock.clearTimeout(this.timer);
    this.timer = null;
    this.soonDone?.resolve();
    this.soonDone = null;
  }

  /** A read kept a problem (again): send it, or ask about it, as the Student said. */
  onKept(kept: Kept): void {
    if (!this.on) return;
    const settings = this.deps.settings();
    const choice = reportSendingOf(settings);
    if (choice === "never") return;
    const signature = signatureOf(kept);
    if (this.held("sent", signature)) return;
    if (choice === "auto") {
      this.due.add(kept.feed);
      this.soon();
      return;
    }
    // Asked about it already, or the first question is still waiting for its answer.
    const first = !settings.reportAsked;
    if (this.held("asked", signature) || (first && this.deps.get()?.asking)) return;
    this.ledger.asked[signature] = this.deps.clock.now();
    void this.saveLedger();
    const asking = { feed: kept.feed, kind: kept.kind, rowsLeftOut: kept.rows.length, datasets: [...kept.datasets], first, at: this.deps.clock.now() };
    void this.update({ asking });
  }

  /** A feed's problem is no more: its page read well (`readWell`), or its source signed out. */
  onForgotten(kept: Kept, readWell: boolean): void {
    this.due.delete(kept.feed);
    if (readWell) {
      this.ledger.gone[signatureOf(kept)] = this.deps.clock.now();
      void this.saveLedger();
    }
    if (this.deps.get()?.asking?.feed === kept.feed) void this.update({ asking: null });
  }

  /** The Student's choice changed. Answering the question with "auto" sends the problem it was about. */
  chose(choice: ReportSending): void {
    if (!this.on) return;
    const asking = this.deps.get()?.asking;
    if (!asking) return;
    void this.update({ asking: null });
    const kept = this.deps.keptFor(asking.feed);
    if (choice === "auto" && kept && !this.held("sent", signatureOf(kept))) {
      this.due.add(asking.feed);
      this.soon();
    }
  }

  /** The Student closed the question without sending. True when it was the one asked once. */
  async dismiss(): Promise<boolean> {
    const first = this.deps.get()?.asking?.first ?? false;
    await this.update({ asking: null });
    return first;
  }

  /** Whether a report this app sent was filed as that issue. */
  filed(issue: number): boolean {
    return (this.deps.get()?.sent ?? []).some((sent) => sent.issue?.number === issue);
  }

  /** "Kirim langsung": the report the Student was shown, with their note. */
  async send(report: ProblemReport, { note, os }: { note: string; os: string }): Promise<Sent> {
    const relay = this.deps.relay;
    if (!relay) throw new EngineError("Rejected", "This copy of the app has no relay to send to");
    const generation = this.generation;
    const posted = await postReport(relay, {
      envelope: 1,
      report,
      os,
      lang: this.deps.settings().lang,
      how: "manual",
      ...(note.trim() ? { note: note.trim() } : {}),
    });
    if (posted.kind === "later") {
      if (posted.offline) throw new EngineError("Offline", "The relay didn't answer", true);
      this.deps.log("warn", "the relay couldn't take a report now");
      return { result: "busy" };
    }
    const signatures = report.problems.flatMap((problem) => {
      const kept = this.deps.keptFor(problem.feed);
      return kept ? [signatureOf(kept)] : [];
    });
    await this.record(posted, report, "manual", signatures, generation);
    for (const problem of report.problems) this.due.delete(problem.feed);
    if (report.problems.some((problem) => problem.feed === this.deps.get()?.asking?.feed)) await this.update({ asking: null });
    if (posted.kind === "filed") return { result: "filed", id: posted.id, issue: posted.issue, duplicate: posted.duplicate };
    if (posted.kind === "stored") return { result: "stored", id: null, issue: null, duplicate: false };
    return { result: posted.reason === "invalid" ? "failed" : posted.reason };
  }

  /** The Student's story on a report sent this session. */
  async note(id: string, note: string): Promise<Noted> {
    const token = this.tokens.get(id);
    const relay = this.deps.relay;
    if (!relay || !token) return "gone";
    const noted = await postNote(relay, id, token, note.trim());
    if (noted.kind === "later" && noted.offline) throw new EngineError("Offline", "The relay didn't answer", true);
    if (noted.kind === "added") this.deps.log("info", `story added to ${id}`);
    if (noted.kind === "refused") return noted.reason === "personal" ? "personal" : "failed";
    return noted.kind === "later" ? "busy" : noted.kind;
  }

  /** Signing out of everything: what went, and what was asked, was another Student's. A send under way lands nowhere. */
  async reset(): Promise<void> {
    this.generation += 1;
    this.stop();
    this.due.clear();
    this.tokens.clear();
    this.failures = 0;
    this.ledger = { sent: {}, asked: {}, gone: {} };
    await this.saveLedger();
    if (this.deps.get()) await this.deps.set(EMPTY);
  }

  /** Whatever is going now, or is due now, has gone (or waits for later). */
  async idle(): Promise<void> {
    while (this.soonDone || this.running) await (this.running ?? this.soonDone?.promise);
  }

  /** The app can reach things again: what waited goes now. */
  wake(): void {
    if (this.due.size && this.timer && this.timerAt > this.deps.clock.now()) this.soon(true);
  }

  /**
   * Whether a problem is held back from going (or being asked about) again: it went (or was asked
   * about), and hasn't since gone away and come back a week or more after.
   */
  private held(list: "sent" | "asked", signature: string): boolean {
    const at = this.ledger[list][signature];
    if (at === undefined) return false;
    const gone = this.ledger.gone[signature];
    return !(gone !== undefined && gone > at && this.deps.clock.now() - at >= SEND_AGAIN_AFTER);
  }

  /** Sends what's due on the next tick, never inside the read that kept it. `now`: sooner than a wait already set. */
  private soon(now = false): void {
    if (this.timer && (!now || this.timerAt <= this.deps.clock.now())) return;
    if (this.timer) this.deps.clock.clearTimeout(this.timer);
    this.soonDone ??= deferred();
    this.schedule(0);
  }

  private schedule(delay: number): void {
    this.timerAt = this.deps.clock.now() + delay;
    this.timer = this.deps.clock.setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, delay);
  }

  private flush(): Promise<void> {
    this.running ??= this.sendDue().finally(() => {
      this.running = null;
      this.soonDone?.resolve();
      this.soonDone = null;
      // A problem kept while that went goes next.
      if (this.due.size && !this.timer) this.soon();
    });
    return this.running;
  }

  private async sendDue(): Promise<void> {
    const relay = this.deps.relay;
    const generation = this.generation;
    if (!relay) return;
    // The due list as it is each time round: one kept while a post is under way is in it too.
    for (let feed = firstOf(this.due); feed !== undefined; feed = firstOf(this.due)) {
      if (reportSendingOf(this.deps.settings()) !== "auto" || generation !== this.generation) return this.due.clear();
      const kept = this.deps.keptFor(feed);
      if (!kept || this.held("sent", signatureOf(kept))) {
        this.due.delete(feed);
        continue;
      }
      if (!this.deps.online()) return this.later(null);
      const report = await this.deps.build(feed);
      if (!report.problems.length) {
        this.due.delete(feed);
        continue;
      }
      const posted = await postReport(relay, { envelope: 1, report, os: this.deps.os(), lang: this.deps.settings().lang, how: "auto" });
      if (posted.kind === "later") return this.later(posted.after);
      this.due.delete(feed);
      this.failures = 0;
      await this.record(posted, report, "auto", [signatureOf(kept)], generation);
    }
  }

  /** No answer, or the relay asked to wait: the same again later, longer each time. */
  private later(after: number | null): void {
    this.failures += 1;
    const wait = after ?? RETRY_AFTER[Math.min(this.failures, RETRY_AFTER.length) - 1]!;
    this.deps.log("warn", `couldn't send a report, trying again in ${Math.round(wait / 60_000)} min`);
    if (!this.timer) this.schedule(wait);
  }

  /** It went (or was refused for good): known by its signatures, and listed for Settings when the relay took it. */
  private async record(
    posted: Exclude<Posted, { kind: "later" }>,
    report: ProblemReport,
    how: SentReport["how"],
    signatures: readonly string[],
    generation: number,
  ): Promise<void> {
    // Sent for a Student who has signed out of everything since: none of it is the next one's.
    if (generation !== this.generation) return;
    const now = this.deps.clock.now();
    for (const signature of signatures) this.ledger.sent[signature] = now;
    await this.saveLedger();
    if (posted.kind === "refused") {
      this.deps.log("warn", `the relay refused a report: ${posted.reason}${posted.found.length ? ` (${posted.found.join(", ")})` : ""}`);
      return;
    }
    const id = posted.kind === "filed" ? posted.id : null;
    if (posted.kind === "filed") this.tokens.set(posted.id, posted.noteToken);
    this.deps.log(
      "info",
      posted.kind === "filed" ? `sent ${posted.id}${posted.issue ? `, issue #${posted.issue.number}` : ""}` : "sent, the relay files it later",
    );
    const sent: SentReport = { id, at: now, feeds: report.problems.map((problem) => problem.feed), how, issue: posted.kind === "filed" ? posted.issue : null };
    await this.update({ sent: [sent, ...(this.deps.get()?.sent ?? [])].slice(0, MAX_LISTED) });
  }

  private async update(patch: Partial<ReportsState>): Promise<void> {
    await this.deps.set({ ...(this.deps.get() ?? EMPTY), ...patch });
  }

  /** Saves the ledger, without what no longer holds anything back (a problem that went away and is past its week). */
  private async saveLedger(): Promise<void> {
    const now = this.deps.clock.now();
    const { sent, asked, gone } = this.ledger;
    const holding = (list: Record<string, number>) =>
      Object.fromEntries(Object.entries(list).filter(([signature, at]) => !((gone[signature] ?? 0) > at && now - at >= SEND_AGAIN_AFTER)));
    const still = { sent: holding(sent), asked: holding(asked) };
    const stillGone = Object.fromEntries(Object.entries(gone).filter(([signature]) => signature in still.sent || signature in still.asked));
    this.ledger = { ...still, gone: stillGone };
    await this.deps.storage.write(LEDGER, JSON.stringify({ format: 1, ...this.ledger }));
  }
}

/** Only the times of a saved list (signature → time). */
function times(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value).filter(([key, at]) => /^[0-9a-f]{32}$/.test(key) && typeof at === "number"));
}

const firstOf = <T>(set: ReadonlySet<T>): T | undefined => set.values().next().value;

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
