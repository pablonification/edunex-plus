// The pretend world the engine talks to in tests: Edunex, SIX, ITB's public
// pages, Edunex's file storage and GitHub's releases behind one Transport, on a fake clock, with
// a network that can drop or slow down.
import { type Clock, sleep } from "../../src/engine/clock";
import { type HttpRequest, type HttpResponse, NetworkError, type Transport } from "../../src/engine/http/transport";
import { FakeClock } from "./clock";
import { PretendEdunex } from "./edunex";
import { PretendGithub } from "./github";
import { PretendItb } from "./itb";
import { PretendSix } from "./six";

export class PretendWorld implements Transport {
  readonly clock: FakeClock;
  readonly edunex: PretendEdunex;
  readonly six: PretendSix;
  readonly itb: PretendItb;
  readonly github: PretendGithub;
  /** Files uploaded to Edunex's storage, by path. */
  readonly blobs = new Map<string, Uint8Array | string>();
  /** The headers each upload to the storage came with, by path. */
  readonly blobHeaders = new Map<string, Record<string, string>>();
  /** Every request that reached the world, for assertions about politeness. */
  readonly log: { at: number; method: string; url: string; status: number | "network-error" }[] = [];
  private offline = false;
  private latencyMs = 0;
  /** Uploads to the storage that fail next: an error status, or "network" for a dropped connection. */
  private uploadFaults: (number | "network")[] = [];

  constructor(options: { now?: string } = {}) {
    this.clock = FakeClock.at(options.now ?? "2026-10-08T08:12:00+07:00");
    this.edunex = new PretendEdunex(this.clock);
    this.six = new PretendSix(() => this.clock.now());
    this.itb = new PretendItb(() => this.clock.now());
    this.github = new PretendGithub(() => this.clock.now());
  }

  get engineClock(): Clock {
    return this.clock;
  }

  /** No network at all: every request fails like a dropped connection. */
  setOffline(offline: boolean): void {
    this.offline = offline;
  }

  /** The next `times` uploads to Edunex's storage fail with `status`, or drop the connection. */
  failUploads(status: number | "network", times = 1): void {
    this.uploadFaults.push(...Array.from({ length: times }, () => status));
  }

  /** Every answer takes this long (on the fake clock). */
  setLatency(ms: number): void {
    this.latencyMs = ms;
  }

  async request(request: HttpRequest): Promise<HttpResponse> {
    const url = new URL(request.url);
    const at = this.clock.now();
    try {
      if (this.offline) throw new NetworkError("offline", `${url.host} is unreachable`);
      if (this.latencyMs > 0) {
        if (request.timeoutMs !== undefined && this.latencyMs > request.timeoutMs) {
          await sleep(this.clock, request.timeoutMs);
          throw new NetworkError("timeout", `${url.host} took longer than ${request.timeoutMs} ms`);
        }
        await sleep(this.clock, this.latencyMs);
      }
      const response = this.route(request, url);
      this.log.push({ at, method: request.method, url: request.url, status: response.status });
      return response;
    } catch (error) {
      if (error instanceof NetworkError) this.log.push({ at, method: request.method, url: request.url, status: "network-error" });
      throw error;
    }
  }

  private route(request: HttpRequest, url: URL): HttpResponse {
    if (this.itb.serves(url)) return this.itb.handle(request, url);
    if (url.host === "api-edunex.cognisia.id") return this.edunex.handle(request, url);
    if (url.host === "six.itb.ac.id") return this.six.handle(request, url);
    if (url.host === "api.github.com") return this.github.handle(request, url);
    if (url.host.endsWith(".blob.core.windows.net")) {
      if (request.method === "PUT") {
        const fault = this.uploadFaults.shift();
        if (fault === "network") throw new NetworkError("failed", "The connection to the storage dropped");
        if (fault) return { status: fault, headers: {}, body: "ServerBusy", url: url.toString() };
        // Azure refuses a blob upload that doesn't say what kind of blob it is.
        if (request.headers?.["x-ms-blob-type"] !== "BlockBlob") return { status: 400, headers: {}, body: "MissingRequiredHeader", url: url.toString() };
        this.blobs.set(url.pathname, request.body ?? "");
        this.blobHeaders.set(url.pathname, { ...request.headers });
        return { status: 201, headers: {}, body: "", url: url.toString() };
      }
      const blob = this.blobs.get(url.pathname);
      return blob === undefined
        ? { status: 404, headers: {}, body: "BlobNotFound", url: url.toString() }
        : { status: 200, headers: {}, body: typeof blob === "string" ? blob : Buffer.from(blob).toString(), url: url.toString() };
    }
    throw new NetworkError("failed", `The pretend world has no ${url.host}`);
  }
}
