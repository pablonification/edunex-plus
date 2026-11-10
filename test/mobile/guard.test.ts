// The QA builds' read-only guard (mobile/src/host/guard.ts, EXPO_PUBLIC_R3_GUARD=1): a build run on a real
// Student's account reads Edunex, SIX and Microsoft and changes nothing there. The paths are the engine's own
// (src/engine/sources/edunex/hand-in.ts, src/core/links.ts) on the made-up Student of test/fixtures.
import { describe, expect, it, vi } from "vitest";
import { blockedLine, guardedTransport, guardScript } from "../../mobile/src/host/guard";
import { type HttpRequest, NetworkError } from "../../src/engine/http/transport";
import { EDUNEX_API } from "../../src/engine/sources/edunex/client";

const api = (path: string) => new URL(path, EDUNEX_API).toString();
const SIX_APP = "https://six.itb.ac.id/app/mahasiswa:18223901+2026-1";
const MEETING = `${SIX_APP}/kelas/pertemuan/4242/mhs/2021000001`;

/** [method, url, blocked?] */
const CASES: [string, string, boolean][] = [
  // An Edunex hand-in: the answer, the upload link, the upload, sending it, a comment, the export undone.
  ["POST", api("/course/task/answers"), true],
  ["PATCH", api("/course/task/answers/77"), true],
  ["PUT", api("/course/task/answers/77"), true],
  ["POST", api("/blob-storage/sas"), true],
  ["PUT", "https://edunexstorage.blob.core.windows.net/edunex/upload/answer.pdf?sv=2024&sig=pretend", true],
  ["POST", api("/course/comments"), true],
  ["DELETE", api("/blob-storage//task/77/export"), true],
  // SIX's Tandai Hadir pressed, its KRS changed, the questionnaire, paying.
  ["POST", `${MEETING}/hadir`, true],
  ["GET", `${MEETING}/hadir`, true],
  ["POST", `${SIX_APP}/kelas/pertemuan/4242/presensi`, true],
  ["POST", `${SIX_APP}/registrasi/rencanastudi/aD/2021000001`, true],
  ["GET", `${SIX_APP}/registrasi/rencanastudi/rencana/2021000001`, true],
  ["POST", `${SIX_APP}/registrasi/message/2021000001/send`, true],
  ["GET", `${SIX_APP}/evaluasi/kuesioner`, true],
  ["GET", "https://six.itb.ac.id/app/mahasiswa:18223901/keuangan/bayar/2026-1", true],
  // Signing out, anywhere, even as a GET.
  ["GET", "https://six.itb.ac.id/logout", true],
  ["GET", "https://login.microsoftonline.com/common/oauth2/v2.0/logout?post_logout_redirect_uri=x", true],
  ["POST", api("/login/logout"), true],
  ["GET", "https://sso-edunex.itb.ac.id/logout", true],
  // Reads: Edunex's liveness and lists, SIX's pages (the class popup the engine reads for Tandai Hadir too).
  ["GET", api("/login/me"), false],
  ["GET", api("/course/task/answers?taskId=77"), false],
  ["GET", "https://edunexstorage.blob.core.windows.net/edunex/upload/answer.pdf?sig=pretend", false],
  ["GET", `${SIX_APP.replace("+2026-1", "")}/statusmhs`, false],
  ["GET", `${SIX_APP}/kelas/jadwal/mahasiswa/2021000001?bulan=202610`, false],
  ["GET", `${MEETING}?returnTo=/app`, false],
  ["GET", `${SIX_APP}/registrasi/rencanastudi/2021000001`, false],
  ["GET", "https://six.itb.ac.id/app/mahasiswa:18223901/keuangan", false],
  ["HEAD", "https://six.itb.ac.id/pub/kur2024", false],
  ["OPTIONS", api("/course/comments"), false],
  // Signing in: Microsoft's pages, ITB's doors, SIX's and Edunex's sign-in paths.
  ["POST", "https://login.microsoftonline.com/common/login", false],
  ["POST", "https://login.microsoftonline.com/common/SAS/ProcessAuth", false],
  ["POST", "https://login.live.com/ppsecure/post.srf", false],
  ["POST", "https://sso-edunex.itb.ac.id/callback", false],
  ["POST", "https://login.itb.ac.id/cas/login", false],
  ["POST", "https://six.itb.ac.id/login/MS365", false],
  ["POST", api("/auth/token"), false],
  // Elsewhere is left alone; other writes on the guarded hosts aren't.
  ["POST", "https://ntfy.sh/", false],
  ["POST", "https://six.itb.ac.id/app/mahasiswa:18223901/statusmhs", true],
  ["POST", "https://browser.events.data.microsoft.com/OneCollector/1.0/", true],
];

describe("the read-only guard", () => {
  it.each(CASES)("%s %s → blocked: %s", (method, url, blocked) => {
    expect(blockedLine(method, url) !== null).toBe(blocked);
  });

  it("says the method, host and path only: no query", () => {
    expect(blockedLine("put", "https://edunexstorage.blob.core.windows.net/edunex/upload/a.pdf?sig=pretend")).toBe(
      "PUT edunexstorage.blob.core.windows.net/edunex/upload/a.pdf",
    );
  });

  it("fails the engine's request as a NetworkError, before it reaches the network", async () => {
    const inner = { request: vi.fn(async (request: HttpRequest) => ({ status: 200, headers: {}, body: "{}", url: request.url })) };
    const lines: string[] = [];
    const transport = guardedTransport(inner, (line) => lines.push(line));
    const write = transport.request({ method: "POST", url: api("/course/comments"), body: '{"html":"hi"}' });
    await expect(write).rejects.toBeInstanceOf(NetworkError);
    await expect(write).rejects.toMatchObject({ reason: "failed" });
    expect(inner.request).not.toHaveBeenCalled();
    expect(lines).toEqual(["[guard] blocked POST api-edunex.cognisia.id/course/comments"]);
    await transport.request({ method: "GET", url: api("/login/me") });
    expect(inner.request).toHaveBeenCalledTimes(1);
  });
});

/** The web views' copy of the rule, run on a stand-in page. */
function page() {
  const posted: string[] = [];
  const sent: string[] = [];
  const fetched: string[] = [];
  const listeners: Record<string, (event: unknown) => void> = {};
  // The page's own form send, which the guard wraps: a send that reaches it went out.
  class HTMLFormElement {
    submit(this: Form) {
      sent.push(String(this.getAttribute("action")));
    }
  }
  class Form extends HTMLFormElement {
    constructor(private readonly attrs: Record<string, string>) {
      super();
    }
    getAttribute(name: string) {
      return this.attrs[name] ?? null;
    }
  }
  class XMLHttpRequest {
    open(_method: string, url: string) {
      this.url = url;
    }
    url = "";
    send() {
      sent.push(this.url);
    }
    dispatchEvent() {}
  }
  const window: Record<string, unknown> = {
    fetch: async (url: string) => fetched.push(url),
    ReactNativeWebView: { postMessage: (data: string) => posted.push(JSON.parse(data).guard) },
  };
  const document = { addEventListener: (type: string, listener: (event: unknown) => void) => (listeners[type] = listener) };
  const location = { href: `${SIX_APP}/kelas/jadwal/mahasiswa/2021000001` };
  const quiet = { warn() {} };
  new Function("window", "document", "location", "HTMLFormElement", "XMLHttpRequest", "navigator", "console", "Event", guardScript)(
    window,
    document,
    location,
    HTMLFormElement,
    XMLHttpRequest,
    {},
    quiet,
    class {},
  );
  return { window, listeners, Form, XMLHttpRequest, posted, sent, fetched };
}

describe("the guard in the app's web views", () => {
  it("gives the same answers as the engine's", () => {
    const decide = page().window.__edunexPlusGuard as (method: string, url: string) => string | null;
    for (const [method, url] of CASES) expect(decide(method, url), `${method} ${url}`).toBe(blockedLine(method, url));
  });

  it("stops Tandai Hadir's form, a write by fetch or XHR, and lets reads through", async () => {
    const view = page();
    const form = new view.Form({ method: "post", action: "/app/mahasiswa:18223901+2026-1/kelas/pertemuan/4242/mhs/2021000001/hadir" });
    const event = { target: form, submitter: null, preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() };
    view.listeners.submit?.(event);
    expect(event.preventDefault).toHaveBeenCalled();
    (form as unknown as { submit(): void }).submit();

    const fetch = view.window.fetch as (url: string, init?: { method: string }) => Promise<unknown>;
    await expect(fetch(api("/course/comments"), { method: "POST" })).rejects.toThrow("[guard] blocked");
    await fetch(api("/login/me"));

    const xhr = new view.XMLHttpRequest();
    xhr.open("PATCH", api("/course/task/answers/77"));
    xhr.send();

    expect(view.sent).toEqual([]);
    expect(view.fetched).toEqual([api("/login/me")]);
    expect(view.posted).toEqual([
      "POST six.itb.ac.id/app/mahasiswa:18223901+2026-1/kelas/pertemuan/4242/mhs/2021000001/hadir",
      "POST six.itb.ac.id/app/mahasiswa:18223901+2026-1/kelas/pertemuan/4242/mhs/2021000001/hadir",
      "POST api-edunex.cognisia.id/course/comments",
      "PATCH api-edunex.cognisia.id/course/task/answers/77",
    ]);
  });
});
