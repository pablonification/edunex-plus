// @vitest-environment jsdom
// Seam 2: signing in, as the app's window tells it. Once Microsoft hands back,
// the sign-in window is out of sight and the app says it's finishing (or that
// it's slow, with the window back).
import { afterEach, describe, expect, it } from "vitest";
import { openApp } from "./harness";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

describe("first run", () => {
  it("says the sign-in is finishing while its window is out of sight, and what to do when it's slow", async () => {
    screen = await openApp({ firstScan: true });
    await screen.apply({ type: "signIn", source: "edunex", step: "finishing" });
    expect(screen.text()).toContain("Menyelesaikan masuk ke Edunex…");
    expect(screen.text()).not.toContain("Masuk di jendela Microsoft");

    await screen.apply({ type: "signIn", source: "edunex", step: "slow" });
    expect(screen.text()).toContain("Edunex lambat menyelesaikan masuk");
    expect(screen.text()).toContain("Jendela masuknya terbuka lagi: tunggu di sana, atau tutup lalu coba lagi.");

    await screen.apply({ type: "signIn", source: "edunex", step: null });
    expect(screen.text()).not.toContain("lambat");
    expect(screen.text()).toContain("Tugas, materi, presensi, unggahan dosen");
  });

  it("reads the same in English", async () => {
    screen = await openApp({ firstScan: true });
    await screen.engineDoes(() => screen!.engine.updateSettings({ lang: "en" }));
    await screen.apply({ type: "signIn", source: "six", step: "finishing" });
    expect(screen.text()).toContain("Finishing signing in to SIX…");
    await screen.apply({ type: "signIn", source: "six", step: "slow" });
    expect(screen.text()).toContain("SIX is slow to finish signing in");
    expect(screen.text()).toContain("Its sign-in window is open again: wait there, or close it and try again.");
  });
});

describe("signing in again later", () => {
  it("Settings says the sign-in is finishing, then slow", async () => {
    screen = await openApp({ signedIn: true, six: true });
    screen.world.edunex.expireSession();
    await screen.engineDoes(() => screen!.engine.refresh("edunex"));
    await screen.apply({ type: "command", command: "settings" });
    await screen.apply({ type: "signIn", source: "edunex", step: "finishing" });
    const dialog = () => document.querySelector("[role=dialog]")?.textContent ?? "";
    expect(dialog()).toContain("Menyelesaikan masuk ke Edunex…");
    await screen.apply({ type: "signIn", source: "edunex", step: "slow" });
    expect(dialog()).toContain("Edunex lambat menyelesaikan masuk");
    // The banner over every screen says it too.
    expect(screen.text()).toContain("Sesi Edunex berakhir. Edunex lambat menyelesaikan masuk");
  });
});
