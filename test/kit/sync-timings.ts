// How long one sync takes, request by request: the real engine run once, as the phone starts it, over any
// Transport (the real Edunex, SIX and ITB through scripts/record-sync-timings.mjs; the pretend ones in tests).
// What it writes holds no page, id or name: each request's host, method, path with every segment that has a
// number in it as ":id" and no query, its status, how long it took and when it started; and when each dataset
// was first read fresh. The pretend world plays such a file back as its network (test/pretend/network.ts).
//
// A sync only reads. The recorder's transport refuses anything but GET and HEAD, so a bug can never write to
// Edunex or SIX for the Student: such a request is logged (`refused`) and fails like a dropped connection.

import { AppLog } from "../../src/engine/app-log";
import type { Clock } from "../../src/engine/clock";
import { createEngine } from "../../src/engine/engine";
import { type HttpRequest, type HttpResponse, NetworkError, type Transport } from "../../src/engine/http/transport";
import { MemoryStorage, MemoryVault } from "../pretend/memory";
import { pathPattern, type SyncTimings, type TimedRequest } from "../pretend/network";

export type { SyncTimings, TimedRequest };

/** SIX's public course catalog (itb.catalog): read in the background for minutes, so a sync isn't waited on for it. */
const isCatalog = (url: URL) => url.host === "six.itb.ac.id" && url.pathname.startsWith("/pub/");

const READS = new Set(["GET", "HEAD"]);

/**
 * `inner` with every request timed and anything that would write refused. `onAnswer` hears each one as
 * it ends; `inFlight` counts the Student's requests (the catalog's left out) still waiting for an answer.
 */
export function recordingTransport(inner: Transport, clock: Clock, startedAt: () => number) {
  const requests: TimedRequest[] = [];
  const refused: SyncTimings["refused"] = [];
  let inFlight = 0;
  let lastActivity = clock.now();
  const transport: Transport = {
    async request(request: HttpRequest): Promise<HttpResponse> {
      const url = new URL(request.url);
      const pattern = pathPattern(request.url);
      if (!READS.has(request.method)) {
        refused.push({ host: url.host, method: request.method, pathPattern: pattern });
        console.error(`[sync-timings] refused ${request.method} ${url.host}${pattern}: a sync only reads`);
        throw new NetworkError("failed", "The timing recorder only lets reads through");
      }
      const begin = clock.now();
      const counted = !isCatalog(url);
      if (counted) {
        inFlight++;
        lastActivity = begin;
      }
      const record = (status: TimedRequest["status"]) => {
        const end = clock.now();
        requests.push({ host: url.host, method: request.method, pathPattern: pattern, status, ms: end - begin, startedAtMs: begin - startedAt() });
        if (counted) {
          inFlight--;
          lastActivity = end;
        }
      };
      try {
        const response = await inner.request(request);
        record(response.status);
        return response;
      } catch (error) {
        record("network-error");
        throw error;
      }
    },
  };
  return {
    transport,
    requests,
    refused,
    /** No Student request waiting, and none for `ms`. */
    quietFor: (ms: number) => inFlight === 0 && clock.now() - lastActivity >= ms,
  };
}

export interface RecordOptions {
  transport: Transport;
  clock: Clock;
  /** What a sign-in hands the app: Edunex's token, SIX's Cookie header ("khongguan=…"). */
  sessions: { edunex?: string; six?: string };
  /** Lets time pass: a real sleep, or the pretend clock moving. */
  wait(ms: number): Promise<void>;
  note: string;
  /** The sync is over once nothing has been asked for this long (SIX's gap is 2 s). */
  quietMs?: number;
  /** Stops waiting after this long whatever is still going. */
  limitMs?: number;
}

/** One sync, as the phone starts with these sessions and nothing saved: every feed is due. */
export async function recordSync(options: RecordOptions): Promise<SyncTimings> {
  const { clock } = options;
  let startedAt = clock.now();
  const recording = recordingTransport(options.transport, clock, () => startedAt);
  const vault = new MemoryVault();
  if (options.sessions.edunex) await vault.set("edunex.session", JSON.stringify({ token: options.sessions.edunex }));
  if (options.sessions.six) await vault.set("six.session", JSON.stringify({ cookie: options.sessions.six }));
  const datasets = new Map<string, number>();
  const feeds = new Map<string, { doneAtMs: number; ok: boolean }>();
  // A feed's run ends with a line in the app's log under its name ("edunex.tasks"): "ok", or what went wrong.
  const log = new AppLog(() => clock.now());
  const add = log.add.bind(log);
  log.add = (level, area, message) => {
    add(level, area, message);
    if (/^(edunex|six|itb)\.\w+$/.test(area) && !/left out$/.test(message) && clock.now() >= startedAt)
      feeds.set(area, { doneAtMs: clock.now() - startedAt, ok: message === "ok" });
  };
  const engine = createEngine({
    transport: recording.transport,
    clock,
    storage: new MemoryStorage(),
    vault,
    version: "0.0.0-timings",
    emit: (event) => {
      if (event.type === "dataset" && !datasets.has(event.dataset.name)) datasets.set(event.dataset.name, clock.now() - startedAt);
    },
    // Nothing leaves but the sync's own reads: no report relay, no update check, no phone.
    relay: "",
    log,
    startDueOnly: true,
  });
  await engine.load();
  startedAt = clock.now();
  engine.start();
  const quietMs = options.quietMs ?? 10_000;
  const limitMs = options.limitMs ?? 300_000;
  while (clock.now() - startedAt < limitMs && !(clock.now() - startedAt > quietMs && recording.quietFor(quietMs))) await options.wait(250);
  engine.stop();
  return {
    format: 1,
    kind: "recording",
    note: options.note,
    requests: recording.requests.sort((a, b) => a.startedAtMs - b.startedAtMs),
    datasets: [...datasets].map(([name, freshAtMs]) => ({ name, freshAtMs })).sort((a, b) => a.freshAtMs - b.freshAtMs),
    feeds: [...feeds].map(([name, done]) => ({ name, ...done })).sort((a, b) => a.doneAtMs - b.doneAtMs),
    refused: recording.refused,
    totalMs: Math.max(0, ...[...feeds].filter(([name]) => name !== "itb.catalog").map(([, done]) => done.doneAtMs)),
  };
}

export { systemClock } from "../../src/engine/clock";

/**
 * Node's fetch as the engine's door to the network, as the phone's (mobile/src/host/transport.ts): no cookie
 * jar (SIX's cookie goes as the explicit Cookie header), redirects returned as they are when asked, a time
 * limit on every request, failures as NetworkError.
 */
export const nodeTransport: Transport = {
  async request(request) {
    const limit = request.timeoutMs ?? 15_000;
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
        redirect: request.redirect ?? "follow",
        signal: controller.signal,
      });
      const headers: Record<string, string> = {};
      response.headers.forEach((value, name) => {
        headers[name.toLowerCase()] = value;
      });
      if (request.redirect === "manual" && response.status >= 300 && response.status < 400)
        return { status: response.status, headers, body: "", url: request.url };
      return { status: response.status, headers, body: await response.text(), url: response.url || request.url };
    } catch (error) {
      if (timedOut) throw new NetworkError("timeout", `No answer within ${limit / 1000} s`);
      throw new NetworkError("failed", `${new URL(request.url).host}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      clearTimeout(timer);
    }
  },
};
