// Edunex's and SIX's pages open in the app, signed in, never in the phone's browser (W14): the rules
// mobile/src/host/signed-pages.ts and the page (mobile/src/screens/web/signed-page.tsx) go by.
import { describe, expect, it, vi } from "vitest";

// The phone's react-native (handlers.ts resolves it from mobile/), with only what the handlers use.
const Linking = vi.hoisted(() => ({ openURL: vi.fn(async (_url: string) => undefined) }));
vi.mock("../../mobile/node_modules/react-native/index.js", () => ({ Linking, Platform: { OS: "android", Version: 36 } }));

import { edunexAuthScript, isSixLoginPage, siteOf, staysInPage } from "../../mobile/src/host/signed-pages";

describe("which pages open in the app", () => {
  it("Edunex's and SIX's own sites, https only", () => {
    expect(siteOf("https://edunex.itb.ac.id/courses/95001/preview/473251")).toBe("edunex");
    expect(siteOf("https://six.itb.ac.id/app/mahasiswa:18223901/statusmhs")).toBe("six");
    expect(siteOf("http://six.itb.ac.id/")).toBeNull();
    expect(siteOf("https://evil.example/six.itb.ac.id")).toBeNull();
    expect(siteOf("https://user:pw@six.itb.ac.id/")).toBeNull();
  });

  it("stays on them and Microsoft's sign-in; anywhere else leaves the page", () => {
    expect(staysInPage("https://login.microsoftonline.com/common/oauth2")).toBe(true);
    expect(staysInPage("https://sso-edunex.itb.ac.id/")).toBe(true);
    expect(staysInPage("https://www.youtube.com/watch?v=1")).toBe(false);
    expect(staysInPage("https://itb.ac.id/")).toBe(false);
  });

  it("knows SIX's own sign-in page from its Microsoft door", () => {
    expect(isSixLoginPage("https://six.itb.ac.id/login")).toBe(true);
    expect(isSixLoginPage("https://six.itb.ac.id/login/MS365")).toBe(false);
    expect(isSixLoginPage("https://six.itb.ac.id/app/mahasiswa:1/statusmhs")).toBe(false);
  });
});

describe("Edunex's saved sign-in", () => {
  const token = "aaa.bbb.ccc";
  it("is put back before Edunex's scripts run, only on its own site, only when it's gone", () => {
    const script = edunexAuthScript(token);
    const storage = new Map<string, string>();
    const run = (host: string) =>
      new Function("location", "window", script)(
        { host },
        { localStorage: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v) } },
      );
    run("six.itb.ac.id");
    expect(storage.size).toBe(0);
    run("edunex.itb.ac.id");
    expect(JSON.parse(storage.get("auth")!)).toEqual({ accessToken: token });
    storage.set("auth", '{"accessToken":"x.y.z","user":1}');
    run("edunex.itb.ac.id");
    expect(storage.get("auth")).toBe('{"accessToken":"x.y.z","user":1}');
  });

  it("puts nothing in for a missing or odd token", () => {
    expect(edunexAuthScript(null)).toBe("true;");
    expect(edunexAuthScript("'); alert(1); ('")).toBe("true;");
  });
});

describe("the app's links", () => {
  it("send Edunex's and SIX's pages to the app's page, never the browser; others to the browser", async () => {
    const { phoneHandlers } = await import("../../mobile/src/host/handlers");
    const openPage = vi.fn(async () => undefined);
    const handlers = phoneHandlers({ engine: {} as never, demo: false, ui: { openCheckIn: vi.fn(), openPage } } as never);
    await handlers["shell.openExternal"]!({ url: "https://six.itb.ac.id/app/mahasiswa:1/statusmhs" });
    await handlers["shell.openExternal"]!({ url: "https://edunex.itb.ac.id/courses/1" });
    expect(openPage).toHaveBeenCalledTimes(2);
    expect(Linking.openURL).not.toHaveBeenCalled();
    await handlers["shell.openLink"]!({ url: "https://www.youtube.com/watch?v=1" });
    expect(Linking.openURL).toHaveBeenCalledWith("https://www.youtube.com/watch?v=1");
  });
});
