// The report relay (ADR 0015): takes the problem report the app sends, keeps it whole and private,
// and files it as an issue on the app's repository: one issue per problem, however many Students
// meet it. Plain code behind four doors (where it keeps things, GitHub, the clock, GitHub's signing
// keys), so it runs the same in the Durable Object that holds it (./worker.ts) as in the tests.
//
// The endpoint is public, so spam is planned for: a size limit, caps per address and per day (in
// reports and in bytes, so spam can't fill the free plan's storage), a cap on new issues per day,
// and the privacy rules on everything. A report that can't be filed now (GitHub down, the day's
// issues used up) is kept, and the cron trigger files it later, oldest first.
import { actionsRun, type SigningKeys } from "./actions";
import { type GitHub, GitHubError, type Issue } from "./github";
import { bugDraft, type Draft, driftDraft, header, notesComment, type QueuedNote, seenAgain, withHeader } from "./issue";
import { Envelope, NoteBody, type Problem, parseJson, personalIn, personalInBody, type Reproduces, signatureOf } from "./report";
import { deleteBody, getBody, putBody, type Store } from "./store";
import { randomToken, sha256 } from "./tokens";

export interface Limits {
  /** Bytes a report can be, and all of a day's reports together. */
  maxBody: number;
  bytesPerDay: number;
  /** Reports a day from one address, and from everyone. */
  reportsPerAddress: number;
  reportsPerDay: number;
  /** Problems in one report that can each open an issue. */
  issuesPerReport: number;
  /** New issues a day, of any kind; past it, reports wait for the next day's. */
  issuesPerDay: number;
  /** Reports without a problem (from Settings) a day: each opens its own issue. */
  bugsPerDay: number;
  /** New issues a day the fix bot may start on by itself. */
  botStartsPerDay: number;
  /** Notes a day from one address, and on one report. */
  notesPerAddress: number;
  notesPerReport: number;
  /** The least time between two changes to one issue (ms). */
  cooldown: number;
  /** How long a report is kept, and a problem waits for its issue to open (days). */
  keepDays: number;
  waitDays: number;
}

export const LIMITS: Limits = {
  maxBody: 3 * 1024 * 1024,
  // A report of a few pages is well under 1 MB. At most this a day for 60 days fits in the
  // free plan's 5 GB, however much spam comes.
  bytesPerDay: 50 * 1024 * 1024,
  // A campus network puts many Students behind one address.
  reportsPerAddress: 30,
  reportsPerDay: 500,
  issuesPerReport: 5,
  issuesPerDay: 20,
  bugsPerDay: 5,
  botStartsPerDay: 3,
  notesPerAddress: 30,
  notesPerReport: 3,
  cooldown: 10 * 60_000,
  keepDays: 60,
  waitDays: 14,
};

/** One issue's worth of reports: a problem (by its signature), or one report with no problem in it. */
interface Thread {
  key: string;
  kind: "drift" | "bug";
  /** When its first report came (ms): the issues waiting to open are opened oldest first. */
  since: number;
  issue: Issue | null;
  /** What it opens, until it's filed. */
  draft: Draft | null;
  /** Reports that went to it, and how many its issue says. */
  count: number;
  shown: number;
  /** The latest ten, newest first, and the latest whose scrubbed pages fail the same way. */
  reports: string[];
  reproducing: string | null;
  reproduces: Reproduces;
  /** Whether the fix bot starts on its issue by itself. */
  botStarts: boolean;
  latest: { at: number; version: string };
  /** Notes waiting to go on its issue. */
  notes: QueuedNote[];
  /** When the relay last changed its issue (ms, 0: never), and last said it was seen again after it closed. */
  touched: number;
  nudged: number;
}

interface ReportRecord {
  id: string;
  at: number;
  /** The threads it went to, the first problem's first: notes go on that one's issue. */
  threads: string[];
  noteHash: string;
  notes: number;
  pieces: number;
}

/** A ticket reads one report, for one run of the fix bot (relay/src/actions.ts). */
interface Ticket {
  id: string;
  run: string;
  until: number;
  uses: number;
}

/** What opening a thread's issue came to: opened (or already open), the day's new issues used up, or GitHub not answering. */
type Opening = "open" | "capped" | "unreachable";

/** Where each thing is kept (a report's body: ./store.ts). Lists sort by key: the dates and times in them put the oldest first. */
const KEY = {
  report: (id: string) => `report:${id}`,
  thread: (key: string) => `thread:${key}`,
  /** The cron trigger's lists: threads whose issue isn't open yet, and threads whose issue is behind (its count, its notes). */
  unopened: (thread: Pick<Thread, "key" | "since">) => `unopened:${String(thread.since).padStart(15, "0")}:${thread.key}`,
  behind: (key: string) => `behind:${key}`,
  count: (day: string, name: string) => `count:${day}:${name}`,
  expiry: (day: string, id: string) => `expiry:${day}:${id}`,
  ticket: (hash: string) => `ticket:${hash}`,
};

/** The last part of a key: what it's about. */
const lastPart = (name: string) => name.slice(name.lastIndexOf(":") + 1);

const KEEP_IDS = 10;
const MAX_NOTES_WAITING = 20;
/** Issues one cron run brings up to date, and opens: each takes a few calls to GitHub, and a run gets 50. */
const PER_RUN = 10;
/**
 * How long a ticket lets the fix bot read one report, and how many times: long enough for its run
 * to wait for another of the same issue's (45 minutes at most) and do its own. Only that run can.
 */
const TICKET_TIME = 3 * 3_600_000;
const TICKET_USES = 3;
/** The fix bot's workflow file: only its runs on main can use a ticket. */
const BOT_WORKFLOW = "drift-fix.yml";
const DAY = 24 * 3_600_000;

const dayOf = (at: number) => new Date(at).toISOString().slice(0, 10);

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

/** 429, to come back after midnight UTC, when the day's caps start again. */
function slowDown(now: number): Response {
  const seconds = Math.ceil((Date.parse(`${dayOf(now + DAY)}T00:00:00Z`) - now) / 1000);
  return json(429, { error: "slow-down" }, { "retry-after": String(seconds) });
}

const bearer = (request: Request) => /^Bearer (\S+)$/.exec(request.headers.get("authorization") ?? "")?.[1] ?? null;

/** The body, or null if it's more than `max` bytes, read no further than that. */
async function readLimited(request: Request, max: number): Promise<string | null> {
  if (Number(request.headers.get("content-length") ?? 0) > max) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    parts.push(value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const part of parts) {
    bytes.set(part, at);
    at += part.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/** Whether its issue doesn't say all it should yet: reports it hasn't counted, notes not posted. */
const isBehind = (thread: Thread) => thread.count !== thread.shown || thread.notes.length > 0;

/** One piece of storage work at a time: what reads a value and writes it back never interleaves with another. */
class Lock {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(work: () => Promise<T>): Promise<T> {
    const result = this.tail.then(work);
    this.tail = result.catch(() => undefined);
    return result;
  }
}

export interface RelayOptions {
  store: Store;
  github: GitHub;
  now: () => number;
  /** Reads any report (the maintainer, the fix bot). Shorter than 32 characters: nobody can. */
  maintainerToken: string;
  /** "owner/name": the repository whose fix bot may use tickets. */
  repo: string;
  /** GitHub's keys, to check the fix bot's run (./actions.ts). */
  signingKeys: SigningKeys;
  limits?: Partial<Limits>;
  log?: (line: string) => void;
}

export class Relay {
  private readonly store: Store;
  private readonly github: GitHub;
  private readonly now: () => number;
  private readonly maintainerToken: string;
  private readonly repo: string;
  private readonly signingKeys: SigningKeys;
  private readonly limits: Limits;
  private readonly log: (line: string) => void;
  private readonly lock = new Lock();
  /** Issues being opened now, by thread: a report for one waits for it rather than opening another. */
  private readonly opening = new Map<string, Promise<Opening>>();

  constructor(options: RelayOptions) {
    this.store = options.store;
    this.github = options.github;
    this.now = options.now;
    this.maintainerToken = options.maintainerToken;
    this.repo = options.repo;
    this.signingKeys = options.signingKeys;
    this.limits = { ...LIMITS, ...options.limits };
    this.log = options.log ?? (() => {});
  }

  /** One request to the relay's API (docs/relay.md). `address`: where it came from, for the caps. */
  async handle(request: Request, address: string): Promise<Response> {
    const { pathname } = new URL(request.url);
    try {
      if (pathname === "/v1/health" && request.method === "GET") return json(200, { ok: true });
      if (pathname === "/v1/reports" && request.method === "POST") return await this.receive(request, address);
      const [, id, action] = /^\/v1\/reports\/([0-9a-f-]{36})(?:\/(note|ticket))?$/.exec(pathname) ?? [];
      if (id && !action && request.method === "GET") return await this.read(request, id);
      if (id && action === "note" && request.method === "POST") return await this.note(request, address, id);
      if (id && action === "ticket" && request.method === "POST") return await this.ticket(request, id);
      return json(404, { error: "not-found" });
    } catch (error) {
      this.log(`${request.method} ${pathname} failed: ${String(error)}`);
      return json(500, { error: "failed" });
    }
  }

  /**
   * The cron trigger: brings issues up to date (their count, the notes waiting), then opens the
   * issues that wait, then forgets what's old. Two lists, so issues waiting for the next day can't
   * keep the open ones from being brought up to date.
   */
  async cron(): Promise<void> {
    let reachable = true;
    let updated = 0;
    for (const name of (await this.store.list({ prefix: "behind:", limit: 5 * PER_RUN })).keys()) {
      const result = await this.update(lastPart(name));
      if (result === "unreachable") reachable = false;
      if (!reachable || (result === "updated" && ++updated >= PER_RUN)) break;
    }
    if (reachable)
      for (const name of (await this.store.list({ prefix: "unopened:", limit: PER_RUN })).keys()) if ((await this.open(lastPart(name))) !== "open") break;
    await this.forgetOld();
  }

  // ------------------------------------------------------------------------------------ a report

  private async receive(request: Request, address: string): Promise<Response> {
    const now = this.now();
    const day = dayOf(now);
    const from = await this.addressKey(address, day);
    const allowed = await this.lock.run(
      async () => (await this.take(day, `address:${from}`, this.limits.reportsPerAddress)) && (await this.take(day, "reports", this.limits.reportsPerDay)),
    );
    if (!allowed) return slowDown(now);

    const text = await readLimited(request, this.limits.maxBody);
    if (text === null) return json(413, { error: "too-big" });
    const raw = parseJson(text);
    const parsed = Envelope.safeParse(raw);
    if (!parsed.success) return json(400, { error: "invalid" });
    const envelope = parsed.data;
    const found = personalInBody(raw, envelope);
    if (found.length) return json(422, { error: "personal", found });

    const { problems } = envelope.report;
    if (!problems.length && !(await this.lock.run(() => this.take(day, "bugs", this.limits.bugsPerDay)))) return slowDown(now);
    if (!(await this.lock.run(() => this.take(day, "bytes", this.limits.bytesPerDay, text.length)))) return slowDown(now);

    const id = crypto.randomUUID();
    const noteToken = randomToken();
    const threads = await this.threadsOf(id, problems);
    const pieces = await putBody(this.store, id, text);
    await this.store.put(KEY.report(id), {
      id,
      at: now,
      threads: threads.map((thread) => thread.key),
      noteHash: await sha256(noteToken),
      notes: 0,
      pieces,
    } satisfies ReportRecord);
    await this.store.put(KEY.expiry(dayOf(now + this.limits.keepDays * DAY), id), 1);

    let duplicate = false;
    for (const [i, { key, problem }] of threads.entries()) {
      const seenBefore = await this.lock.run(() => this.attach(key, id, problem, envelope));
      if (i === 0) duplicate = seenBefore;
    }
    // Open what's new now, the first problem's first; the cron trigger opens what can't be.
    let first: Opening = "open";
    for (const [i, { key }] of threads.entries()) {
      const opening = await this.open(key);
      if (i === 0) first = opening;
      if (opening === "unreachable") break;
    }
    const thread = await this.store.get<Thread>(KEY.thread(threads[0]!.key));
    if (first === "unreachable" && !thread?.issue) return json(503, { error: "later" });
    return json(201, { id, noteToken, issue: thread?.issue ?? null, duplicate, seen: thread?.count ?? 1 });
  }

  /** Where each problem goes, once each, the first problem's first; a report without one opens its own. */
  private async threadsOf(id: string, problems: Problem[]): Promise<{ key: string; problem: Problem | null }[]> {
    if (!problems.length) return [{ key: `bug-${id}`, problem: null }];
    const threads = new Map<string, Problem>();
    for (const problem of problems) {
      const key = await signatureOf(problem);
      if (!threads.has(key)) threads.set(key, problem);
    }
    // A report can't open the day's issues all by itself: an app has a few feeds that go wrong at once, not twenty.
    return [...threads].slice(0, this.limits.issuesPerReport).map(([key, problem]) => ({ key, problem }));
  }

  /** Counts a report on its thread (a new thread waits to be opened); whether the thread was there before. Under the lock. */
  private async attach(key: string, id: string, problem: Problem | null, envelope: Envelope): Promise<boolean> {
    const now = this.now();
    const latest = { at: now, version: envelope.report.version };
    const reproduces = problem?.reproduces ?? "unknown";
    const before = await this.store.get<Thread>(KEY.thread(key));
    const note = envelope.note?.trim();
    await this.keep(
      before
        ? {
            ...before,
            count: before.count + 1,
            reports: [id, ...before.reports].slice(0, KEEP_IDS),
            reproducing: reproduces === "yes" ? id : before.reproducing,
            reproduces: before.reproduces === "yes" || reproduces === "yes" ? "yes" : reproduces,
            latest,
            // A new issue has the note in it; a later report's goes on as a comment.
            notes: note ? [...before.notes, { report: id, at: now, note }].slice(-MAX_NOTES_WAITING) : before.notes,
          }
        : {
            key,
            kind: problem ? "drift" : "bug",
            since: now,
            issue: null,
            draft: problem ? driftDraft(problem, envelope) : bugDraft(envelope),
            count: 1,
            shown: 0,
            reports: [id],
            reproducing: reproduces === "yes" ? id : null,
            reproduces,
            botStarts: false,
            latest,
            notes: [],
            touched: 0,
            nudged: 0,
          },
    );
    return before !== undefined;
  }

  /** Writes a thread, and puts it on the cron trigger's lists while there's something to do for it. Under the lock. */
  private async keep(thread: Thread): Promise<void> {
    await this.store.put(KEY.thread(thread.key), thread);
    if (thread.issue) await this.store.delete(KEY.unopened(thread));
    else await this.store.put(KEY.unopened(thread), 1);
    if (thread.issue && isBehind(thread)) await this.store.put(KEY.behind(thread.key), 1);
    else await this.store.delete(KEY.behind(thread.key));
  }

  /** Changes a thread as it is now (reports may have come while GitHub answered), under the lock. */
  private change(key: string, change: (thread: Thread) => Thread): Promise<void> {
    return this.lock.run(async () => {
      const thread = await this.store.get<Thread>(KEY.thread(key));
      if (thread) await this.keep(change(thread));
    });
  }

  private async forget(key: string): Promise<void> {
    await this.lock.run(async () => {
      const thread = await this.store.get<Thread>(KEY.thread(key));
      if (thread) await this.store.delete(KEY.unopened(thread));
      await this.store.delete(KEY.thread(key));
      await this.store.delete(KEY.behind(key));
    });
  }

  /** Opens the thread's issue if it has none, once however many reports ask at the same time. */
  private open(key: string): Promise<Opening> {
    const running = this.opening.get(key);
    if (running) return running;
    const work = this.openNow(key).finally(() => this.opening.delete(key));
    this.opening.set(key, work);
    return work;
  }

  private async openNow(key: string): Promise<Opening> {
    const day = dayOf(this.now());
    const claim = await this.lock.run(async () => {
      const thread = await this.store.get<Thread>(KEY.thread(key));
      if (!thread?.draft || thread.issue) {
        // Nothing to open: off the list, if it was still there.
        if (thread) await this.store.delete(KEY.unopened(thread));
        return "open" as const;
      }
      if (!(await this.take(day, "issues", this.limits.issuesPerDay))) return "capped" as const;
      const botStarts = thread.kind === "drift" && thread.reproduces === "yes" && (await this.take(day, "bot-starts", this.limits.botStartsPerDay));
      return { thread, draft: thread.draft, botStarts };
    });
    if (typeof claim === "string") return claim;

    const { thread, draft, botStarts } = claim;
    let issue: Issue;
    try {
      issue = await this.github.open({ title: draft.title, labels: draft.labels, body: `${header({ ...thread, botStarts })}\n\n${draft.body}` });
    } catch (error) {
      this.log(`couldn't open the issue for ${key}: ${String(error)}`);
      // Nothing was opened: the day's places go back.
      await this.lock.run(async () => {
        await this.give(day, "issues");
        if (botStarts) await this.give(day, "bot-starts");
      });
      return "unreachable";
    }
    // Reports that came while it opened are counted on the issue next time.
    await this.change(key, (now) => ({ ...now, issue, draft: null, botStarts, shown: thread.count, touched: this.now() }));
    return "open";
  }

  /** Brings an open issue up to date: its count, the notes waiting, and a word if it was closed. */
  private async update(key: string): Promise<"updated" | "skipped" | "unreachable"> {
    const thread = await this.lock.run(async () => {
      const now = await this.store.get<Thread>(KEY.thread(key));
      if (now?.issue && isBehind(now)) return now;
      await this.store.delete(KEY.behind(key));
      return null;
    });
    // A burst of reports changes the issue once, not once each.
    if (!thread?.issue || this.now() - thread.touched < this.limits.cooldown) return "skipped";

    const { number } = thread.issue;
    let nudged = thread.nudged;
    try {
      if (thread.count !== thread.shown) {
        const now = await this.github.read(number);
        await this.github.edit(number, withHeader(now.body, header(thread)));
        if (now.closedAt !== null && now.reason !== "not_planned" && thread.nudged < now.closedAt) {
          await this.github.comment(number, seenAgain(thread.count - thread.shown, thread.latest));
          nudged = this.now();
        }
      }
      if (thread.notes.length) await this.github.comment(number, notesComment(thread.notes));
    } catch (error) {
      if (error instanceof GitHubError && error.gone) {
        // The issue was deleted: the next report of this problem opens a new one.
        this.log(`issue ${number} was deleted: the next report of ${key} opens a new one`);
        await this.forget(key);
        return "updated";
      }
      this.log(`couldn't bring issue ${number} up to date: ${String(error)}`);
      return "unreachable";
    }
    const posted = new Set(thread.notes.map((one) => `${one.report}:${one.at}`));
    await this.change(key, (now) => ({
      ...now,
      shown: thread.count,
      notes: now.notes.filter((one) => !posted.has(`${one.report}:${one.at}`)),
      touched: this.now(),
      nudged,
    }));
    return "updated";
  }

  // ----------------------------------------------------------------------------- a note on a report

  private async note(request: Request, address: string, id: string): Promise<Response> {
    const now = this.now();
    const day = dayOf(now);
    const from = await this.addressKey(address, day);
    if (!(await this.lock.run(() => this.take(day, `note-address:${from}`, this.limits.notesPerAddress)))) return slowDown(now);
    const record = await this.store.get<ReportRecord>(KEY.report(id));
    if (!record) return json(404, { error: "not-found" });
    const token = bearer(request);
    if (!token || (await sha256(token)) !== record.noteHash) return json(401, { error: "unauthorized" });

    const text = await readLimited(request, 16_384);
    const parsed = NoteBody.safeParse(text === null ? undefined : parseJson(text));
    const note = parsed.success ? parsed.data.note.trim() : "";
    if (!note) return json(400, { error: "invalid" });
    const found = personalIn(note);
    if (found.length) return json(422, { error: "personal", found });

    const counted = await this.lock.run(async () => {
      const now = await this.store.get<ReportRecord>(KEY.report(id));
      if (!now || now.notes >= this.limits.notesPerReport) return false;
      await this.store.put(KEY.report(id), { ...now, notes: now.notes + 1 });
      return true;
    });
    if (!counted) return slowDown(now);

    const key = record.threads[0]!;
    const queued: QueuedNote = { report: id, at: now, note };
    const thread = await this.store.get<Thread>(KEY.thread(key));
    if (!thread) return json(404, { error: "not-found" });
    if (thread.issue) {
      try {
        await this.github.comment(thread.issue.number, notesComment([queued]));
        return json(200, { ok: true });
      } catch (error) {
        this.log(`couldn't post a note on issue ${thread.issue.number}: ${String(error)}`);
      }
    }
    // No issue yet, or GitHub didn't answer: it goes on with the cron trigger.
    await this.change(key, (now) => ({ ...now, notes: [...now.notes, queued].slice(-MAX_NOTES_WAITING) }));
    return json(200, { ok: true });
  }

  // ------------------------------------------------------------------- the maintainer and the fix bot

  /** GET /v1/reports/{id}: the body as the app sent it, for the maintainer's token, or a ticket for this report from the run it was made for. */
  private async read(request: Request, id: string): Promise<Response> {
    const token = bearer(request);
    if (!token || !((await this.isMaintainer(token)) || (await this.useTicket(token, id, request)))) return json(401, { error: "unauthorized" });
    const record = await this.store.get<ReportRecord>(KEY.report(id));
    const body = record ? await getBody(this.store, id, record.pieces) : null;
    if (body === null) return json(404, { error: "not-found" });
    return new Response(body, { status: 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
  }

  /**
   * POST /v1/reports/{id}/ticket { run }, with the maintainer's token: a ticket that reads that one
   * report, a few times in the next half hour, for the fix bot's run `run` and nobody else. The bot's
   * workflow gets one, so the job that runs Claude never holds the maintainer's token, and a ticket
   * that shows in the run's public log is no use without that run's own GitHub token.
   */
  private async ticket(request: Request, id: string): Promise<Response> {
    const token = bearer(request);
    if (!token || !(await this.isMaintainer(token))) return json(401, { error: "unauthorized" });
    const asked = parseJson((await readLimited(request, 1024)) ?? "");
    const run = asked && typeof asked === "object" && "run" in asked ? String(asked.run) : "";
    if (!/^\d{1,20}$/.test(run)) return json(400, { error: "invalid" });
    if (!(await this.store.get<ReportRecord>(KEY.report(id)))) return json(404, { error: "not-found" });
    const ticket = randomToken();
    const until = this.now() + TICKET_TIME;
    await this.store.put(KEY.ticket(await sha256(ticket)), { id, run, until, uses: 0 } satisfies Ticket);
    return json(201, { ticket, until });
  }

  private async isMaintainer(token: string): Promise<boolean> {
    return this.maintainerToken.length >= 32 && (await sha256(token)) === (await sha256(this.maintainerToken));
  }

  /** Whether `token` is a ticket for report `id`, still good, asked for by the run it was made for (its GitHub token in x-github-oidc). */
  private async useTicket(token: string, id: string, request: Request): Promise<boolean> {
    const key = KEY.ticket(await sha256(token));
    const ticket = await this.store.get<Ticket>(key);
    if (!ticket || ticket.id !== id || ticket.until <= this.now()) return false;
    // The run's own token first, so whoever only read the ticket can't use up its reads.
    const run = await actionsRun(request.headers.get("x-github-oidc") ?? "", {
      audience: new URL(request.url).origin,
      repo: this.repo,
      workflow: BOT_WORKFLOW,
      keys: this.signingKeys,
      now: this.now(),
    });
    if (run !== ticket.run) return false;
    return this.lock.run(async () => {
      const now = await this.store.get<Ticket>(key);
      if (!now || now.uses >= TICKET_USES) return false;
      await this.store.put(key, { ...now, uses: now.uses + 1 });
      return true;
    });
  }

  // ------------------------------------------------------------------------------------- the caps

  /** Counts `amount` more of `name` today if that stays within `limit`; whether it did. Under the lock. */
  private async take(day: string, name: string, limit: number, amount = 1): Promise<boolean> {
    const key = KEY.count(day, name);
    const count = (await this.store.get<number>(key)) ?? 0;
    if (count + amount > limit) return false;
    await this.store.put(key, count + amount);
    return true;
  }

  /** Gives back one of `name` today. Under the lock. */
  private async give(day: string, name: string): Promise<void> {
    const key = KEY.count(day, name);
    const count = (await this.store.get<number>(key)) ?? 0;
    if (count > 0) await this.store.put(key, count - 1);
  }

  /** Where a request came from, unreadable: hashed with the day and a secret, and counted for that day only. */
  private async addressKey(address: string, day: string): Promise<string> {
    return (await sha256(`${this.maintainerToken}:${day}:${address}`)).slice(0, 16);
  }

  /** Counts from before yesterday, reports past their keeping time, problems that waited too long for their issue, old tickets. */
  private async forgetOld(): Promise<void> {
    const now = this.now();
    const yesterday = dayOf(now - DAY);
    for (const key of (await this.store.list({ prefix: "count:", limit: 200 })).keys()) {
      if (key.split(":")[1]! >= yesterday) break;
      await this.store.delete(key);
    }
    const today = dayOf(now);
    for (const key of (await this.store.list({ prefix: "expiry:", limit: 50 })).keys()) {
      const [, day, id] = key.split(":");
      if (day! > today) break;
      const record = await this.store.get<ReportRecord>(KEY.report(id!));
      if (record) await deleteBody(this.store, record.id, record.pieces);
      await this.store.delete(KEY.report(id!));
      await this.store.delete(key);
    }
    // What spam opened past the day's issues stops waiting; its reports stay until they expire.
    for (const key of (await this.store.list({ prefix: "unopened:", limit: 50 })).keys()) {
      if (Number(key.split(":")[1]) > now - this.limits.waitDays * DAY) break;
      this.log(`${lastPart(key)} waited ${this.limits.waitDays} days for its issue to open: it's dropped`);
      await this.forget(lastPart(key));
    }
    for (const [key, ticket] of await this.store.list<Ticket>({ prefix: "ticket:", limit: 50 })) if (ticket.until <= now) await this.store.delete(key);
  }
}
