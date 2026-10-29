// The maintainer's report relay (ADR 0014): where "Kirim", and the app by itself when the Student
// said so, posts a problem report, and then the Student's note on it. The app's side of its API v1
// (the server is in relay/). Requests go out through the engine's own door to the network, with the
// app's User-Agent, as every other request the app makes.
import { z } from "zod";
import type { Lang, ProblemReport } from "../../core/models";
import { ReportIssue } from "../../core/models";
import { NetworkError, type Transport } from "../http/transport";
import { utf8Length } from "../platform/bytes";

/** What a post carries: the report scrubbed already, the computer's system, the Student's language, how it went, their note. */
export interface Envelope {
  envelope: 1;
  report: ProblemReport;
  os: string;
  lang: Lang;
  how: "auto" | "manual";
  note?: string;
}

export interface Relay {
  /** Its address, https, without a trailing slash. */
  base: string;
  transport: Transport;
  userAgent: string;
}

/** The most the relay takes in one post. */
const MAX_BODY = 3 * 1024 * 1024;
const TIMEOUT_MS = 30_000;

/** How a post went. */
export type Posted =
  /** Filed: its id there, the token for the Student's story, its public issue (if filed already), and whether the problem was there before. */
  | { kind: "filed"; id: string; noteToken: string; issue: ReportIssue | null; duplicate: boolean }
  /** The relay kept it and files it itself later. */
  | { kind: "stored" }
  /** Not taken, and posting it again won't change that: odd, too big, or something in it looks personal (the relay's own check). */
  | { kind: "refused"; reason: "invalid" | "too-big" | "personal"; found: string[] }
  /** Not now: no answer at all (offline), or the relay asked to wait. `after`: how long, when it said. */
  | { kind: "later"; offline: boolean; after: number | null };

const Filed = z.object({
  id: z.string().min(1).max(100),
  noteToken: z.string().min(1).max(500),
  issue: ReportIssue.nullable(),
  duplicate: z.boolean(),
  seen: z.number().int(),
});
const Refusal = z.object({ error: z.string(), found: z.array(z.string()).optional() });

/** The relay's address as the app may use it: https, nothing after the host and path. Null: no relay. */
export function relayBase(address: string): string | null {
  try {
    const url = new URL(address);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
}

export async function postReport(relay: Relay, envelope: Envelope): Promise<Posted> {
  const body = JSON.stringify(envelope);
  if (utf8Length(body) > MAX_BODY) return { kind: "refused", reason: "too-big", found: [] };
  const answer = await post(relay, "/v1/reports", body);
  if (!answer) return { kind: "later", offline: true, after: null };
  if (answer.status === 201) {
    const filed = Filed.safeParse(json(answer.body));
    return filed.success
      ? { kind: "filed", id: filed.data.id, noteToken: filed.data.noteToken, issue: filed.data.issue, duplicate: filed.data.duplicate }
      : { kind: "stored" };
  }
  return otherwise(answer);
}

/** How a note went: added, refused (personal, too long), gone (no such report, or not this token's), or not now. */
type NoteAnswer = { kind: "added" } | Exclude<Posted, { kind: "filed" | "stored" }> | { kind: "gone" };

export async function postNote(relay: Relay, id: string, token: string, note: string): Promise<NoteAnswer> {
  const answer = await post(relay, `/v1/reports/${encodeURIComponent(id)}/note`, JSON.stringify({ note }), token);
  if (!answer) return { kind: "later", offline: true, after: null };
  if (answer.status === 200) return { kind: "added" };
  if (answer.status === 401 || answer.status === 404) return { kind: "gone" };
  const other = otherwise(answer);
  return other.kind === "stored" ? { kind: "later", offline: false, after: null } : other;
}

/**
 * Any answer but a success. Refused for good only for what the relay says is wrong with the report
 * itself (odd, too big, something personal); any other answer (a 404 from a deploy gone wrong, a
 * 5xx) means try again later.
 */
function otherwise(answer: { status: number; body: string; retryAfter: string | undefined }): Exclude<Posted, { kind: "filed" }> {
  const refusal = Refusal.safeParse(json(answer.body));
  const found = refusal.success ? (refusal.data.found ?? []) : [];
  if (answer.status === 503 && refusal.success && refusal.data.error === "later") return { kind: "stored" };
  if (answer.status === 400) return { kind: "refused", reason: "invalid", found };
  if (answer.status === 413) return { kind: "refused", reason: "too-big", found };
  if (answer.status === 422) return { kind: "refused", reason: "personal", found };
  const seconds = Number(answer.retryAfter);
  return { kind: "later", offline: false, after: answer.status === 429 && Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null };
}

async function post(relay: Relay, path: string, body: string, token?: string) {
  try {
    const response = await relay.transport.request({
      method: "POST",
      url: `${relay.base}${path}`,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "user-agent": relay.userAgent,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body,
      timeoutMs: TIMEOUT_MS,
    });
    return { status: response.status, body: response.body, retryAfter: response.headers["retry-after"] };
  } catch (error) {
    if (error instanceof NetworkError) return null;
    throw error;
  }
}

function json(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
