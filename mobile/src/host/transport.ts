// The engine's door to the network on the phone: expo/fetch on the phone's own HTTP stack (Android's OkHttp, the
// iPhone's URLSession; the name `androidTransport` is from before the iPhone build).
// It works like the desktop's (src/desktop/transport.ts): no cookie jar (`credentials:
// "omit"`, so the only cookie sent is SIX's, as the explicit Cookie header), redirects
// returned as they are when the engine asks ("manual": SIX's redirect to /login is how an
// ended session shows), a time limit on every request, and errors as NetworkError.
import { fetch } from "expo/fetch";
import { type HttpRequest, type HttpResponse, NetworkError, type Transport } from "../../../src/engine/http/transport";
import { guardedTransport } from "./guard";
import { R3_GUARD } from "./version";

const DEFAULT_TIMEOUT = 15_000;

const androidTransport: Transport = {
  async request(request: HttpRequest): Promise<HttpResponse> {
    const limit = request.timeoutMs ?? DEFAULT_TIMEOUT;
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, limit);
    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body as BodyInit | undefined,
        credentials: "omit",
        redirect: request.redirect ?? "follow",
        signal: controller.signal,
      });
      const headers: Record<string, string> = {};
      response.headers.forEach((value, name) => {
        headers[name.toLowerCase()] = value;
      });
      // A redirect the engine asked to see comes back as it is, as on the desktop: its Location, no body.
      if (request.redirect === "manual" && response.status >= 300 && response.status < 400) {
        return { status: response.status, headers, body: "", url: request.url };
      }
      const body = await response.text();
      return { status: response.status, headers, body, url: response.url || request.url };
    } catch (error) {
      if (timedOut) throw new NetworkError("timeout", `No answer within ${limit / 1000} s`);
      const message = error instanceof Error ? error.message : String(error);
      // Android says UnknownHostException or "Unable to resolve host" without a connection. An iPhone says it in the
      // phone's language, so it may read as "failed" here: the engine says both the same way (no answer came).
      const offline = /resolve host|UnknownHost|network|ENOTFOUND|Failed to connect|connection/i.test(message);
      throw new NetworkError(offline ? "offline" : "failed", `${hostOf(request.url)}: ${message}`);
    } finally {
      clearTimeout(timer);
    }
  },
};

/** The engine's network; a QA build's reads only (./guard.ts). */
export const phoneTransport: Transport = R3_GUARD ? guardedTransport(androidTransport) : androidTransport;

const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};
