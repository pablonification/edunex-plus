// What the app picks up in the SIX sign-in window: when SIX is back after
// Microsoft's sign-in, and its `khongguan` session cookie, kept as the Cookie
// header every SIX page is asked with.
import { describe, expect, it } from "vitest";
import { isSixAfterSignIn, readSixSession, SIX_SIGN_IN_URL } from "../../src/engine/sources/six/signin";

describe("SIX after sign-in", () => {
  it("starts at SIX's own 'Login dengan ITB Account'", () => {
    expect(SIX_SIGN_IN_URL).toBe("https://six.itb.ac.id/login/MS365");
    expect(isSixAfterSignIn(SIX_SIGN_IN_URL)).toBe(false);
  });

  it("is SIX's pages once signed in", () => {
    expect(isSixAfterSignIn("https://six.itb.ac.id/home")).toBe(true);
    expect(isSixAfterSignIn("https://six.itb.ac.id/home?context=mahasiswa:18223901")).toBe(true);
    expect(isSixAfterSignIn("https://six.itb.ac.id/app/mahasiswa:18223901/statusmhs")).toBe(true);
  });

  it("isn't the sign-in steps, Microsoft, public pages or anything else", () => {
    for (const url of [
      "https://six.itb.ac.id/login",
      "https://six.itb.ac.id/login/MS365/callback?code=x",
      "https://six.itb.ac.id/logout",
      "https://six.itb.ac.id/pub/kur2024",
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      "http://six.itb.ac.id/home",
      "https://six.itb.ac.id.example.com/home",
      "about:blank",
      "",
    ])
      expect(isSixAfterSignIn(url), url).toBe(false);
  });
});

describe("SIX's session cookie", () => {
  const cookies = [
    { name: "_ga", value: "GA1.3.1" },
    { name: "khongguan", value: "a1B2c3%2Fd4-e5.f6" },
  ];

  it("becomes the Cookie header SIX expects", () => {
    expect(readSixSession(cookies)).toBe("khongguan=a1B2c3%2Fd4-e5.f6");
  });

  it("waits while SIX hasn't set it", () => {
    expect(readSixSession([])).toBeNull();
    expect(readSixSession([{ name: "_ga", value: "GA1.3.1" }])).toBeNull();
    expect(readSixSession([{ name: "khongguan", value: "" }])).toBeNull();
  });

  it("refuses a value that would break the header", () => {
    expect(readSixSession([{ name: "khongguan", value: "abc; other=1" }])).toBeNull();
    expect(readSixSession([{ name: "khongguan", value: "abc\r\nX: y" }])).toBeNull();
  });
});
