// A pretend report relay (ADR 0014): the maintainer's service a problem report is posted to with
// one click, or by itself when the Student agreed. It answers as its API v1 says (relay/ builds
// the real one): an id, a token for the Student's note, the public issue it filed, whether it had
// that problem already. It refuses what the real one refuses (a body too big, something that looks
// personal), can be told to be busy or to file later, and keeps everything it got. Nothing goes
// anywhere real.
import { type HttpRequest, type HttpResponse, NetworkError } from "../../src/engine/http/transport";
import { personalHits } from "../kit/privacy-rules";

/** The pretend relay's address, which tests give the engine (the app ships with none). */
export const PRETEND_RELAY = "https://relay.pretend.test";

const MAX_BODY = 3 * 1024 * 1024;
const REPO = "https://github.com/pablonification/edunex-plus/issues";

/** A report as the relay received it. */
export interface Received {
  id: string;
  envelope: {
    envelope: number;
    report: { format: number; problems: { feed: string; kind: string; check: string }[]; log?: unknown[] } & Record<string, unknown>;
    os: string;
    lang: string;
    how: string;
    note?: string;
  };
  userAgent: string | undefined;
  issue: number | null;
  token: string;
  notes: string[];
}

export class PretendRelay {
  /** Every report it took, in order (one it was told to file later too). */
  readonly reports: Received[] = [];
  /** Every request, with its path and answer. */
  readonly requests: { path: string; status: number | "no answer" }[] = [];
  /** How it answers what comes next: as itself, not at all, busy (429), "stored, filed later" (503), or as a deploy gone wrong (404). */
  answer: "ok" | "offline" | "busy" | "later" | "missing" = "ok";
  private issues = 300;
  private readonly filed = new Map<string, number>();
  private held: Promise<void> | null = null;

  /** Its answers wait until the function this returns is called: a post still under way meanwhile. */
  hold(): () => void {
    let release = () => {};
    this.held = new Promise((done) => {
      release = done;
    });
    return () => {
      this.held = null;
      release();
    };
  }

  async handle(request: HttpRequest, url: URL): Promise<HttpResponse> {
    if (this.held) await this.held;
    if (this.answer === "missing") {
      this.requests.push({ path: url.pathname, status: 404 });
      return { status: 404, headers: { "content-type": "text/html" }, body: "<h1>Not Found</h1>", url: url.toString() };
    }
    if (this.answer === "offline") {
      this.requests.push({ path: url.pathname, status: "no answer" });
      throw new NetworkError("offline", `${url.host} is unreachable`);
    }
    const reply = (status: number, body: unknown, headers: Record<string, string> = {}) => {
      this.requests.push({ path: url.pathname, status });
      return { status, headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), url: url.toString() };
    };
    if (request.method === "GET" && url.pathname === "/v1/health") return reply(200, { ok: true });
    const text = typeof request.body === "string" ? request.body : new TextDecoder().decode(request.body ?? new Uint8Array());
    if (request.method === "POST" && url.pathname === "/v1/reports") {
      if (Buffer.byteLength(text) > MAX_BODY) return reply(413, { error: "too-big" });
      let envelope: Received["envelope"];
      try {
        envelope = JSON.parse(text);
      } catch {
        return reply(400, { error: "invalid" });
      }
      if (!isEnvelope(envelope)) return reply(400, { error: "invalid" });
      const found = personalHits(JSON.stringify(envelope));
      if (found.length) return reply(422, { error: "personal", found });
      if (this.answer === "busy") return reply(429, { error: "slow-down" }, { "retry-after": "120" });
      const id = `r${this.reports.length + 1}`;
      const token = `note-${id}`;
      if (this.answer === "later") {
        this.reports.push({ id, envelope, userAgent: request.headers?.["user-agent"], issue: null, token, notes: [] });
        return reply(503, { error: "later" });
      }
      // One issue per problem: the same feed and check again is a duplicate, counted on the first one's issue.
      const first = envelope.report.problems[0];
      const key = first ? `${first.feed}|${first.kind}|${first.check}` : `bug|${id}`;
      const duplicate = this.filed.has(key);
      const issue = this.filed.get(key) ?? ++this.issues;
      this.filed.set(key, issue);
      this.reports.push({ id, envelope, userAgent: request.headers?.["user-agent"], issue, token, notes: [] });
      const seen = this.reports.filter((report) => report.issue === issue).length;
      return reply(201, { id, noteToken: token, issue: { number: issue, url: `${REPO}/${issue}` }, duplicate, seen });
    }
    const note = /^\/v1\/reports\/([^/]+)\/note$/.exec(url.pathname);
    if (request.method === "POST" && note) {
      const report = this.reports.find((one) => one.id === decodeURIComponent(note[1]!));
      if (!report) return reply(404, { error: "not-found" });
      if (request.headers?.authorization !== `Bearer ${report.token}`) return reply(401, { error: "unauthorized" });
      if (this.answer === "busy") return reply(429, { error: "slow-down" }, { "retry-after": "60" });
      let body: { note?: unknown };
      try {
        body = JSON.parse(text);
      } catch {
        return reply(400, { error: "invalid" });
      }
      if (typeof body.note !== "string" || !body.note.trim() || body.note.length > 1000) return reply(400, { error: "invalid" });
      const found = personalHits(body.note);
      if (found.length) return reply(422, { error: "personal", found });
      report.notes.push(body.note);
      return reply(200, { ok: true });
    }
    return reply(404, { error: "not-found" });
  }
}

function isEnvelope(value: unknown): value is Received["envelope"] {
  const envelope = value as Partial<Received["envelope"]> | null;
  return (
    !!envelope &&
    envelope.envelope === 1 &&
    !!envelope.report &&
    (envelope.report.format === 1 || envelope.report.format === 2) &&
    Array.isArray(envelope.report.problems) &&
    typeof envelope.os === "string" &&
    (envelope.lang === "id" || envelope.lang === "en") &&
    (envelope.how === "auto" || envelope.how === "manual") &&
    (envelope.note === undefined || (typeof envelope.note === "string" && envelope.note.length <= 1000))
  );
}
