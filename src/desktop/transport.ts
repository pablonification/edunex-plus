// The production network: Chromium's stack through a dedicated in-memory
// Electron session, so the system proxy and certificate store apply and no
// cookie or cache from these calls survives the app.
import type { Session } from "electron";
import { type HttpRequest, type HttpResponse, NetworkError, type Transport } from "../engine/http/transport";

const UNREACHABLE =
  /ERR_(INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|NAME_RESOLUTION_FAILED|NETWORK_CHANGED|NETWORK_IO_SUSPENDED|ADDRESS_UNREACHABLE|CONNECTION_REFUSED|CONNECTION_RESET|CONNECTION_CLOSED|CONNECTION_TIMED_OUT|TIMED_OUT|PROXY_CONNECTION_FAILED)/;

const DEFAULT_TIMEOUT = 15_000;

export function electronTransport(session: Session): Transport {
  return {
    async request(request: HttpRequest): Promise<HttpResponse> {
      const limit = request.timeoutMs ?? DEFAULT_TIMEOUT;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), limit);
      try {
        const response = await session.fetch(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.body,
          redirect: request.redirect ?? "follow",
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
        const message = error instanceof Error ? error.message : String(error);
        throw new NetworkError(UNREACHABLE.test(message) ? "offline" : "failed", message);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
