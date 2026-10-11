// What the app picks up from Edunex's website after the Student signs in
// (`localStorage.auth` on edunex.itb.ac.id), shaped like the recorded value.
import { describe, expect, it } from "vitest";
import { readSignInToken } from "../../src/engine/sources/edunex/signin";

const token = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI5MDAwMDEifQ.c2lnbmF0dXJl";
const saved = {
  accessToken: token,
  refreshToken: "eyJhbGciOiJIUzI1NiJ9.eyJyZWZyZXNoIjp0cnVlfQ.c2lnbmF0dXJl",
  expirationDate: "2027-09-06T10:00:00.000Z",
  verified: true,
  accounts: [{ id: 900001, username: "18223901", level: "student", name: "Dimas Pratama", lptk_id: 2 }],
};

describe("reading the Edunex session after sign-in", () => {
  it("takes only the access token from what the website saved", () => {
    expect(readSignInToken(JSON.stringify(saved))).toBe(token);
  });

  it("waits while sign-in hasn't finished", () => {
    expect(readSignInToken(null)).toBeNull();
    expect(readSignInToken("")).toBeNull();
    expect(readSignInToken("{")).toBeNull();
    expect(readSignInToken(JSON.stringify({ ...saved, accessToken: "" }))).toBeNull();
  });

  it("ignores anything that isn't a session token", () => {
    expect(readSignInToken(JSON.stringify({ ...saved, accessToken: "not a token" }))).toBeNull();
    expect(readSignInToken(JSON.stringify({ ...saved, accessToken: 12345 }))).toBeNull();
    expect(readSignInToken(JSON.stringify([token]))).toBeNull();
  });
});
