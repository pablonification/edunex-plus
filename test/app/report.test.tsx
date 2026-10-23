// @vitest-environment jsdom
// "Laporkan masalah" (ADR 0007) as the Student sees it: from where the app says something went
// wrong, what will be sent (the app, the page, the check, the scrubbed page) before anything is,
// then GitHub or the maintainer's LINE, side by side. The real engine against the pretend SIX and
// Edunex, and main's real report handlers; only Downloads, the clipboard and the browser are pretend.
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
const reportFile = /^edunex-plus-report-\d{4}-\d\d-\d\d-\d{4}\.json$/;

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

describe("reporting a SIX page the app couldn't read", () => {
  it("from the screen's note: shows what goes, sends nothing until asked, then LINE gets the summary and the file, with the maintainer's ID said plainly", async () => {
    const s = (screen = await openApp({ signedIn: true, six: true }));
    s.world.six.changeLayout(BILLS, "<th class='text-right'>Pembayaran (Rp)</th>", "<th>Dibayar</th>");
    await s.engineDoes(() => s.engine.refresh("six"));
    await s.click(/^Rencana studi/);
    await tab("UKT");
    expect(s.text()).toContain("SIX mengubah halaman ini");

    await s.click("Laporkan masalah");
    const shown = dialog();
    expect(shown).toContain("Belum ada yang terkirim sampai kamu memilih caranya.");
    expect(shown).toContain("Edunex Plus 2.0.0-test di macOS 15.3 (arm64)");
    expect(shown).toContain("SIX · /keuangan · Tidak bisa dibaca");
    expect(shown).toContain('Yang tidak cocok: SIX finance page: the bills header reads "Semester | Tagihan (Rp) | Dibayar | Batas Pembayaran | Petunjuk"');
    expect(shown).toContain("Nama, NIM, kontak, dan tautan sudah diganti.");
    expect(shown).toContain("Ke LINE pengelola aplikasi: arqilasp12.");
    expect(s.calls.map((call) => call.name)).not.toContain("report.send");
    expect([s.reports.files, s.reports.opened, s.copied]).toEqual([[], [], []]);

    // The page itself, to read through before it goes.
    await s.click("Lihat halamannya");
    expect(document.querySelector("[role=dialog] pre")?.textContent).toContain("<th>Dibayar</th>");

    await note("membuka tab UKT");
    await s.click("Kirim lewat LINE");
    const [file] = s.reports.files;
    expect(file!.name).toMatch(reportFile);
    expect(JSON.parse(file!.text)).toMatchObject({
      format: 1,
      os: "macOS 15.3 (arm64)",
      problems: [{ feed: "six.bills", kind: "changed", pages: [{ system: "six", path: "/app/mahasiswa:18223901/keuangan" }] }],
    });
    expect(s.copied).toEqual([
      [
        "Laporan dari Edunex Plus 2.0.0-test di macOS 15.3 (arm64)",
        "",
        "SIX · /keuangan · Tidak bisa dibaca",
        'SIX finance page: the bills header reads "Semester | Tagihan (Rp) | Dibayar | Batas Pembayaran | Petunjuk"',
        "",
        "Status: Edunex: Terhubung · SIX: Terhubung",
        "",
        "Yang sedang kulakukan: membuka tab UKT",
        "",
        `Halaman yang sudah disamarkan: ${file!.name}`,
      ].join("\n"),
    ]);
    expect(s.reports.opened).toEqual(["https://line.me/ti/p/~arqilasp12"]);
    expect(dialog()).toContain(
      `Lanjutkan di LINELaporannya sudah tersalin. Tempel di chat dengan arqilasp12, lalu kirim juga ${file!.name} dari folder Unduhan.`,
    );
    expect(dialog()).toContain("LINE pengelola aplikasi: arqilasp12. Kalau LINE tidak terbuka, cari ID ini di LINE.");
    // A personal LINE ID: never written as an official account's.
    expect(dialog()).not.toContain("@arqilasp12");

    await s.click("Salin laporan");
    expect(s.copied).toHaveLength(2);
    await s.click("Tampilkan berkas");
    expect(s.reports.revealed).toEqual([`/Users/dimas/Downloads/${file!.name}`]);
    await s.click("Buka LINE");
    expect(s.calls.at(-1)).toEqual({ name: "shell.openExternal", input: { url: "https://line.me/ti/p/~arqilasp12" } });
    await s.click("Selesai");
    expect(document.querySelector("[role=dialog]")).toBeNull();
  });
});

describe("reporting Edunex changing something", () => {
  it("from the banner and the status panel; GitHub opens a new issue through Edunex's form, filled in, and the Student is told to drag the file in", async () => {
    const s = (screen = await openApp({ signedIn: true }));
    s.world.edunex.mangle(/^\/course\/presences\/list$/, { kind: "missing-field", field: "course_code" });
    await s.engineDoes(() => s.engine.refresh("edunex"));
    expect(s.text()).toContain("Edunex berubah.");

    await s.click(/^(Status data|Data status):/);
    expect([...document.querySelectorAll("[role=dialog] button")].map((button) => button.getAttribute("aria-label"))).toContain("Laporkan masalah");
    await s.key("Escape");

    await s.click("Laporkan masalah");
    expect(dialog()).toContain("Edunex · /course/presences/list · Tidak bisa dibaca");
    await s.click("Buka di GitHub");
    const [file] = s.reports.files;
    expect(file!.name).toMatch(reportFile);
    const issue = new URL(s.reports.opened[0]!);
    expect(`${issue.origin}${issue.pathname}`).toBe("https://github.com/pablonification/edunex-plus/issues/new");
    expect(issue.searchParams.get("template")).toBe("edunex-drift.yml");
    expect(issue.searchParams.get("title")).toBe("Edunex · /course/presences/list · Tidak bisa dibaca");
    expect(issue.searchParams.get("report")).toContain(`/course/presences/list: 0.course_code`);
    expect(issue.searchParams.get("report")).toContain(`Halaman yang sudah disamarkan: ${file!.name}`);
    expect(s.copied).toEqual([]);
    expect(dialog()).toContain(`Lanjutkan di GitHubGitHub terbuka di browsermu. Seret ${file!.name} dari folder Unduhan ke laporannya, lalu kirim.`);
  });
});

describe("reporting from Settings", () => {
  it("with nothing the app couldn't read, says so, and GitHub opens the bug form with no file", async () => {
    const s = (screen = await openApp({ signedIn: true }));
    await s.apply({ type: "command", command: "settings" });
    await s.click("Laporkan masalah");
    expect(dialog()).not.toContain("Pengaturan");
    expect(dialog()).toContain("Saat ini tidak ada halaman yang gagal dibaca.");
    expect(document.querySelector("[role=dialog] pre")).toBeNull();
    await s.click("Buka di GitHub");
    const issue = new URL(s.reports.opened[0]!);
    expect(issue.searchParams.get("template")).toBe("bug.yml");
    expect(issue.searchParams.get("what")).toContain("Laporan dari Edunex Plus 2.0.0-test di macOS 15.3 (arm64)");
    expect(s.reports.files).toEqual([]);
    expect(dialog()).toContain("GitHub terbuka di browsermu. Cek laporannya, lalu kirim.");
    expect(s.has("Tampilkan berkas")).toBe(false);
  });
});
