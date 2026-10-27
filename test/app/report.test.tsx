// @vitest-environment jsdom
// "Laporkan masalah" (ADR 0007) as the Student sees it: from where the app says something went
// wrong, what will be sent, in plain words (the engine's own and the page itself folded away), before
// anything is; then LINE or GitHub, side by side, and that way one step at a time. The real engine
// against the pretend SIX and Edunex, and main's real report handlers; only Downloads, the browser
// and the file manager are pretend.
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { windowError } from "../../src/app/window-errors";
import { openApp } from "./harness";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

const BILLS = /\/keuangan$/;
const dialog = () => document.querySelector("[role=dialog]")?.textContent ?? "";
const reportFile = /^edunex-plus-report-\d{4}-\d\d-\d\d-\d{4}\.json$/;
const isPrimary = (name: string | RegExp) => screen!.button(name).className.includes("bg-accent");

async function note(text: string) {
  await act(async () => {
    const box = document.querySelector<HTMLTextAreaElement>("[role=dialog] textarea")!;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(box, text);
    box.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** Radix tabs switch on mouse down. */
async function tab(name: string) {
  const trigger = screen!.button(name);
  await act(async () => {
    trigger.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
  });
}

describe("reporting a SIX page the app couldn't read, on LINE", () => {
  it("says in plain words what goes, sends nothing until asked, then walks through the steps one at a time", async () => {
    const s = (screen = await openApp({ signedIn: true, six: true }));
    s.world.six.changeLayout(BILLS, "<th class='text-left'>Semester</th>", "<th>Periode</th>");
    await s.engineDoes(() => s.engine.refresh("six"));
    await s.click(/^Rencana studi/);
    await tab("UKT");
    expect(s.text()).toContain("SIX mengubah halaman ini");

    await s.click("Laporkan masalah");
    const shown = dialog();
    expect(shown).toContain("Tidak ada yang terkirim sebelum kamu memilih caranya.");
    expect(shown).toContain(
      "SIX mengubah halaman UKTHalaman ini ikut dikirim. Nama, NIM, kontak, dan tautan diganti, nilai dan jumlah uang diganti angka karangan.",
    );
    expect(shown).toContain("Edunex Plus 2.0.0-test di macOS 15.3 (arm64)");
    expect(shown).toContain("Kirim lewat LINEKe arqilasp12, pengelola aplikasi. Hanya pengelola yang membacanya.");
    expect(shown).toContain("Buka di GitHubButuh akun GitHub. Laporannya bisa dibaca siapa saja.");
    // The engine's own words, the page's address and the page itself only in the technical details.
    for (const technical of ["SIX finance page", "/keuangan", "<th>"]) expect(shown).not.toContain(technical);
    expect(shown).not.toContain(":");
    expect([s.reports.files, s.reports.opened]).toEqual([[], []]);

    await s.click("Detail teknis");
    expect(dialog()).toContain('SIX finance page: the bills header has no "Semester" column');
    // That the scrubbed page fails the same way, and what it cost: the fees as last read whole.
    expect(dialog()).toContain("Tanpa data pribadimu pun, halaman ini masih gagal dibaca dengan cara yang sama.");
    expect(dialog()).toMatch(/six\.bills · Terakhir terbaca utuh /);
    expect(dialog()).toContain("/keuangan");
    expect(document.querySelector("[role=dialog] pre")?.textContent).toContain("<th>Periode</th>");
    await s.click("Detail teknis");

    await note("membuka tab UKT");
    await s.click(/^Kirim lewat LINE/);
    // The file is the message: saved, with the note in it. Nothing opens until asked.
    const [file] = s.reports.files;
    expect(file!.name).toMatch(reportFile);
    expect(JSON.parse(file!.text)).toMatchObject({
      format: 2,
      os: "macOS 15.3 (arm64)",
      note: "membuka tab UKT",
      problems: [{ feed: "six.bills", kind: "changed", pages: [{ system: "six", path: "/app/mahasiswa:18223901/keuangan" }] }],
    });
    expect(s.reports.opened).toEqual([]);
    expect(s.copied).toEqual([]);
    const steps = dialog();
    expect(steps).toContain(`Berkas laporan sudah disimpan, selesai${file!.name}`);
    expect(steps).toMatch(/\d+ KBTampilkan di Finder/);
    // Adding the maintainer: the code LINE's own page shows on a computer, or the ID to search for.
    expect(steps).toContain("2Tambahkan arqilasp12 di LINEPindai kode ini dengan LINE di HP, atau cari ID arqilasp12. Sudah berteman? Lewati langkah ini.");
    expect(document.querySelector("[role=dialog] svg[aria-label='Kode QR untuk menambahkan arqilasp12 di LINE']")).not.toBeNull();
    expect(steps).toContain(
      "3Kirim berkasnya di chat dengan arqilasp12Di LINE komputer, seret berkasnya ke chat. LINE cuma di HP? Pindahkan berkasnya ke HP dulu, lewat AirDrop, email, atau Drive.",
    );
    expect(steps).not.toContain(":");
    expect(steps).not.toContain("@arqilasp12");
    // Nothing for the app to open: "Selesai" is the one thing to press, the file's folder the way to find it.
    expect(isPrimary("Selesai")).toBe(true);
    expect(isPrimary("Tampilkan di Finder")).toBe(false);
    await s.click("Tampilkan di Finder");
    expect(s.reports.revealed).toEqual([`/Users/dimas/Downloads/${file!.name}`]);
    expect(s.reports.opened).toEqual([]);

    // Back to what's sent, the note kept; the same file is written again, not another one.
    await s.click("Kembali");
    expect(document.querySelector<HTMLTextAreaElement>("[role=dialog] textarea")?.value).toBe("membuka tab UKT");
    await s.click(/^Kirim lewat LINE/);
    expect(s.reports.files.map((saved) => saved.name)).toEqual([file!.name]);

    await s.click("Selesai");
    expect(document.querySelector("[role=dialog]")).toBeNull();
  });
});

describe("reporting Edunex changing something, on GitHub", () => {
  it("from the banner and the status panel; GitHub opens on the Student's click, filled in, through Edunex's form", async () => {
    const s = (screen = await openApp({ signedIn: true }));
    s.world.edunex.mangle(/^\/course\/presences\/list$/, { kind: "missing-field", field: "course_code" });
    await s.engineDoes(() => s.engine.refresh("edunex"));
    expect(s.text()).toContain("Edunex berubah.");

    await s.click(/^(Status data|Data status):/);
    expect([...document.querySelectorAll("[role=dialog] button")].map((button) => button.getAttribute("aria-label"))).toContain("Laporkan masalah");
    await s.key("Escape");

    await s.click("Laporkan masalah");
    expect(dialog()).toContain("Edunex mengubah data mata kuliahHalaman ini ikut dikirim.");
    await note("membuka Beranda");
    await s.click(/^Buka di GitHub/);
    const [file] = s.reports.files;
    expect(file!.name).toMatch(reportFile);
    expect(s.reports.opened).toEqual([]);
    expect(dialog()).toContain(
      "2Buka laporan baru di GitHubIsinya sudah terisi. Kamu perlu masuk ke GitHub.Buka GitHub3Seret berkasnya ke kotak terakhir, lalu kirim",
    );
    expect(dialog()).not.toContain(":");
    expect(isPrimary("Buka GitHub")).toBe(true);
    expect(isPrimary("Selesai")).toBe(false);

    await s.click("Buka GitHub");
    const issue = new URL(s.reports.opened[0]!);
    expect(`${issue.origin}${issue.pathname}`).toBe("https://github.com/pablonification/edunex-plus/issues/new");
    expect(issue.searchParams.get("template")).toBe("edunex-drift.yml");
    expect(issue.searchParams.get("title")).toBe("Edunex mengubah data mata kuliah");
    expect(issue.searchParams.get("report")).toMatch(
      /^Edunex mengubah data mata kuliah\.\n` \/course\/presences\/list: 0\.course_code .+ `\n\nEdunex Plus 2\.0\.0-test di macOS 15\.3 \(arm64\)$/,
    );
    expect(issue.searchParams.get("doing")).toBe("membuka Beranda");
    expect(dialog()).toContain("Buka laporan baru di GitHub, selesai");
    expect(isPrimary("Buka lagi")).toBe(false);
    expect(isPrimary("Selesai")).toBe(true);
  });
});

describe("reporting from Settings", () => {
  it("with nothing the app couldn't read, says so; what the app did goes along, in a file on GitHub too, and the bug form opens", async () => {
    const s = (screen = await openApp({ signedIn: true }));
    await s.apply({ type: "command", command: "settings" });
    await s.click("Laporkan masalah");
    expect(dialog()).not.toContain("Pengaturan");
    expect(dialog()).toContain("Saat ini tidak ada halaman yang gagal dibaca.");
    expect(dialog()).toContain("Yang dilakukan aplikasi sejam terakhir juga ikut dikirim, tanpa data pribadimu.");
    await note("jadwal hari Senin kosong");

    await s.click(/^Buka di GitHub/);
    const [file] = s.reports.files;
    expect(JSON.parse(file!.text)).toMatchObject({
      problems: [],
      log: expect.arrayContaining([expect.objectContaining({ area: "edunex.account", message: "ok" })]),
    });
    expect(dialog()).toContain("2Buka laporan baru di GitHub");
    expect(dialog()).toContain("3Seret berkasnya ke kotak terakhir, lalu kirim");
    await s.click("Buka GitHub");
    const issue = new URL(s.reports.opened[0]!);
    expect(issue.searchParams.get("template")).toBe("bug.yml");
    expect(issue.searchParams.get("what")).toBe("Edunex Plus 2.0.0-test di macOS 15.3 (arm64)");
    expect(issue.searchParams.get("steps")).toBe("jadwal hari Senin kosong");

    await s.click("Kembali");
    await s.click(/^Kirim lewat LINE/);
    expect(JSON.parse(s.reports.files[0]!.text)).toMatchObject({ problems: [], note: "jadwal hari Senin kosong" });
  });
});

describe("a row the app left out, in a report", () => {
  it("shows the row as SIX wrote it, its real shape, whether the scrubbed page still leaves it out, and what it cost", async () => {
    const s = (screen = await openApp({ signedIn: true, six: true }));
    s.world.six.changeLayout(/\/statusmhs$/, "<td>PL3002</td>", "<td>PL-3002</td>");
    await s.engineDoes(() => s.engine.refresh("six"));
    await s.apply({ type: "command", command: "settings" });
    await s.click("Laporkan masalah");
    expect(dialog()).toContain("1 baris di halaman status mahasiswa belum dikenali");
    await s.click("Detail teknis");
    expect(dialog()).toContain("Tanpa data pribadimu pun, halaman ini masih gagal dibaca dengan cara yang sama.");
    expect(dialog()).toMatch(/six\.courses · 1 baris belum dikenali · Terakhir terbaca utuh /);
    expect(dialog()).toContain("Bentuk asli barisnya: 9 · a-9 · a a a a a · 9 · 9 · 9.9%");
    const code = [...document.querySelectorAll("[role=dialog] pre")].map((pre) => pre.textContent);
    expect(code).toContain(
      `<tr><th></th><th>Kode</th><th>Mata Kuliah</th><th class="text-center">Kelas</th><th class="text-center">SKS</th><th class="text-right">Kehadiran</th><th class="text-center">Nilai</th></tr>\n<tr><th scope="row" class='text-right'>4</th><td>PL-3002</td><td>Ekonomi dan Inovasi dalam Perencanaan</td><td class="text-center">01</td><td class="text-center">3</td><td class="text-right"><span title="Hadir 6 dari 7 pertemuan">85.71%</span></td><td class="text-center"></td></tr>`,
    );
  });
});

describe("what the app did, in a report", () => {
  it("the window's own errors reach it, and the report shows it under the technical details", async () => {
    const s = (screen = await openApp({ signedIn: true }));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    // A panel breaks, and something the window started fails with nobody to catch it.
    const good = s.store.dataset("edunex.courses")!;
    await s.apply({ type: "dataset", dataset: { ...good, value: { not: "a list" }, hash: "broken" } });
    await act(async () => {
      window.dispatchEvent(Object.assign(new Event("unhandledrejection"), { reason: new TypeError("fetch failed") }));
    });
    await s.apply({ type: "dataset", dataset: good });
    quiet.mockRestore();

    await s.apply({ type: "command", command: "settings" });
    await s.click("Laporkan masalah");
    await s.click("Detail teknis");
    const shown = [...document.querySelectorAll("[role=dialog] pre")].map((pre) => pre.textContent).join("\n");
    expect(shown).toMatch(/error {2}window {2}panel in [\w:-]+: TypeError: /);
    expect(shown).toContain("error  window  rejection: TypeError: fetch failed");
    expect(shown).toContain("info  edunex.account  ok");
  });

  it("a panel that breaks as the window first draws reaches it too", async () => {
    // Before the window is connected to main: a crash guard catching on the very first draw.
    windowError("panel", new TypeError("courses is not iterable"), "sidebar");
    const s = (screen = await openApp({ signedIn: true }));
    expect(s.log.entries().map((entry) => entry.message)).toContain("panel in sidebar: TypeError: courses is not iterable");
  });
});
