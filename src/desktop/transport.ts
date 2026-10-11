// The production network: Chromium's stack through a dedicated in-memory
// Electron session, so the system proxy and certificate store apply and no
// cookie or cache from these calls survives the app.
import { type IncomingMessage, net, type Session } from "electron";
import { type HttpRequest, type HttpResponse, NetworkError, type Transport } from "../engine/http/transport";

const UNREACHABLE =
  /ERR_(INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|NAME_RESOLUTION_FAILED|NETWORK_CHANGED|NETWORK_IO_SUSPENDED|ADDRESS_UNREACHABLE|CONNECTION_REFUSED|CONNECTION_RESET|CONNECTION_CLOSED|CONNECTION_TIMED_OUT|TIMED_OUT|PROXY_CONNECTION_FAILED)/;

const DEFAULT_TIMEOUT = 15_000;

const failure = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return new NetworkError(UNREACHABLE.test(message) ? "offline" : "failed", message);
};

/**
 * Credentials are always "omit": the session's own cookie jar is never sent
 * or filled. A source that needs a cookie (SIX) sends it as a Cookie header,
 * which Chromium passes on as it is for requests from the main process.
 */
export function electronTransport(session: Session): Transport {
  return {
    request: (request) => (request.redirect === "manual" ? withoutFollowing(session, request) : viaFetch(session, request)),
  };
}

async function viaFetch(session: Session, request: HttpRequest): Promise<HttpResponse> {
  const limit = request.timeoutMs ?? DEFAULT_TIMEOUT;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), limit);
  try {
    const response = await session.fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: "follow",
      signal: controller.signal,
      credentials: "omit",
      bypassCustomProtocolHandlers: true,
    });
    // The time limit covers reading the body too.
    const body = await response.text();
    const headers: Record<string, string> = {};
    response.headers.forEach((value, name) => {
      headers[name.toLowerCase()] = value;
    });
    return { status: response.status, headers, body, url: response.url || request.url };
  } catch (error) {
    if (controller.signal.aborted) throw new NetworkError("timeout", `No answer within ${limit / 1000} s`);
    throw failure(error);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * A redirect comes back as it is, with its Location (SIX ends a session by
 * redirecting to /login). Electron's fetch can't do that: with redirect
 * "manual" it cancels the request instead, because its ClientRequest drops a
 * redirect unless followRedirect() is called synchronously in its 'redirect'
 * event. So these requests use ClientRequest directly and stop at the redirect.
 */
function withoutFollowing(session: Session, request: HttpRequest): Promise<HttpResponse> {
  const limit = request.timeoutMs ?? DEFAULT_TIMEOUT;
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (outcome: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      outcome();
    };
    const client = net.request({
      method: request.method,
      url: request.url,
      session,
      redirect: "manual",
      credentials: "omit",
      bypassCustomProtocolHandlers: true,
    });
    const timer = setTimeout(
      () =>
        settle(() => {
          client.abort();
          reject(new NetworkError("timeout", `No answer within ${limit / 1000} s`));
        }),
      limit,
    );
    for (const [name, value] of Object.entries(request.headers ?? {})) client.setHeader(name, value);
    client.on("redirect", (status, _method, location, headers) => {
      // Not following it ends the request here; the "Redirect was cancelled" error that follows is expected.
      settle(() => resolve({ status, headers: { ...flatten(headers), location }, body: "", url: request.url }));
    });
    client.on("response", (response: IncomingMessage) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () =>
        settle(() => resolve({ status: response.statusCode, headers: flatten(response.headers), body: Buffer.concat(chunks).toString("utf8"), url: request.url })),
      );
      response.on("error", (error: Error) => settle(() => reject(failure(error))));
    });
    client.on("error", (error) => settle(() => reject(failure(error))));
    if (request.body !== undefined) client.write(typeof request.body === "string" ? request.body : Buffer.from(request.body));
    client.end();
  });
}

function flatten(headers: Record<string, string | string[]>): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), Array.isArray(value) ? value.join(", ") : value]));
}
