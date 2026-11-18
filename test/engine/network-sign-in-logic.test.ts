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
    expect(awayTo("https://gate.example.net:8443/login?from=SIX.ITB.AC.ID", SIX)).toBe("gate.example.net:8443");
    expect(awayTo("//gate.example.net/portal?to=six.itb.ac.id", SIX)).toBe("gate.example.net");
    expect(awayTo("https://gate.example.net/p?u=%E0%A4%A six.itb.ac.id", SIX)).toBe("gate.example.net");
  });

  it("isn't the site itself (by http too), an address with no site, or no address", () => {
    for (const address of ["/login", "http://six.itb.ac.id/login", "HTTPS://SIX.ITB.AC.ID/home", "javascript:void(0)", "mailto:x@example.com", "", undefined])
      expect(awayTo(address, SIX), String(address)).toBeNull();
  });

  it("isn't Microsoft's sign-in, by any of its addresses, though it carries the site to come back to", () => {
    for (const host of ["login.microsoftonline.com", "login.live.com", "login.windows.net", "sts.windows.net", "account.microsoft.com"])
      expect(awayTo(`https://${host}/common/oauth2/authorize?redirect_uri=https://six.itb.ac.id/login/MS365/callback`, SIX), host).toBeNull();
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
