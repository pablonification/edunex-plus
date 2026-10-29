// A download from Edunex's storage that fails on the phone (mobile/src/host/download-errors.ts): a
// link Edunex no longer honours is told apart from a connection problem, the desktop's way.
import { describe, expect, it } from "vitest";
import { linkGone, statusIn } from "../../mobile/src/host/download-errors";

describe("why a download failed", () => {
  it("reads the status out of Android's download errors", () => {
    expect(statusIn("Unable to download a file: response has status: 403")).toBe(403);
    expect(statusIn("Unable to download a file: HTTP 404")).toBe(404);
    expect(statusIn("Unable to download a file: Unable to resolve host")).toBeNull();
    expect(statusIn("timeout after 30000 ms")).toBeNull();
  });

  it("an expired, revoked or removed link is gone for good; a busy or broken server isn't", () => {
    for (const status of [401, 403, 404, 410]) expect(linkGone(status)).toBe(true);
    for (const status of [429, 500, 502, 503]) expect(linkGone(status)).toBe(false);
  });
});
