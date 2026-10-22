// What a failed action says on screen: picked by what went wrong, it says what
// to do next, and never shows the engine's own message ("Edunex answered 503").
import { describe, expect, it } from "vitest";
import { ActionError, errorKey } from "../../src/app/bridge";
import { translate } from "../../src/core/strings";

describe("what a failed action says", () => {
  it.each([
    ["Offline", "Tidak bisa terhubung sekarang. Coba lagi sebentar lagi."],
    ["Unauthorized", "Sesimu berakhir. Masuk lagi, lalu coba lagi."],
    ["VendorChanged", "Edunex atau SIX menjawab dengan cara yang tidak dikenali. Coba lagi nanti."],
    ["Rejected", "Belum berhasil. Coba lagi."],
    ["Failed", "Belum berhasil. Coba lagi."],
  ] as const)("%s: what to do next, never the engine's words", (kind, words) => {
    const said = translate("id", errorKey(new ActionError(kind, "Edunex answered 503")));
    expect(said).toBe(words);
    expect(said).not.toContain("503");
  });

  it("an action's own words for a plain failure; a connection problem still says so", () => {
    const exportFailed = "The calendar couldn't be saved. Try again, or save it to another folder.";
    expect(translate("en", errorKey(new ActionError("Failed", "ENOSPC"), "schedule.exportFailed"))).toBe(exportFailed);
    // Not an ActionError at all (a bug in the window): a plain failure.
    expect(translate("en", errorKey(new TypeError("x is undefined"), "schedule.exportFailed"))).toBe(exportFailed);
    expect(translate("en", errorKey(new ActionError("Offline", "SIX answered 429"), "schedule.exportFailed"))).toBe(
      "Couldn't connect just now. Try again in a moment.",
    );
  });
});
