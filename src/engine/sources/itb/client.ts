// Reads ITB's public pages: no sign-in and no cookies, one request at a time,
// at least `gapMs` apart, in the site's shared line when it has one (SIX's
// catalog shares six.itb.ac.id with the signed-in SIX source). A dropped
// connection or a busy server is Offline; any other refusal is a PageError
// the caller decides about.
import type { Clock } from "../../clock";
import { EngineError } from "../../errors";
import { Pace } from "../../http/pace";
import { type HttpResponse, NetworkError, type Transport } from "../../http/transport";

export const TIMEOUT_MS = 20_000;
/** How long a site that answered 429 is left alone. */
const RATE_LIMIT_PAUSE_MS = 15 * 60_000;

/** The server answered with an error status. */
export class PageError extends EngineError {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(status === 429 || status >= 500 ? "Offline" : "Failed", message);
  }
}

export class PublicClient {
  constructor(
    private readonly transport: Transport,
    private readonly clock: Clock,
    private readonly userAgent: string,
    /** "SIX", "ITB's calendar": used in messages. */
    private readonly site: string,
    private readonly gapMs = 0,
    private readonly pace: Pace = new Pace(clock),
  ) {}

  /** The text of a page; requests wait their turn and keep the gap. */
  text(url: string, accept = "text/html"): Promise<string> {
    return this.pace.turn(() => this.fetch(url, accept));
  }

  private async fetch(url: string, accept: string): Promise<string> {
    if (this.pace.paused) throw new PageError(429, `${this.site} asked to be left alone for now`);
    await this.pace.gap(this.gapMs);
    let response: HttpResponse;
    try {
      response = await this.transport.request({ method: "GET", url, headers: { accept, "user-agent": this.userAgent }, timeoutMs: TIMEOUT_MS });
    } catch (error) {
      if (error instanceof NetworkError)
        throw new EngineError("Offline", error.reason === "timeout" ? `${this.site} didn't answer in time` : `${this.site} is unreachable`, true);
      throw error;
    } finally {
      // The gap counts from the end of a request, so a slow answer never shortens it.
      this.pace.touch();
    }
    if (response.status === 429) this.pace.pause(this.clock.now() + RATE_LIMIT_PAUSE_MS);
    if (response.status >= 400) throw new PageError(response.status, `${this.site} answered ${response.status} for ${new URL(url).pathname}`);
    return response.body;
  }
}
