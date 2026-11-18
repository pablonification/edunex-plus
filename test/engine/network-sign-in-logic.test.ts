// #387: which addresses are a network's own sign-in answering for a site, and which are the site's own (an ended
// session going to Microsoft, a move elsewhere): only the first may read as "No connection".
import { describe, expect, it } from "vitest";
import { awayTo, refreshesAway } from "../../src/engine/http/network-sign-in";

const SIX = "https://six.itb.ac.id/app/mahasiswa:18223901/statusmhs";
const GATE = "https://gate-dev2.itb.ac.id/captive-portal?destination_url=https://six.itb.ac.id/app/mahasiswa:18223901/statusmhs";

describe("a network's own sign-in", () => {
  it("is off the site, and carries the page asked for, plain or encoded", () => {
    expect(awayTo(GATE, SIX)).toBe("gate-dev2.itb.ac.id");
    expect(awayTo(`https://gate.example.net/portal?u=${encodeURIComponent(SIX)}`, SIX)).toBe("gate.example.net");
    expect(awayTo("https://gate.example.net:8443/login?from=SIX.ITB.AC.ID/app/mahasiswa:18223901/statusmhs", SIX)).toBe("gate.example.net:8443");
    expect(awayTo("//gate.example.net/portal?to=six.itb.ac.id/app/mahasiswa:18223901/statusmhs", SIX)).toBe("gate.example.net");
  });

  it("isn't the site itself (by http too), an address with no site, or no address", () => {
    for (const address of ["/login", "http://six.itb.ac.id/login", "HTTPS://SIX.ITB.AC.ID/home", "javascript:void(0)", "mailto:x@example.com", "", undefined])
      expect(awayTo(address, SIX), String(address)).toBeNull();
  });

  it("isn't Microsoft's sign-in, by any of its addresses, though it carries the very page to come back to", () => {
    for (const host of [
      "login.microsoftonline.com",
      "login.microsoftonline.us",
      "login.partner.microsoftonline.cn",
      "login.live.com",
      "login.windows.net",
      "sts.windows.net",
      "account.microsoft.com",
      "itb.b2clogin.com",
      "itb.ciamlogin.com",
    ]) {
      expect(awayTo(`https://${host}/common/oauth2/authorize?state=${encodeURIComponent(SIX)}`, SIX), host).toBeNull();
      expect(awayTo(`https://gate.example.net/portal?state=${encodeURIComponent(SIX)}`, SIX), host).toBe("gate.example.net");
    }
  });

  it("finds the page in one value of the address, encoded once or twice, beside a stray %", () => {
    expect(awayTo(`https://gate.example.net/portal?d=${encodeURIComponent(encodeURIComponent(SIX))}`, SIX)).toBe("gate.example.net");
    expect(awayTo(`https://gate.example.net/portal?m=100%&d=${encodeURIComponent(SIX)}`, SIX)).toBe("gate.example.net");
    expect(awayTo(`https://gate.example.net/portal#d=${encodeURIComponent(SIX)}`, SIX)).toBe("gate.example.net");
  });

  it("needs the site and its path together, in the address's query, not apart or in its own path", () => {
    const HOME = "https://six.itb.ac.id/home";
    expect(awayTo("https://sso.example.com/home/login?service=https://six.itb.ac.id/login", HOME)).toBeNull();
    expect(awayTo("https://gate.example.net/cp?d=six.itb.ac.id&p=/home", HOME)).toBeNull();
    expect(awayTo("https://gate.example.net/cp?d=https%3A%2F%2Fsix.itb.ac.id%2Fhome", HOME)).toBe("gate.example.net");
    // A callback under the page asked for isn't that page.
    expect(awayTo("https://sso.example.com/login?service=https://six.itb.ac.id/home/callback", HOME)).toBeNull();
    expect(awayTo("https://sso.example.com/login?service=https%3A%2F%2Fsix.itb.ac.id%2Fhome%2Fcallback", HOME)).toBeNull();
  });

  it("isn't another sign-in service, which carries only the site's callback, not the page asked for", () => {
    for (const address of [
      "https://login.itb.ac.id/cas/login?service=https%3A%2F%2Fsix.itb.ac.id%2Flogin%2Fcallback",
      "https://sso.itb.ac.id/realms/itb/auth?redirect_uri=https://six.itb.ac.id/callback",
      "https://accounts.google.com/o/oauth2/auth?redirect_uri=https://six.itb.ac.id/login/google/callback",
      "https://login.microsoftonline.us/common/oauth2/authorize?redirect_uri=https://six.itb.ac.id/login/MS365/callback",
      "https://gate.example.net/portal?from=six.itb.ac.id",
    ])
      expect(awayTo(address, SIX), address).toBeNull();
  });

  it("isn't the site moving elsewhere, which doesn't carry the page asked for", () => {
    expect(awayTo("https://akademik.itb.ac.id/kuesioner", SIX)).toBeNull();
    expect(awayTo("https://publik.akademik.itb.ac.id/Kalender-Pendidikan-20260710.ics", "https://goitb.id/KalenderPendidikan-ics")).toBeNull();
    // SIX's own refresh page (#385) never asked for it: there, a page that only refreshes off SIX is enough.
    expect(awayTo("https://gate.example.net/portal", SIX, { naming: false })).toBe("gate.example.net");
  });

  it("is read from a page's refresh, not from text that only looks like one", () => {
    expect(refreshesAway(`<meta http-equiv="refresh" content="0; url=${GATE}">`, SIX)).toBe("gate-dev2.itb.ac.id");
    expect(refreshesAway(`<meta http-equiv="refresh" content="0; url=https://www.itb.ac.id/">`, SIX)).toBeNull();
    expect(refreshesAway(`<meta data-http-equiv="refresh" content="0; url=${GATE}">`, SIX)).toBeNull();
    expect(refreshesAway(`<p>http-equiv="refresh" content="0; url=${GATE}"</p>`, SIX)).toBeNull();
  });
});
