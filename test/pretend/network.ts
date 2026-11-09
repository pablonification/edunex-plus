// The pretend world's "real network" mode: every request takes as long as the same kind of request
// took on the real services (the median of a timing file's requests with the same host, method and
// path pattern; test/kit/sync-timings.ts writes one), or the host's median for a kind it never saw.
// The pretend Edunex and SIX answer at once otherwise, which hides what a phone waits for.
// Phone-safe: no Node.

export interface TimedRequest {
  host: string;
  method: string;
  /** The path, every segment with a digit in it (an id, a NIM, a month) as ":id", without its query. */
  pathPattern: string;
  status: number | "network-error";
  ms: number;
  /** From the sync's start. */
  startedAtMs: number;
}

export interface SyncTimings {
  format: 1;
  /** "recording": measured on the real services; "estimate": numbers made up to stand in for one. */
  kind: "recording" | "estimate";
  /** The day it was recorded ("2026-11-10"), or what the estimate was based on. */
  note: string;
  requests: TimedRequest[];
  /** When each dataset was first stored from this sync (ms from its start). */
  datasets: { name: string; freshAtMs: number }[];
  /** When each feed's first run ended, and how. */
  feeds: { name: string; doneAtMs: number; ok: boolean }[];
  /** Requests the recorder refused (anything that would write). Always empty, or the engine has a bug. */
  refused: { host: string; method: string; pathPattern: string }[];
  /** From the start to the last Student request's answer (the public catalog left out). */
  totalMs: number;
}

/** "/app/mahasiswa:18223901+2026-1/kelas/jadwal/mahasiswa/123?bulan=202610" → "/app/:id/kelas/jadwal/mahasiswa/:id". */
export function pathPattern(url: string): string {
  const { pathname } = new URL(url);
  return pathname
    .split("/")
    .map((segment) => (/\d/.test(segment) || segment.length > 40 || /[@%]/.test(segment) ? ":id" : segment))
    .join("/");
}

/** For a host the file never saw. */
const UNKNOWN_HOST_MS = 600;

const median = (values: readonly number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)] ?? UNKNOWN_HOST_MS;
};

export class NetworkProfile {
  private readonly byKind = new Map<string, number>();
  private readonly byHost = new Map<string, number>();

  constructor(readonly timings: Pick<SyncTimings, "kind" | "requests">) {
    const kinds = new Map<string, number[]>();
    const hosts = new Map<string, number[]>();
    for (const request of timings.requests) {
      if (request.status === "network-error") continue;
      const kind = `${request.host} ${request.method} ${request.pathPattern}`;
      kinds.set(kind, [...(kinds.get(kind) ?? []), request.ms]);
      hosts.set(request.host, [...(hosts.get(request.host) ?? []), request.ms]);
    }
    for (const [kind, values] of kinds) this.byKind.set(kind, median(values));
    for (const [host, values] of hosts) this.byHost.set(host, median(values));
  }

  /** How long this request takes (ms). */
  latency(method: string, url: string): number {
    const host = new URL(url).host;
    return (
      this.byKind.get(`${host} ${method} ${pathPattern(url)}`) ?? this.byKind.get(`${host} GET ${pathPattern(url)}`) ?? this.byHost.get(host) ?? UNKNOWN_HOST_MS
    );
  }
}
