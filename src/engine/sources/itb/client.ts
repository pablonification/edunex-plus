// Reads ITB's public pages: no sign-in and no cookies, one request at a time,
// at least `gapMs` apart. A dropped connection or a busy server is Offline;
// any other refusal is a PageError the caller decides about.
import { type Clock, sleep } from "../../clock";
import { EngineError } from "../../errors";
import { NetworkError, type Transport } from "../../http/transport";

export const TIMEOUT_MS = 20_000;

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
  private lastAt = Number.NEGATIVE_INFINITY;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly transport: Transport,
    private readonly clock: Clock,
    private readonly userAgent: string,
    /** "SIX", "ITB's calendar": used in messages. */
    private readonly site: string,
    private readonly gapMs = 0,
  ) {}

  /** The text of a page; requests wait their turn and keep the gap. */
  text(url: string, accept = "text/html"): Promise<string> {
    const run = this.queue.then(() => this.fetch(url, accept));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async fetch(url: string, accept: string): Promise<string> {
    const wait = this.lastAt + this.gapMs - this.clock.now();
    if (wait > 0) await sleep(this.clock, wait);
    this.lastAt = this.clock.now();
    let response;
    try {
      response = await this.transport.request({ method: "GET", url, headers: { accept, "user-agent": this.userAgent }, timeoutMs: TIMEOUT_MS });
    } catch (error) {
      if (error instanceof NetworkError) throw new EngineError("Offline", error.reason === "timeout" ? `${this.site} didn't answer in time` : `${this.site} is unreachable`);
      throw error;
    } finally {
      // The gap counts from the end of a request, so a slow answer never shortens it.
      this.lastAt = this.clock.now();
    }
    if (response.status >= 400) throw new PageError(response.status, `${this.site} answered ${response.status} for ${new URL(url).pathname}`);
    return response.body;
  }
}
