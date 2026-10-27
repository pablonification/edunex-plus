// @vitest-environment jsdom
// Problem reports that go with one click, or by themselves (ADR 0014), as the Student sees them:
// "Kirim" beside LINE and GitHub, "Laporan terkirim. Mau tambah cerita?" after, the question the app
// asks once, and Settings. The real engine and main's handlers against the pretend SIX and relay.
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { openApp } from "./harness";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

const BILLS = /\/keuangan$/;
const dialog = () => document.querySelector("[role=dialog]")?.textContent ?? "";
const card = () => document.querySelector("[data-report-ask]")?.textContent ?? "";

async function type(box: HTMLTextAreaElement, text: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(box, text);
    box.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** SIX changes its fees page, and the app reads it. */
async function feesChange(s: NonNullable<typeof screen>) {
  s.world.six.changeLayout(BILLS, "<th class='text-left'>Semester</th>", "<th>Periode</th>");
  await s.engineDoes(() => s.engine.refresh("six"));
  await s.engineDoes(() => s.engine.reports.idle());
}

describe("Kirim, beside LINE and GitHub", () => {
  it("sends the report shown, with the note; says it went, and adds the Student's story, which is public", async () => {
    const s = (screen = await openApp({ signedIn: true, six: true, relay: true }));
    await s.engine.updateSettings({ reportSending: "ask" });
    await feesChange(s);
    await s.apply({ type: "command", command: "settings" });
    await s.click("Laporkan masalah");
    expect(dialog()).toContain("Kirim langsungKe pengelola aplikasi, tanpa akun. Ringkasannya bisa dibaca siapa saja di GitHub, halamannya tidak.");
    // The note goes on the public issue too, and the box says so.
    expect(dialog()).toContain("Kalau lewat GitHub atau dikirim langsung, ceritamu bisa dibaca siapa saja.");
    expect(s.has(/^Kirim lewat LINE/)).toBe(true);
    expect(s.has(/^Buka di GitHub/)).toBe(true);
    await type(document.querySelector<HTMLTextAreaElement>("[role=dialog] textarea")!, "membuka tab UKT");

    await s.click(/^Kirim langsung/);
    const [sent] = s.world.relay.reports;
    expect(sent!.envelope).toMatchObject({ how: "manual", note: "membuka tab UKT", os: "macOS 15.3 (arm64)", report: { problems: [{ feed: "six.bills" }] } });
    expect(dialog()).toContain("Laporan terkirim");
    expect(dialog()).toContain("Tercatat sebagai #301 di GitHub.");
    expect(dialog()).toContain("Mau tambah cerita?");
    expect(dialog()).toContain("Ceritamu bisa dibaca siapa saja di GitHub.");
    // No file, no account: nothing else to do.
    expect(s.reports.files).toEqual([]);

    await s.click("Lihat di GitHub");
    expect(s.reports.opened).toEqual(["https://github.com/pablonification/edunex-plus/issues/301"]);
    const story = [...document.querySelectorAll<HTMLTextAreaElement>("[role=dialog] textarea")].at(-1)!;
    await type(story, "Tabelnya kosong setelah aku buka.");
    await s.click("Kirim cerita");
    expect(sent!.notes).toEqual(["Tabelnya kosong setelah aku buka."]);
    expect(s.text()).toContain("Ceritamu sudah ditambahkan.");
  });

  it("from Settings with nothing kept, sends what the app did, for a bug report", async () => {
    const s = (screen = await openApp({ signedIn: true, relay: true }));
    await s.apply({ type: "command", command: "settings" });
    await s.click("Laporkan masalah");
    await s.click(/^Kirim langsung/);
    expect(s.world.relay.reports[0]!.envelope.report).toMatchObject({
      problems: [],
      log: expect.arrayContaining([expect.objectContaining({ area: "edunex.account" })]),
    });
    expect(dialog()).toContain("Laporan terkirim");
  });

  it("isn't there while the app has no relay address, and nothing asks or goes by itself", async () => {
    const s = (screen = await openApp({ signedIn: true, six: true }));
    await feesChange(s);
    expect(card()).toBe("");
    await s.apply({ type: "command", command: "settings" });
    expect(s.text()).not.toContain("Kirim laporan sendiri");
    await s.click("Laporkan masalah");
    expect(s.has(/^Kirim langsung/)).toBe(false);
    expect(s.has(/^Kirim lewat LINE/)).toBe(true);
    expect(s.world.relay.requests).toEqual([]);
  });
});

describe("the question the app asks once", () => {
  it("comes the first time the app keeps a problem; sending them by themselves sends it, and it doesn't come back", async () => {
    const s = (screen = await openApp({ signedIn: true, six: true, relay: true }));
    expect(card()).toBe("");
    await feesChange(s);
    expect(card()).toContain("Kirim laporan seperti ini otomatis?");
    expect(card()).toContain("SIX mengubah halaman UKT.");
    await s.click("Kirim otomatis");
    await s.engineDoes(() => s.engine.reports.idle());
    expect(s.engine.snapshot().settings.reportSending).toBe("auto");
    expect(s.world.relay.reports.map((report) => report.envelope.how)).toEqual(["auto"]);
    // What went by itself says so, quietly, and takes a story too.
    expect(card()).toContain("Laporan terkirim");
    const story = document.querySelector<HTMLTextAreaElement>("[data-report-ask] textarea")!;
    await type(story, "Muncul setelah aku buka tab UKT.");
    await s.click("Kirim cerita");
    expect(s.world.relay.reports[0]!.notes).toEqual(["Muncul setelah aku buka tab UKT."]);
    await s.click("Tutup");
    expect(card()).toBe("");

    // Another problem: no question, it simply goes.
    s.world.six.changeLayout(/\/statusmhs$/, "<td>PL3002</td>", "<td>PL-3002</td>");
    await s.engineDoes(() => s.engine.refresh("six"));
    await s.engineDoes(() => s.engine.reports.idle());
    expect(card()).not.toContain("otomatis?");
    expect(s.world.relay.reports).toHaveLength(2);
  });

  it("closed, it asks each time from then on, and opens the report to look at first", async () => {
    const s = (screen = await openApp({ signedIn: true, six: true, relay: true }));
    await feesChange(s);
    await s.click("Tutup");
    expect(s.engine.snapshot().settings).toMatchObject({ reportSending: "ask", reportAsked: true });
    expect(card()).toBe("");

    s.world.six.changeLayout(/\/statusmhs$/, "<td>PL3002</td>", "<td>PL-3002</td>");
    await s.engineDoes(() => s.engine.refresh("six"));
    expect(card()).toContain("1 baris di halaman status mahasiswa belum dikenali");
    expect(card()).toContain("Kirim laporannya ke pengelola aplikasi?");
    await s.click("Lihat laporannya");
    expect(dialog()).toContain("1 baris di halaman status mahasiswa belum dikenali");
    expect(s.world.relay.requests).toEqual([]);
  });
});

describe("Settings", () => {
  it("shows the choice, and what went: when, which page, and its issue", async () => {
    const s = (screen = await openApp({ signedIn: true, six: true, relay: true }));
    await s.engine.updateSettings({ reportSending: "auto" });
    await feesChange(s);
    await s.apply({ type: "command", command: "settings" });
    expect(s.button("Otomatis").getAttribute("aria-checked")).toBe("true");
    expect(s.text()).toContain("Halaman UKT");
    expect(s.text()).toContain("Terkirim otomatis");
    await s.click("Lihat #301 di GitHub");
    expect(s.reports.opened).toEqual(["https://github.com/pablonification/edunex-plus/issues/301"]);

    await s.click("Jangan");
    expect(s.engine.snapshot().settings.reportSending).toBe("never");
  });
});

describe("when the relay can't file it at once, or won't take it", () => {
  it("a report the relay files later still says it went, without a story box", async () => {
    const s = (screen = await openApp({ signedIn: true, six: true, relay: true }));
    await s.engine.updateSettings({ reportSending: "auto", reportAsked: true });
    s.world.relay.answer = "later";
    await feesChange(s);
    expect(card()).toContain("Laporan terkirim");
    expect(card()).toContain("Laporan ini akan tercatat di GitHub sebentar lagi.");
    expect(document.querySelector("[data-report-ask] textarea")).toBeNull();
  });

  it("says in the dialog why Kirim langsung didn't send it, and LINE and GitHub are still there", async () => {
    const s = (screen = await openApp({ signedIn: true, six: true, relay: true }));
    await s.engine.updateSettings({ reportSending: "ask", reportAsked: true });
    await feesChange(s);
    s.world.relay.answer = "busy";
    await s.apply({ type: "command", command: "settings" });
    await s.click("Laporkan masalah");
    await s.click(/^Kirim langsung/);
    expect(dialog()).toContain("Laporan belum bisa diterima sekarang. Coba lagi beberapa menit lagi.");
    expect(s.has(/^Kirim lewat LINE/)).toBe(true);
    expect(s.has(/^Buka di GitHub/)).toBe(true);
  });
});
