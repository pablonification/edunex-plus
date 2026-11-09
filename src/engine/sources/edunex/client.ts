// Talks to Edunex's API (api-edunex.cognisia.id). Every answer is checked
// against a schema: a shape the app doesn't know is "Edunex changed
// something", never an empty screen.
import type { z } from "zod";
import { AnswerError, EngineError, isEngineError } from "../../errors";
import type { Pace } from "../../http/pace";
import { type Answer, type HttpResponse, NetworkError, type Transport } from "../../http/transport";
import { type FeedRead, noting } from "../../report/kept-pages";
import type { SourceContext } from "../source";

export const EDUNEX_API = "https://api-edunex.cognisia.id";
export const TIMEOUT_MS = 15_000;

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

  async get<S extends z.ZodType>(path: string, query: Record<string, string | number>, schema: S): Promise<z.infer<S>> {
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
      response = await (this.pace ? this.pace.turn(ask, this.first ? "first" : "normal") : ask());
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
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    throw new EngineError("VendorChanged", `Edunex sent something other than data for ${path}`);
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new EngineError("VendorChanged", `${path}: ${issue?.path.join(".") || "(root)"} ${issue?.message ?? "unexpected"}`);
  }
  return parsed.data;
}
