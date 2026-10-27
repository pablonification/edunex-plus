// The engine's only door to the network. Production plugs in Electron's
// network stack; tests plug in the pretend Edunex and SIX (test/pretend), so
// the whole engine runs against real recorded responses.

export type HttpMethod = "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE";

/** An answer as its caller checks it: where it came from (its path), its status, its body. */
export interface Answer {
  path: string;
  status: number;
  body: string;
}

/** How a caller checks an answer: throws an EngineError when it doesn't fit. */
export type AnswerCheck = (answer: Answer) => unknown;

export interface HttpRequest {
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  body?: string | Uint8Array;
  /** "manual" returns redirects as-is (SIX signals an ended session by redirecting to /login). */
  redirect?: "follow" | "manual";
  /** Give up after this long; the engine always sets one. */
  timeoutMs?: number;
  /**
   * How the caller checks the answer: throws an EngineError when it doesn't fit (an Edunex answer
   * against its schema). The network ignores it; the engine keeps it with the page behind a read
   * that went wrong, so a report checks the scrubbed answer the same way (src/engine/report).
   */
  check?: AnswerCheck;
}

export interface HttpResponse {
  status: number;
  /** Header names in lower case. */
  headers: Record<string, string>;
  body: string;
  /** The final URL, after any followed redirects. */
  url: string;
}

export interface Transport {
  request(request: HttpRequest): Promise<HttpResponse>;
}

/** The request never got an answer: offline, timed out, or the connection broke. */
export class NetworkError extends Error {
  constructor(
    readonly reason: "offline" | "timeout" | "failed",
    message: string,
  ) {
    super(message);
    this.name = "NetworkError";
  }
}
