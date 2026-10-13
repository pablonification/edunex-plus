// @vitest-environment jsdom
// Seam 2: signing in, as the app's window tells it. Once Microsoft hands back,
// the sign-in window is out of sight and the app says it's finishing (or that
// it's slow, with the window back). Right after Edunex, SIX comes along by
// itself on the same Microsoft sign-in, or stays one click away as before.
import { afterEach, describe, expect, it } from "vitest";
import { openApp } from "./harness";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

const signInCalls = () => screen!.calls.filter((call) => call.name === "auth.signIn").map((call) => call.input);

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

  it("connects SIX by itself right after Edunex when Microsoft remembers the Student", async () => {
    screen = await openApp({ firstScan: true, microsoft: "remembers" });
    await screen.click("Hubungkan Edunex");
    expect(screen.text()).toContain("Dimas Pratama · 18223901");
    expect(screen.text()).toContain("Dimas Pratama · Sistem dan Teknologi Informasi");
    expect(screen.has("Hubungkan SIX")).toBe(false);
    // The Student pressed one button: SIX's sign-in never asked them for anything.
    expect(signInCalls()).toEqual([{ source: "edunex" }]);
    expect(screen.text()).not.toContain("SIX bisa dihubungkan nanti");
    await screen.click("Lanjut");
    await screen.wait(60_000);
    expect(await screen.sourceState("SIX")).toBe("Terhubung");
  });

  it("leaves SIX's own Hubungkan as it was when Microsoft wants the Student again", async () => {
    screen = await openApp({ firstScan: true, microsoft: "asks" });
    await screen.click("Hubungkan Edunex");
    expect(screen.text()).toContain("Dimas Pratama · 18223901");
    expect(screen.has("Hubungkan SIX")).toBe(true);
    expect(screen.text()).toContain("SIX bisa dihubungkan nanti dari Pengaturan");
    expect(screen.text()).not.toContain("ikut terhubung");

    await screen.click("Hubungkan SIX");
    expect(signInCalls()).toEqual([{ source: "edunex" }, { source: "six" }]);
    expect(screen.text()).toContain("Dimas Pratama · Sistem dan Teknologi Informasi");
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
  it("brings SIX back too, and says so in a word", async () => {
    screen = await openApp({ signedIn: true, six: true, microsoft: "remembers" });
    screen.world.edunex.expireSession();
    screen.world.six.expireSession();
    await screen.engineDoes(() => screen!.engine.refresh());
    expect(screen.text()).toContain("Sesi Edunex berakhir.");
    screen.world.edunex.sessionValid = true;
    screen.world.six.sessionValid = true;

    // The note is a toast that leaves after a few seconds: keep everything that showed while SIX was read.
    const shown: string[] = [];
    const watch = new MutationObserver(() => shown.push(screen!.text()));
    watch.observe(document.body, { subtree: true, childList: true, characterData: true });
    await screen.click("Masuk lagi");
    watch.disconnect();
    expect(signInCalls()).toEqual([{ source: "edunex" }]);
    expect(shown.some((text) => text.includes("SIX ikut terhubung, tanpa masuk lagi"))).toBe(true);
    expect(screen.text()).not.toContain("Sesi SIX berakhir");
    expect(await screen.sourceState("Edunex")).toBe("Terhubung");
    expect(await screen.sourceState("SIX")).toBe("Terhubung");
  });

  it("doesn't bring back a SIX the Student signed out of", async () => {
    screen = await openApp({ signedIn: true, six: true, microsoft: "remembers" });
    await screen.engineDoes(() => screen!.engine.signOut("six"));
    screen.world.edunex.expireSession();
    await screen.engineDoes(() => screen!.engine.refresh("edunex"));
    screen.world.edunex.sessionValid = true;
    await screen.click("Masuk lagi");
    expect(await screen.sourceState("SIX")).toBe("Belum masuk");
    expect(screen.text()).not.toContain("ikut terhubung");
  });

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
