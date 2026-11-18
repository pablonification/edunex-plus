// Talks to Edunex's API (api-edunex.cognisia.id). Every answer is checked
// against a schema: a shape the app doesn't know is "Edunex changed
// something", never an empty screen.
import type { z } from "zod";
import { AnswerError, EngineError, isEngineError } from "../../errors";
import { awayTo, refreshesAway } from "../../http/network-sign-in";
import type { Pace, Place } from "../../http/pace";
import { type Answer, type HttpResponse, NetworkError, type Transport } from "../../http/transport";
import { type FeedRead, noting } from "../../report/kept-pages";
import type { SourceContext } from "../source";

export const EDUNEX_API = "https://api-edunex.cognisia.id";
export const TIMEOUT_MS = 15_000;
/**
 * An answer that came empty, or stopped partway (#384): a connection that dropped, not Edunex changing its data. Taken as
 * a timeout is ("unreachable"): Edunex's next whole answer ends it, and a background feed's tries again quietly.
 */
const cutShort = (path: string, empty: boolean) => new EngineError("Offline", `Edunex's answer for ${path} came ${empty ? "empty" : "cut short"}`, true);

/** Edunex's line: every request to its API, the feeds' and the Student's, two at a time (../../http/pace.ts). */
export const edunexLine = (context: Pick<SourceContext, "pace">) => context.pace(new URL(EDUNEX_API).host);

export class EdunexClient {
  constructor(
    private readonly transport: Transport,
    private readonly token: string,
    private readonly userAgent: string,
    /** Edunex's line (2 at once), shared by every feed and action; none in a test that reads one answer. */
    private readonly pace?: Pace,
    /** Its requests go before the feeds' waiting ones: the Student is waiting on them (Pace.turn). */
    private readonly first = false,
  ) {}

  /** This client for one feed run: its answers are noted for that run's report (FeedSpec.run). */
  for(read: FeedRead): EdunexClient {
    return new EdunexClient(noting(this.transport, read), this.token, this.userAgent, this.pace, this.first);
  }

  /** `place`: where a feed's request waits in Edunex's line (Pace.turn); the Student's go first whatever it says. */
  async get<S extends z.ZodType>(path: string, query: Record<string, string | number>, schema: S, place: Place = "normal"): Promise<z.infer<S>> {
    const url = new URL(path, EDUNEX_API);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value));
    const check = (answer: Answer) => read(answer, schema);
    let response: HttpResponse;
    const ask = () =>
      this.transport.request({
        method: "GET",
        url: url.toString(),
        headers: { authorization: `Bearer ${this.token}`, accept: "application/json", "user-agent": this.userAgent },
        timeoutMs: TIMEOUT_MS,
        check,
      });
    try {
      response = await (this.pace ? this.pace.turn(ask, this.first ? "first" : place) : ask());
    } catch (error) {
      if (error instanceof NetworkError) {
        const offline = new EngineError("Offline", error.reason === "timeout" ? "Edunex didn't answer in time" : "Edunex is unreachable", true);
        this.pace?.giveUp(offline);
        throw offline;
      }
      throw error;
    }
    try {
      return check({ path, status: response.status, body: response.body });
    } catch (error) {
      // Not data, because the network's own sign-in answered for Edunex (#387): a page that sends the browser there, or
      // a redirect there the network stack followed. No connection yet, not Edunex changing. Only for an answer that
      // isn't JSON at all: a lecturer's text inside Edunex's data is never taken for one.
      const page = isEngineError(error, "VendorChanged") && !/^\s*[[{]/.test(response.body);
      const gate = page ? (refreshesAway(response.body, url.toString()) ?? awayTo(response.url, url.toString())) : null;
      if (gate) throw new EngineError("Offline", `The network's sign-in (${gate}) answered for Edunex`, true);
      // The answer goes with its error: the message names the path, not which course's list it was.
      throw isEngineError(error) ? new AnswerError(error, { url: url.toString(), status: response.status, body: response.body, check }) : error;
    }
  }
}

/** An answer as the app takes it: by its status, then its body against `schema`. An EngineError when either doesn't fit. */
export function read<S extends z.ZodType>({ path, status, body }: Answer, schema: S): z.infer<S> {
  if (status === 401) throw new EngineError("Unauthorized", `Edunex refused ${path}`);
  if (status === 429 || status >= 500) throw new EngineError("Offline", `Edunex answered ${status}`);
  if (status >= 400) throw new EngineError("Failed", `Edunex answered ${status} for ${path}`);
  // Nothing at all, or data that stops partway: a connection that dropped cut the answer short (#384), not Edunex
  // changing its data.
  if (!body.trim()) throw cutShort(path, true);
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    if (stopsPartway(body)) throw cutShort(path, false);
    throw new EngineError("VendorChanged", `Edunex sent something other than data for ${path}`);
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new EngineError("VendorChanged", `${path}: ${issue?.path.join(".") || "(root)"} ${issue?.message ?? "unexpected"}`);
  }
  return parsed.data;
}

/** JSON that opens an object or a list and stops before closing it (or inside a string): the rest never came. */
function stopsPartway(body: string): boolean {
  const text = body.trim();
  if (text[0] !== "{" && text[0] !== "[") return false;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (const char of text) {
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
    } else if (char === '"') inString = true;
    else if (char === "{" || char === "[") depth += 1;
    else if (char === "}" || char === "]") depth -= 1;
  }
  return inString || depth > 0;
}
