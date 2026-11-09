// Talks to SIX (six.itb.ac.id) the way a person would: one page at a time, at
// least two seconds apart, with the Student's session cookie. A redirect to
// /login means SIX ended the session; a redirect to a page the app never reads
// (SIX's Pengkinian Data Induk form) means SIX wants the Student there first; a
// rate-limit answer (429) leaves SIX alone for at least 15 minutes.
import type { Clock } from "../../clock";
import { ActionNeeded, EngineError } from "../../errors";
import { Pace, type Place } from "../../http/pace";
import { type HttpResponse, NetworkError, type Transport } from "../../http/transport";
import { type FeedRead, noting } from "../../report/kept-pages";
import type { SixIdentity, SixPages } from "./pages";
import { readNim, readStatusPage, type StatusPage } from "./status";

export const SIX_ORIGIN = "https://six.itb.ac.id";
/** Human pace: at most one page every two seconds. */
const PAGE_GAP_MS = 2_000;
/** How long SIX is left alone after it says "too many requests" (longer if it asks). */
const RATE_LIMIT_PAUSE_MS = 15 * 60_000;
const MAX_PAUSE_MS = 6 * 3_600_000;
const TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;
/**
 * SIX's pages that hold passwords or family data (its control panel, master data, student ID card
 * and PDDikti pages): the app never reads one. As PRIVATE_PAGES in test/kit/privacy-rules.ts, which
 * keeps them out of the test data and of reports.
 */
export const PRIVATE_PAGES = /controlpanel|datainduk|ktm|pddikti/i;
const SIGNED_IN = /href=["']\/logout\b/i;
const SIGN_IN_LINK = /href=["'](?:https:\/\/six\.itb\.ac\.id)?\/login\b/i;

/** "/app/mahasiswa:18223901+2026-1/kelas/jadwal/…?bulan=…" → "/kelas/jadwal/…", for status details. */
const label = (path: string) => path.replace(/^\/app\/mahasiswa:[^/]+/, "").replace(/\?.*$/, "") || "/";

/** Who is signed in, and the status page being read: one of each per session, every run's view sharing them. */
interface Known {
  identity: SixIdentity | null;
  reading: Promise<StatusPage> | null;
}

export class SixClient implements SixPages {
  constructor(
    private readonly transport: Transport,
    private readonly clock: Clock,
    /** The Cookie header that carries the session ("khongguan=…"). */
    private readonly cookie: string,
    private readonly userAgent: string,
    /** SIX's line, shared with the public catalog on the same site. */
    private readonly pace: Pace = new Pace(clock),
    private readonly known: Known = { identity: null, reading: null },
    /** Where its pages wait in SIX's line (Pace.turn). */
    private readonly place: Place = "normal",
  ) {}

  /** This client for one feed run: the same line and session, its pages noted for that run's report (FeedSpec.run). */
  for(read: FeedRead): SixClient {
    return new SixClient(noting(this.transport, read), this.clock, this.cookie, this.userAgent, this.pace, this.known, this.place);
  }

  /** This client with its pages behind the others in SIX's line: the records, read by the day, after today's pages. */
  later(): SixClient {
    return new SixClient(this.transport, this.clock, this.cookie, this.userAgent, this.pace, this.known, "behind");
  }

  page(path: string, options: { popup?: boolean } = {}): Promise<string> {
    return this.pace.turn(() => this.fetch(path, 0, options.popup ?? false), this.place);
  }

  /** Who is signed in. While the status page is being read, what it says (a new term) rather than what was known. */
  async who(): Promise<SixIdentity> {
    if (this.known.reading) await this.known.reading;
    if (this.known.identity) return this.known.identity;
    await this.status();
    return this.known.identity!;
  }

  /**
   * The student status page, read now: who the Student is, this term and its
   * courses. It also keeps `who()` current (a new term starts mid-session).
   */
  status(): Promise<StatusPage> {
    this.known.reading ??= (async () => {
      try {
        const nim = this.known.identity?.nim ?? readNim(await this.page("/home"));
        const status = readStatusPage(await this.page(`/app/mahasiswa:${nim}/statusmhs`), nim);
        this.known.identity = { nim, studentId: status.student.studentId, term: status.student.term };
        return status;
      } finally {
        this.known.reading = null;
      }
    })();
    return this.known.reading;
  }

  /** `asked`: the page the app asked for, before any redirect. */
  private async fetch(path: string, redirects: number, popup: boolean, asked = path): Promise<string> {
    if (this.pace.paused) throw new EngineError("Offline", "SIX answered 429");
    await this.pace.gap(PAGE_GAP_MS);

    let response: HttpResponse;
    try {
      response = await this.transport.request({
        method: "GET",
        url: `${SIX_ORIGIN}${path}`,
        headers: {
          cookie: this.cookie,
          "user-agent": this.userAgent,
          accept: "text/html,application/xhtml+xml",
          // The pages the readers were checked against; English ones read the same.
          "accept-language": "id-ID,id;q=0.9",
          // SIX's timetable loads a class's popup with jQuery, which says so; asked otherwise, SIX may answer with another page.
          ...(popup ? { "x-requested-with": "XMLHttpRequest" } : {}),
        },
        redirect: "manual",
        timeoutMs: TIMEOUT_MS,
      });
    } catch (error) {
      if (error instanceof NetworkError)
        throw new EngineError("Offline", error.reason === "timeout" ? "SIX didn't answer in time" : "SIX is unreachable", true);
      throw error;
    }

    const { status } = response;
    if (status >= 300 && status < 400) {
      const next = this.sameSite(response.headers.location, path);
      // To /login, or off SIX to Microsoft's sign-in: the session is over.
      if (!next) throw new EngineError("Unauthorized", "SIX ended the session");
      // To a page the app never reads: SIX wants the Student there first (its Pengkinian Data Induk form, which it makes
      // a Student fill in before anything else). That page isn't fetched, so its family data never reaches the app.
      const unread = PRIVATE_PAGES.exec(next.replace(/\?.*$/, ""))?.[0].toLowerCase();
      if (unread && !PRIVATE_PAGES.test(asked))
        throw new ActionNeeded(unread === "datainduk" ? "datainduk" : "other", `SIX sends ${label(asked)} to its ${unread} page first`);
      if (redirects >= MAX_REDIRECTS) throw new EngineError("Failed", `SIX kept redirecting ${label(path)}`);
      return this.fetch(next, redirects + 1, popup, asked);
    }
    if (status === 429) {
      this.pace.pause(this.clock.now() + pauseFor(response.headers["retry-after"]));
      throw new EngineError("Offline", "SIX answered 429");
    }
    if (status === 401) throw new EngineError("Unauthorized", "SIX ended the session");
    if (status >= 500) throw new EngineError("Offline", `SIX answered ${status}`);
    if (status >= 400) throw new EngineError("Failed", `SIX answered ${status} for ${label(path)}`);
    if (!SIGNED_IN.test(response.body) && SIGN_IN_LINK.test(response.body)) throw new EngineError("Unauthorized", "SIX showed its sign-in page");
    return response.body;
  }

  /** Where a redirect leads, when it stays on SIX and isn't its sign-in. */
  private sameSite(location: string | undefined, from: string): string | null {
    if (!location) return null;
    let url: URL;
    try {
      url = new URL(location, `${SIX_ORIGIN}${from}`);
    } catch {
      return null;
    }
    if (url.origin !== SIX_ORIGIN || /^\/login\b/i.test(url.pathname)) return null;
    return `${url.pathname}${url.search}`;
  }
}

function pauseFor(retryAfter: string | undefined): number {
  const seconds = Number(retryAfter);
  const asked = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0;
  return Math.min(MAX_PAUSE_MS, Math.max(RATE_LIMIT_PAUSE_MS, asked));
}
