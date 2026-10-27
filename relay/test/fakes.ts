// The relay's three doors, pretend: storage in a Map, a GitHub that keeps its issues in a list (and
// can be down, or slow), and a clock the test moves; and GitHub Actions' tokens, signed with a key of
// its own. Plus what a report from the app looks like.
import type { SigningKey } from "../src/actions";
import { type GitHub, GitHubError, type Issue, type IssueNow } from "../src/github";
import { Relay, type RelayOptions } from "../src/relay";
import type { Store } from "../src/store";

export class MemoryStore implements Store {
  readonly data = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    const value = this.data.get(key);
    return value === undefined ? undefined : (structuredClone(value) as T);
  }

  async put(key: string, value: unknown): Promise<void> {
    this.data.set(key, structuredClone(value));
  }

  async delete(key: string): Promise<boolean> {
    return this.data.delete(key);
  }

  async list<T>({ prefix, limit = Number.POSITIVE_INFINITY }: { prefix: string; limit?: number }): Promise<Map<string, T>> {
    const keys = [...this.data.keys()].filter((key) => key.startsWith(prefix)).sort();
    return new Map(keys.slice(0, limit).map((key) => [key, structuredClone(this.data.get(key)) as T]));
  }
}

export interface PretendIssue {
  number: number;
  title: string;
  body: string;
  labels: string[];
  comments: string[];
  closedAt: number | null;
  reason: string | null;
  deleted: boolean;
}

export class PretendGitHub implements GitHub {
  readonly issues: PretendIssue[] = [];
  /** Every call, as "open", "read 101", "edit 101", "comment 101". */
  readonly calls: string[] = [];
  down = false;
  /** While set, opening an issue waits for it. */
  slow: Promise<void> | null = null;

  async open(issue: { title: string; body: string; labels: string[] }): Promise<Issue> {
    this.calls.push("open");
    if (this.slow) await this.slow;
    if (this.down) throw new GitHubError(503, "GitHub is down");
    const number = 300 + this.issues.length;
    this.issues.push({ number, ...issue, comments: [], closedAt: null, reason: null, deleted: false });
    return { number, url: `https://github.com/pablonification/edunex-plus/issues/${number}` };
  }

  async read(number: number): Promise<IssueNow> {
    this.calls.push(`read ${number}`);
    const issue = this.find(number);
    return { body: issue.body, closedAt: issue.closedAt, reason: issue.reason };
  }

  async edit(number: number, body: string): Promise<void> {
    this.calls.push(`edit ${number}`);
    this.find(number).body = body;
  }

  async comment(number: number, body: string): Promise<void> {
    this.calls.push(`comment ${number}`);
    this.find(number).comments.push(body);
  }

  issue(number: number): PretendIssue {
    return this.issues.find((issue) => issue.number === number)!;
  }

  private find(number: number): PretendIssue {
    if (this.down) throw new GitHubError(503, "GitHub is down");
    const issue = this.issues.find((one) => one.number === number);
    if (!issue || issue.deleted) throw new GitHubError(410, "gone");
    return issue;
  }
}

export const MAINTAINER = "maintainer-token-that-is-long-enough-0123456789";
export const REPO = "pablonification/edunex-plus";
export const START = Date.parse("2026-10-27T03:00:00Z");
export const MINUTE = 60_000;

const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const newPair = async () =>
  (await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;

let signer: Promise<{ key: SigningKey; real: CryptoKey; other: CryptoKey }> | null = null;

/** GitHub Actions' signing key, pretend (made once), and another nobody trusts. */
function pretendSigner() {
  signer ??= (async () => {
    const [real, other] = await Promise.all([newPair(), newPair()]);
    const jwk = await crypto.subtle.exportKey("jwk", real.publicKey);
    return { key: { kid: "pretend", kty: jwk.kty!, n: jwk.n!, e: jwk.e! }, real: real.privateKey, other: other.privateKey };
  })();
  return signer;
}

/**
 * A job's token as GitHub Actions makes it: for the fix bot's run 424242 on main, made for the
 * relay at relay.test, good for five minutes from `now`; `claims` changes any of that. `forged`
 * signs it with a key GitHub doesn't have.
 */
export async function actionsToken(now: number, claims: Record<string, unknown> = {}, forged = false): Promise<string> {
  const { real, other } = await pretendSigner();
  const encode = (value: unknown) => base64url(new TextEncoder().encode(JSON.stringify(value)));
  const body = {
    iss: "https://token.actions.githubusercontent.com",
    aud: "https://relay.test",
    repository: REPO,
    workflow_ref: `${REPO}/.github/workflows/drift-fix.yml@refs/heads/main`,
    run_id: "424242",
    nbf: now / 1000 - 5,
    exp: now / 1000 + 300,
    ...claims,
  };
  const signed = `${encode({ alg: "RS256", kid: "pretend", typ: "JWT" })}.${encode(body)}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", forged ? other : real, new TextEncoder().encode(signed));
  return `${signed}.${base64url(new Uint8Array(signature))}`;
}

/** A relay on the pretend doors, and ways to talk to it as the app, the maintainer and the cron trigger do. */
export function startRelay(options: Partial<RelayOptions> = {}) {
  const store = new MemoryStore();
  const github = new PretendGitHub();
  let now = START;
  const lines: string[] = [];
  const relay = new Relay({
    store,
    github,
    now: () => now,
    maintainerToken: MAINTAINER,
    repo: REPO,
    signingKeys: async () => [(await pretendSigner()).key],
    log: (line) => lines.push(line),
    ...options,
  });

  const call = (path: string, init: RequestInit = {}, address = "203.0.113.7") => relay.handle(new Request(`https://relay.test${path}`, init), address);

  return {
    relay,
    store,
    github,
    lines,
    advance(ms: number) {
      now += ms;
    },
    now: () => now,
    call,
    send(body: unknown, address?: string) {
      return call("/v1/reports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, address);
    },
    note(id: string, token: string, note: unknown, address?: string) {
      return call(
        `/v1/reports/${id}/note`,
        { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ note }) },
        address,
      );
    },
    /** GET /v1/reports/{id}: with the maintainer's token, or a ticket and the fix bot's run's token. */
    fetchReport(id: string, token = MAINTAINER, run?: string) {
      return call(`/v1/reports/${id}`, { headers: { authorization: `Bearer ${token}`, ...(run ? { "x-github-oidc": run } : {}) } });
    },
    cron: () => relay.cron(),
  };
}

export type Pretend = ReturnType<typeof startRelay>;

// ------------------------------------------------------------------------------- reports

/**
 * The report behind #237, made up again: SIX shows this Student's attendance as two percentages
 * (sick days counted apart), so the status page reader leaves each course out. Course codes and
 * names are ITB's public catalog; the Student, their numbers and the percentages are made up.
 */
export const COURSES = [
  { at: 3, code: "IF2123", name: "Aljabar Linier dan Geometri", sks: 3, shown: "81.25% / 93.75%" },
  { at: 4, code: "IF2130", name: "Sistem Operasi", sks: 3, shown: "68.75% / 87.50%" },
  { at: 5, code: "IF2150", name: "Rekayasa Perangkat Lunak", sks: 4, shown: "87.50% / 93.75%" },
];

const HEADER_ROW =
  '<tr><th></th><th>Kode</th><th>Mata Kuliah</th><th class="text-center">Kelas</th><th class="text-center">SKS</th><th class="text-right">Kehadiran</th><th class="text-center">Nilai</th></tr>';

function statusRow(course: (typeof COURSES)[number]) {
  const [present, sick] = course.shown.split(" / ");
  return (
    `<tr><th scope="row" class='text-right'>${course.at}</th><td>${course.code}</td><td>${course.name}</td><td class="text-center">01</td>` +
    `<td class="text-center">${course.sks}</td><td class="text-right"><span title="Hadir">${present}</span> / <span title="Sakit">${sick}</span></td><td class="text-center"></td></tr>`
  );
}

const rowText = (course: (typeof COURSES)[number]) => `${course.at} · ${course.code} · ${course.name} · 01 · ${course.sks} · ${course.shown}`;

/** The scrubbed status page, enough of it. */
export const STATUS_PAGE = `<html><body><h3 class="panel-title">Daftar Kuliah Semester 1-2026/2027</h3><table class="table">${HEADER_ROW}${COURSES.map(statusRow).join("")}</table></body></html>`;

/** What the app sends for that page (format 2), the rows it left out picked by their number in the table. */
export function statusEnvelope(rows = [3, 4, 5], extra: { note?: string; how?: "auto" | "manual"; version?: string; reproduces?: string } = {}) {
  const courses = COURSES.filter((course) => rows.includes(course.at));
  const why = (course: (typeof COURSES)[number]) => `SIX statusmhs: course ${course.at}: attendance without its count`;
  return {
    envelope: 1,
    os: "Windows 10.0.26200 (x64)",
    lang: "id",
    how: extra.how ?? "manual",
    ...(extra.note === undefined ? {} : { note: extra.note }),
    report: {
      format: 2,
      version: extra.version ?? "0.1.0-alpha.22",
      at: START - 5 * MINUTE,
      sources: [
        { source: "edunex", state: "live", detail: null },
        { source: "six", state: "live", detail: null },
      ],
      problems: [
        {
          feed: "six.status",
          datasets: ["six.courses"],
          kind: "skipped",
          check: why(courses[0]!),
          rows: courses.map((course) => ({ row: rowText(course), why: why(course) })),
          at: START - 6 * MINUTE,
          pages: [{ system: "six", path: "/app/mahasiswa:18223901/statusmhs", status: 200, body: STATUS_PAGE }],
          reproduces: extra.reproduces ?? "yes",
          cells: courses.map((course) => ({
            row: rowText(course),
            html: statusRow(course),
            header: HEADER_ROW,
            shape: `9 · aa9999 · ${course.name.replace(/[A-Za-z]+/g, "a")} · 9 · 9 · 9.9% / 9.9%`,
          })),
          impact: { datasets: ["six.courses"], rowsLeftOut: courses.length, detailsBlank: 0, lastGoodAt: null },
          // A field a later version adds: it passes through.
          seenOn: "Presensi",
        },
      ],
      log: [{ at: START - 6 * MINUTE, level: "warn", area: "six.status", message: `read the status page, ${courses.length} rows left out` }],
    },
  };
}

/** A report of a changed page (format 1, as the app sends it today): SIX changed its fees table. */
export function billsEnvelope(check = "SIX keuangan: the bills table has a different layout") {
  return {
    envelope: 1,
    os: "macOS 15.6 (arm64)",
    lang: "en",
    how: "auto",
    report: {
      format: 1,
      version: "0.1.0-alpha.21",
      at: START,
      sources: [{ source: "six", state: "live", detail: null }],
      problems: [
        {
          feed: "six.bills",
          datasets: ["six.bills"],
          kind: "changed",
          check,
          rows: [],
          at: START,
          pages: [{ system: "six", path: "/app/mahasiswa:18223901/keuangan", status: 200, body: "<html><table><tr><th>Dibayar</th></tr></table></html>" }],
        },
      ],
    },
  };
}

/** A report from Settings, with no page in it. */
export function settingsEnvelope(note = "Jadwal minggu depan kosong") {
  return {
    envelope: 1,
    os: "Ubuntu 24.04 (x64)",
    lang: "id",
    how: "manual",
    note,
    report: {
      format: 2,
      version: "0.1.0-alpha.22",
      at: START,
      sources: [
        { source: "edunex", state: "live", detail: null },
        { source: "six", state: "expired", detail: "SIX asked to sign in again" },
      ],
      problems: [],
    },
  };
}
