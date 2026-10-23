// @vitest-environment jsdom
// What a lecturer changed in a Task, seam 2: the real engine notes each edit
// against the copy it had, and the window says it quietly where it first
// reaches the Student (Beranda's row, the bell), in one line on the Task page,
// and step by step in its History, with the instructions now and before.
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { PretendWorld } from "../pretend/world";
import { openApp } from "./harness";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

const open = async (now?: string) => {
  screen = await openApp({ world: new PretendWorld({ now }), signedIn: true, six: true });
  return screen;
};
const frame = () => act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
const section = (id: string) => document.querySelector(`main section[aria-labelledby="${id}"]`);
const needsRow = (title: string) => [...(section("home-needs")?.querySelectorAll("li") ?? [])].find((li) => li.textContent?.startsWith(title))?.textContent;
const article = () => document.querySelector("main article")?.textContent ?? "";
const history = () => document.querySelector("main aside ol");
const goToTask = async (title: string) => {
  const s = screen!;
  await s.click(/^(Tugas & Ujian|Tasks & Exams)\d*(, (Perlu perhatianmu|Needs you))?$/);
  const row = () => [...document.querySelectorAll<HTMLButtonElement>("main li button")].find((b) => b.textContent?.startsWith(title));
  if (!row()) await s.click(/^(Selesai|Done)/);
  await s.click(row()!);
};
/** The recorded Thursday: the lecturer rewrites Tugas 01 Bab I's instructions, moves its deadline and adds a file, weeks after it was handed in. */
const reviseBab1 = async () => {
  const s = screen!;
  s.world.edunex.editTask(117001, {
    end_at: "2026-10-12T23:59:00+07:00",
    description: "<p>Kumpulkan ulang Bab I yang sudah direvisi memakai template terbaru.</p><p>Format berkas PDF.</p>",
    files: [{ name: "brief-v2.pdf", file: "https://edunexfixture.blob.core.windows.net/edunex/fixture-brief-v2" }],
  });
  await s.engineDoes(() => s.engine.refresh("edunex"));
};

describe("a change after hand-in", () => {
  it("Beranda's row and the bell say how many things changed, not which", async () => {
    const s = await open();
    await reviseBab1();
    expect(needsRow("Tugas 01 Bab I")).toContain("Diubah dosen setelah kamu kumpulkan · 3 perubahan");
    await s.click(/^Notifikasi/);
    const bell = document.querySelector("[role=dialog]")?.textContent ?? "";
    expect(bell).toContain("Diubah setelah kamu kumpulkan · II4091");
    expect(bell).toContain("Tugas 01 Bab I · 3 perubahan · cek apakah perlu dikumpulkan ulang");
  });

  it("the Task page says it in one line; the instructions stay clean; 'Lihat perubahannya' opens the edit's step in History", async () => {
    const s = await open();
    await reviseBab1();
    await goToTask("Tugas 01 Bab I");
    expect(article()).toMatch(/Dosen mengubah tugas ini pada 8 Okt, setelah kamu mengumpulkan pada \d+ Sep\. Lihat perubahannya/);
    // The instructions are the lecturer's, as they are now: no marks in them.
    expect(document.querySelector("main article ins, main article del")).toBeNull();
    expect(article()).toContain("Kumpulkan ulang Bab I yang sudah direvisi memakai template terbaru.");

    await s.click("Lihat perubahannya");
    await frame();
    const step = document.activeElement as HTMLElement;
    expect(history()?.contains(step)).toBe(true);
    expect(step.getAttribute("aria-expanded")).toBe("true");
    const lines = [...(history()?.querySelectorAll("ul li") ?? [])].map((li) => li.textContent);
    expect(lines).toEqual([
      expect.stringMatching(/^Tenggat: .+ → Sen, 12 Okt, 23:59Tenggat dari .+ menjadi Sen, 12 Okt, 23:59$/),
      "Instruksi diubahLihat sekarang dan sebelumnya",
      expect.stringMatching(/^Berkas baru: brief-v2\.pdf/),
    ]);
    expect(history()?.textContent).toContain("Jawabanmu sudah final di Edunex. Kalau perubahan ini meminta jawaban baru, minta dosen membuka lagi jawabanmu.");
  });

  it("the instructions now and before, each whole; a changed paragraph has a quiet edge, said to screen readers", async () => {
    const s = await open();
    await reviseBab1();
    await goToTask("Tugas 01 Bab I");
    await s.click("Lihat perubahannya");
    await s.click("Lihat sekarang dan sebelumnya");
    const dialog = document.querySelector("[role=dialog]")!;
    expect(dialog.querySelector("h2")?.textContent).toBe("Instruksi diubah 8 Okt");
    const [now, before] = [...dialog.querySelectorAll("section")];
    expect(now?.textContent).toContain("SekarangBagian yang berubah: Kumpulkan ulang Bab I yang sudah direvisi memakai template terbaru.");
    expect(before?.querySelector("h3")?.textContent).toBe("Sebelumnya");
    expect(before?.textContent).not.toContain("template terbaru");
    expect(dialog.querySelector("ins, del, mark")).toBeNull();
  });

  it("'Sudah kucek' quiets it everywhere until the next edit, with Undo", async () => {
    const s = await open();
    await reviseBab1();
    await goToTask("Tugas 01 Bab I");
    await s.click("Sudah kucek: Tugas 01 Bab I · II4091");
    expect(article()).not.toContain("Dosen mengubah tugas ini");
    expect(article()).toMatch(/Sudah dicek hari ini, \d\d:\d\dUrungkan/);
    // History keeps the story.
    expect(history()?.textContent).toContain("Diubah dosen");
    await s.click(/^Urungkan: Sudah dicek/);
    expect(article()).toContain("Dosen mengubah tugas ini");
  });
});

describe("other edits", () => {
  it("nothing compared changed: no row, a quiet grey line on the page, and the bell lists it quietly", async () => {
    const s = await open();
    s.world.edunex.editTask(117432, {});
    await s.engineDoes(() => s.engine.refresh("edunex"));
    expect(needsRow("Tugas tentang Imfact")).toBeUndefined();
    await goToTask("Tugas tentang Imfact");
    expect(article()).toContain("Edunex menandai tugas ini berubah pada 8 Okt, tetapi tenggat, instruksi, berkas, dan aturan pengumpulannya tetap sama.");
    expect(s.has("Sudah kucek: Tugas tentang Imfact on Innovation The Economy  Kampus Ganesha · PL3002")).toBe(false);
    expect(history()?.textContent).toContain("Tenggat, instruksi, dan berkas sama");
    await s.click(/^Notifikasi/);
    expect(document.querySelector("[role=dialog]")?.textContent).toContain("Tugas ditandai berubah · PL3002");
  });

  it("before hand-in: a moved deadline is named on the row and gets a blue notice; a new title alone is History's", async () => {
    const s = await open();
    s.world.edunex.moveDeadline(117003, "2026-10-13T23:59:00+07:00");
    s.world.edunex.editTask(117010, { name: "Tugas 03 Bab III (judul baru)" });
    await s.engineDoes(() => s.engine.refresh("edunex"));
    expect(needsRow("Tugas 02 Bab II")).toContain("Diubah dosen · tenggat dimajukan ke Sel, 13 Okt");
    await goToTask("Tugas 02 Bab II");
    expect(article()).toContain("Dosen mengubah tugas ini pada 8 Okt. Lihat perubahannya");
    expect(document.querySelector("main article .bg-info-bg")).toBeTruthy();

    await goToTask("Tugas 03 Bab III (judul baru)");
    expect(article()).not.toContain("Dosen mengubah tugas ini");
    await s.click(history()!.querySelector<HTMLElement>("button[aria-expanded]")!);
    expect(history()?.textContent).toContain("Judul: Tugas 03 Bab III → Tugas 03 Bab III (judul baru)");
  });

  it("speaks English", async () => {
    const s = await open();
    await s.engineDoes(() => s.engine.updateSettings({ lang: "en" }));
    await reviseBab1();
    await goToTask("Tugas 01 Bab I");
    expect(article()).toMatch(/Your lecturer changed this Task on 8 Oct, after you submitted on \d+ Sept?\. See what changed/);
    await s.click("See what changed");
    expect(history()?.textContent).toContain("File added: brief-v2.pdf");
  });
});
