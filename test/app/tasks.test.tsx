// @vitest-environment jsdom
// v2-04 (#72), seam 2: Tugas & Ujian and the Task page as the Student sees
// them, with the real engine and the pretend Edunex behind the bridge.
import { afterEach, describe, expect, it } from "vitest";
import { PretendWorld } from "../pretend/world";
import { openApp } from "./harness";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

const open = async (now?: string) => {
  screen = await openApp({ signedIn: true, world: new PretendWorld({ now }) });
  return screen;
};
// The Task lists; the exam list above them has its own tests (exam.test.tsx).
const sections = () => [...document.querySelectorAll("main section:not([aria-labelledby=tasks-exams]) h2")].map((h) => h.textContent!);
const row = (title: string) => [...document.querySelectorAll<HTMLButtonElement>("main li button")].find((b) => b.textContent?.startsWith(title));
// An exam's row: its take-home Task is folded into it.
const examRow = (text: string) => [...document.querySelectorAll<HTMLButtonElement>("main li button")].find((b) => b.textContent?.includes(text));
const card = () => document.querySelector("main aside")?.textContent ?? "";
const goToTask = async (s: NonNullable<typeof screen>, title: string) => {
  await s.click(/^Tugas & Ujian\d*$/);
  if (!row(title)) await s.click(/^Selesai/);
  if (!row(title)) await s.click(/^Belum selesai/);
  if (!row(title) && examRow(`Take-home: ${title}`)) {
    // A take-home exam opens from its exam's page.
    await s.click(examRow(`Take-home: ${title}`)!);
    const card = [...document.querySelectorAll<HTMLButtonElement>("main button")].find((b) => b.textContent?.includes(title));
    if (!card) throw new Error(`No take-home card ${title}`);
    await s.click(card);
    return;
  }
  const target = row(title);
  if (!target) throw new Error(`No Task row ${title}`);
  await s.click(target);
};

describe("Tugas & Ujian", () => {
  it("lists every Task to hand in by when it's due, with its course, module and true status", async () => {
    const s = await open();
    await s.click(/^Tugas & Ujian\d*$/);
    // The counts sit in the segments; no subtitle repeats them.
    expect(s.button(/^Belum selesai/).textContent).toBe("Belum selesai 5");
    expect(s.button(/^Selesai/).textContent).toBe("Selesai 5");
    expect(sections()).toEqual(["Minggu depan 1", "Nanti 3"]);
    const bab2 = row("Tugas 02 Bab II")!.textContent;
    expect(bab2).toContain("II4091 · Modul 5 · Tugas");
    expect(bab2).toContain("Belum dikerjakan");
    expect(bab2).toContain("Jum, 16 Okt, 23:59");
    // The late rule and edits before handing in belong on the Task page, not on every row.
    expect(bab2).not.toContain("Boleh terlambat");
    expect(bab2).not.toContain("Diubah dosen");
    // The take-home UTS is one thing with its exam, not a second row.
    expect(row("UTS Markom")).toBeUndefined();
    expect(examRow("Take-home: UTS Markom")!.textContent).toContain("Take-home: UTS Markom · tenggat Kam, 22 Okt, 23:50");
  });

  it("a long Task title wraps rather than being cut, and shows whole on hover", async () => {
    const s = await open();
    await s.click(/^Tugas & Ujian\d*$/);
    // The Task lists (the exam list above has its own rows).
    const titles = [...document.querySelectorAll<HTMLElement>("main section:not([aria-labelledby=tasks-exams]) li button .line-clamp-2")];
    expect(titles.length).toBe(4);
    for (const title of titles) {
      expect(title.className).not.toContain("truncate");
      expect(title.title).toBe(title.textContent);
    }
  });

  it("filters by course, and hides the groups a course has nothing in", async () => {
    const s = await open();
    await s.click(/^Tugas & Ujian\d*$/);
    await s.click("PL3002");
    expect(row("Tugas Mandiri Individu")).toBeDefined();
    expect(row("Tugas 02 Bab II")).toBeUndefined();
    expect(sections()).toEqual(["Nanti 1"]);
    expect(document.querySelector("[aria-labelledby=tasks-exams]")).toBeNull();
    // The choice stays while the app runs.
    await s.click(/^Beranda/);
    await s.click(/^Tugas & Ujian\d*$/);
    expect(row("Tugas 02 Bab II")).toBeUndefined();
    await s.click("Semua");
    expect(row("Tugas 02 Bab II")).toBeDefined();
  });

  it("shows what was handed in, loudly when the lecturer changed it afterwards, and a short window", async () => {
    const s = await open();
    await s.click(/^Tugas & Ujian\d*$/);
    await s.click(/^Selesai/);
    expect(sections()).toEqual(["Terkumpul 5"]);
    expect(row("Tugas 01 Bab I")!.textContent).toContain("Diubah setelah kamu kumpulkan (22 Sep) · cek lagi");
    expect(row("Tugas 01 Bab I")!.textContent).toContain("Dikumpulkan");
    expect(row("Tugas 01 Bab I")!.textContent).toContain("Terkumpul");
    expect(row("Tugas Problem Soving")!.textContent).toContain("Waktu singkat · 16:01–19:01");
  });

  it("a Task whose hand-in is the class's attendance says so, with the Presence window, in the list and on its page", async () => {
    const s = await open();
    await s.click(/^Tugas & Ujian\d*$/);
    // II4091's Presence on Friday is set to Answer Assignment: handing in Tugas 02 inside 15:00–23:59 is the attendance.
    expect(row("Tugas 02 Bab II")!.textContent).toContain("Juga presensi: Jum, 16 Okt 15:00–23:59");
    expect(row("Tugas Mandiri Individu")!.textContent).not.toContain("presensi");
    await s.click(row("Tugas 02 Bab II")!);
    expect(s.text()).toContain("Tugas ini sekaligus Presensi-mu: hanya terhitung jika dikumpulkan di dalam jendelanya, Jum, 16 Okt, 15:00–23:59.");
  });

  it("counts the Tasks to hand in next to Tugas & Ujian in the sidebar", async () => {
    const s = await open();
    expect(s.button(/^Tugas & Ujian\d+$/).textContent).toBe("Tugas & Ujian5");
    s.world.edunex.submitOnWebsite(117003);
    await s.engineDoes(() => s.engine.refresh("edunex"));
    expect(s.button(/^Tugas & Ujian\d+$/).textContent).toBe("Tugas & Ujian4");
  });

  it("a new Task appears, and one submitted on the website moves to Selesai", async () => {
    const s = await open();
    await s.click(/^Tugas & Ujian\d*$/);
    s.world.edunex.postTask(95059, { name: "Tugas 1 Infrastruktur" });
    s.world.edunex.submitOnWebsite(117873);
    await s.wait(16 * 60_000);
    expect(row("Tugas 1 Infrastruktur")!.textContent).toContain("PL3032");
    expect(row("Tugas Mandiri Individu")).toBeUndefined();
    await s.click(/^Selesai/);
    expect(row("Tugas Mandiri Individu")!.textContent).toContain("Terkumpul");
  });

  it("past a deadline: overdue first when late answers are allowed; a closed Task under Selesai", async () => {
    const s = await open("2026-10-23T08:00:00+07:00");
    await s.click(/^Tugas & Ujian\d*$/);
    expect(sections()).toEqual(["Terlambat 1", "Minggu depan 1", "Nanti 2"]);
    expect(row("Tugas 02 Bab II")!.textContent).toContain("Terlambat");
    expect(s.button(/^Belum selesai/).textContent).toBe("Belum selesai 4");
    expect(s.button(/^Selesai/).textContent).toBe("Selesai 6");
    await s.click(/^Selesai/);
    expect(sections()).toEqual(["Terkumpul 5", "Ditutup, tidak dikumpulkan 1"]);
    expect(row("UTS Markom")!.textContent).toContain("Tidak dikumpulkan");
  });

  it("speaks English", async () => {
    const s = await open();
    await s.engineDoes(() => s.engine.updateSettings({ lang: "en" }));
    await s.click(/^Tasks & Exams\d*$/);
    expect(s.button(/^To do/).textContent).toBe("To do 5");
    expect(sections()).toEqual(["Next week 1", "Later 3"]);
    expect(examRow("Take-home: UTS Markom")!.textContent).toContain("Take-home: UTS Markom · due Thu, 22 Oct, 23:50");
    expect(row("Tugas 02 Bab II")!.textContent).toContain("Fri, 16 Oct, 23:59");
    expect(row("Tugas 02 Bab II")!.textContent).toContain("Also your attendance: Fri, 16 Oct 15:00–23:59");
  });

  it("before the first Task list arrives, and when it can't: placeholders, then a way to try again", async () => {
    const world = new PretendWorld();
    world.edunex.fail(/^\/course\/tasks$/, 503);
    screen = await openApp({ signedIn: true, world });
    await screen.click(/^Tugas & Ujian\d*$/);
    expect(screen.text()).toContain("Tugas belum bisa dimuat");
    world.edunex.clearFaults();
    await screen.click("Coba lagi");
    expect(row("Tugas 02 Bab II")).toBeDefined();
  });
});

describe("the Task page", () => {
  it("shows the instructions, the lecturer's files to download, the rules and the history", async () => {
    const s = await open();
    await goToTask(s, "UTS Markom");
    expect(document.querySelector("h1")?.textContent).toBe("UTS Markom");
    expect(s.text()).toContain("DK4073Modul 1 · UTS Markom");
    expect(s.text()).toContain("Tenggat Kam, 22 Okt, 23:50");
    expect(s.text()).toContain("Soal lihat .pdf");
    expect(s.text()).toContain("Berkas dari dosen");
    await s.click("Unduh UTS MARKOM SEM 1 2026 2027.pdf");
    expect(s.calls.at(-1)).toEqual({
      name: "files.download",
      input: { url: "https://edunexfixture.blob.core.windows.net/edunex/fixture-8", name: "UTS MARKOM SEM 1 2026 2027.pdf" },
    });
    // The rules sit where they matter: the file rule in the drop zone, the late rule by the deadline.
    expect(card()).toContain("Wajib unggah berkas");
    expect(document.querySelector("article")?.textContent).toContain("Tidak bisa terlambat");
    expect(s.text()).toContain("Bagian dari UTS DK4073");
    const history = [...document.querySelectorAll("main aside ol li")].map((li) => li.textContent);
    expect(history).toEqual(["Diunggah dosenKam, 17 Sep, 08:45", "Diubah dosenKam, 24 Sep, 11:11", "TenggatKam, 22 Okt, 23:50"]);
    // An edit before the Student handed in is history, not a warning.
    expect(s.text()).not.toContain("Diubah dosen pada");
    await s.click("Lihat di Edunex");
    expect(s.calls.at(-1)).toEqual({ name: "shell.openExternal", input: { url: "https://edunex.itb.ac.id/assignment/take/117764" } });
  });

  it("formats the lecturer's instructions safely: no script or markup of Edunex's reaches the page", async () => {
    const s = await open();
    s.world.edunex.editTask(117003, {
      description:
        '<p>Kerjakan <strong>Bab II</strong>.</p><script>window.hacked = true</script><img src=x onerror="window.hacked = true"><a href="javascript:alert(1)">tautan</a>',
    });
    await s.engineDoes(() => s.engine.refresh("edunex"));
    await goToTask(s, "Tugas 02 Bab II");
    const article = document.querySelector("article")!;
    expect(article.textContent).toContain("Kerjakan Bab II.");
    expect(article.querySelector("strong")?.textContent).toBe("Bab II");
    expect(article.querySelector("script, img, [onerror], a[href^=javascript]")).toBeNull();
    expect((window as { hacked?: boolean }).hacked).toBeUndefined();
  });

  it("not started: due when, the attach area, and nothing to submit yet", async () => {
    const s = await open();
    await goToTask(s, "Tugas 02 Bab II");
    expect(card()).toContain("Belum dikerjakan");
    expect(card()).toContain("dalam 8 hari");
    expect(s.has(/^Lampirkan berkas · Lepas berkas di sini/)).toBe(true);
    expect(card()).toContain("Wajib unggah berkas · Berkas PDF");
    expect(s.button("Simpan draf").disabled).toBe(true);
    expect(s.button("Kumpulkan").disabled).toBe(true);
    // A disabled Kumpulkan says why.
    expect(card()).toContain("Lampirkan berkas dulu untuk mengumpulkan.");
    expect(card()).toContain("Draf hanya terlihat olehmu. Kumpulkan untuk menyerahkan.");
    expect(document.querySelector("article")?.textContent).toContain("Boleh terlambat");
  });

  it("draft: not handed in yet, the draft's files listed, ready to submit", async () => {
    const s = await open();
    s.world.edunex.draftOnWebsite(117003, "bab2-draf.pdf");
    await s.engineDoes(() => s.engine.refresh("edunex"));
    await goToTask(s, "Tugas 02 Bab II");
    expect(card()).toContain("DrafTersimpan Hari ini, 08:12 · belum diserahkan");
    expect(card()).toContain("bab2-draf.pdf");
    expect(s.button("Kumpulkan").disabled).toBe(false);
    expect(card()).toContain("Draf hanya terlihat olehmu.");
    const history = [...document.querySelectorAll("main aside ol li")].map((li) => li.textContent);
    expect(history).toContain("Kamu menyimpan drafHari ini, 08:12");
  });

  it("submitted: the receipt from Edunex, the file to download, final", async () => {
    const s = await open();
    await goToTask(s, "Tugas tentang Imfact on Innovation");
    expect(card()).toContain("TerkumpulEdunex mencatatnya Rab, 16 Sep, 15:29");
    expect(card()).toContain("Sudah diserahkan. Pengumpulan bersifat final.");
    expect(s.has(/^Lampirkan berkas/)).toBe(false);
    expect(s.has("Kumpulkan")).toBe(false);
    await s.click("Unduh TUGAS IMPACT ON INNOVATION THE ECONOMY - 18223901.pdf");
    expect(s.calls.at(-1)?.name).toBe("files.download");
    // Edunex never told the Student about this edit.
    expect(s.text()).toContain("Dosen mengubah tugas ini pada 8 Okt, setelah kamu mengumpulkan pada 16 Sep.");
    await s.click("Lihat di Edunex");
    expect(s.calls.at(-1)?.name).toBe("shell.openExternal");
  });

  it("overdue: late answers still taken, with Submit late", async () => {
    const s = await open("2026-10-17T08:00:00+07:00");
    await goToTask(s, "Tugas 02 Bab II");
    expect(card()).toContain("TerlambatMasih bisa dikumpulkan terlambat");
    expect(s.has("Kumpulkan terlambat")).toBe(true);
    expect(s.text()).toContain("Tenggat Kemarin, 23:59");
  });

  it("closed: nothing to hand in any more", async () => {
    const s = await open();
    s.world.edunex.closeTask(117010);
    await s.engineDoes(() => s.engine.refresh("edunex"));
    await goToTask(s, "Tugas 03 Bab III");
    expect(card()).toContain("DitutupPengumpulan sudah ditutup");
    expect(card()).toContain("Tidak ada berkas yang dikumpulkan.");
    expect(s.has(/^Lampirkan berkas/)).toBe(false);
    expect(s.has("Simpan draf")).toBe(false);
  });

  it("in review, then the score once the lecturer shows it", async () => {
    const s = await open();
    s.world.edunex.reviewAnswer(117001);
    await s.engineDoes(() => s.engine.refresh("edunex"));
    await goToTask(s, "Tugas 01 Bab I");
    expect(card()).toContain("Sedang dinilai");
    expect(card()).toContain("Nilai—");
    expect(card()).toContain("Dosen sedang menilai tugas ini.");
    s.world.edunex.publishScore(117001, 88);
    await s.engineDoes(() => s.engine.refresh("edunex"));
    expect(card()).toContain("Terkumpul");
    expect(card()).toContain("Nilai88");
  });

  it("an extended deadline shows at once, with the edit", async () => {
    const s = await open();
    await goToTask(s, "Tugas 02 Bab II");
    await s.wait(3 * 3_600_000);
    s.world.edunex.moveDeadline(117003, "2026-10-20T23:59:00+07:00");
    await s.engineDoes(() => s.engine.refresh("edunex"));
    expect(s.text()).toContain("Tenggat Sel, 20 Okt, 23:59");
    expect([...document.querySelectorAll("main aside ol li")].map((li) => li.textContent)).toContain("Diubah dosenHari ini, 11:12");
  });

  it("a short answer window says how short", async () => {
    const s = await open();
    await goToTask(s, "Tugas Problem Soving");
    expect(s.text()).toContain("Hanya dibuka 3 jam (16:01–19:01).");
  });

  it("a Task that isn't open yet says from when", async () => {
    const s = await open();
    const id = s.world.edunex.postTask(95059, { name: "Tugas Pekan Depan", start_at: "2026-10-12T08:00:00+07:00", end_at: "2026-10-19T23:59:00+07:00" });
    await s.engineDoes(() => s.engine.refresh("edunex"));
    await goToTask(s, "Tugas Pekan Depan");
    expect(id).toBeGreaterThan(0);
    expect(card()).toContain("Dibuka Sen, 12 Okt, 08:00");
    expect(card()).toContain("Bisa dikumpulkan mulai Sen, 12 Okt, 08:00.");
    expect(s.has(/^Lampirkan berkas/)).toBe(false);
  });

  it("a Task removed from Edunex says so, with the way back", async () => {
    const s = await open();
    await goToTask(s, "Tugas 03 Bab III");
    s.world.edunex.tasks.set(
      95326,
      s.world.edunex.tasks.get(95326)!.filter((t) => Number(t.id) !== 117010),
    );
    await s.engineDoes(() => s.engine.refresh("edunex"));
    expect(s.text()).toContain("Tugas ini tidak ditemukan");
    await s.click("Ke Tugas & Ujian");
    expect(s.text()).toContain("Belum selesai");
  });
});
