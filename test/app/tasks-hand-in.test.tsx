// @vitest-environment jsdom
// v2-05 (#73), seam 2: handing a Task in from the window: attach files (the
// system file picker is the only pretend part), save a quiet draft, submit
// with a confirmation, and a receipt only once Edunex says it's submitted.
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { PretendWorld } from "../pretend/world";
import { openApp } from "./harness";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

const ATTACH = /^Lampirkan berkas · Lepas berkas di sini/;
const card = () => document.querySelector("main aside")?.textContent ?? "";
const answerWrites = (s: NonNullable<typeof screen>) =>
  s.world.edunex.writes.filter((w) => w.path.startsWith("/course/task/answers")).map((w) => `${w.method} ${w.path.replace(/\d+$/, ":id")}`);
/** The confirm's submitting button ("Kumpulkan sekarang", "Kumpulkan tetap …", "Kumpulkan terlambat"). */
const confirmButton = () =>
  [...(document.querySelector("[role=alertdialog]")?.querySelectorAll("button") ?? [])].find((b) => b.textContent?.startsWith("Kumpulkan"));

const openTask = async (title: string, now?: string) => {
  const s = await openApp({ signedIn: true, world: new PretendWorld({ now }) });
  screen = s;
  await s.click(/^Tugas & Ujian\d*$/);
  const row = () => [...document.querySelectorAll<HTMLButtonElement>("main li button")].find((b) => b.textContent?.startsWith(title));
  if (!row()) await s.click(/^Selesai/);
  const found = row();
  if (!found) throw new Error(`No Task row ${title}`);
  await s.click(found);
  return s;
};

describe("handing in", () => {
  it("attach, save a draft quietly, then submit with a confirmation and a receipt from Edunex", async () => {
    const s = await openTask("Tugas 02 Bab II");
    s.willPick([{ name: "Bab II.pdf", content: "%PDF bab dua" }]);
    await s.click(ATTACH);
    expect(card()).toContain("Bab II.pdf");
    expect(card()).toContain("Belum disimpan · 12 B");
    // Uploading goes to Edunex's storage; nothing is in the answer yet.
    expect(s.world.edunex.writes.map((w) => w.path)).toEqual(["/blob-storage/sas"]);

    await s.click("Simpan draf");
    // Saved, said inline in the panel (not a toast that follows the Student to the next screen).
    expect(card()).toContain("DrafTersimpan Hari ini, 08:12 · belum diserahkan");
    expect(card()).not.toContain("Belum disimpan");
    expect(answerWrites(s)).toEqual(["POST /course/task/answers", "PATCH /course/task/answers/:id"]);

    await s.click("Kumpulkan");
    const dialog = document.querySelector("[role=alertdialog]");
    expect(dialog?.textContent).toContain("Kumpulkan tugas ini?");
    expect(dialog?.textContent).toContain("Bab II.pdf akan diserahkan ke dosen. Setelah dikumpulkan, jawabanmu final.");
    // Nothing is sent before the Student confirms.
    expect(answerWrites(s)).toHaveLength(2);
    await s.click(confirmButton()!);
    expect(answerWrites(s)).toHaveLength(3);
    expect(s.world.edunex.writes.at(-1)?.body).toEqual({ is_sent: 1 });
    expect(card()).toContain("TerkumpulEdunex mencatatnya Hari ini, 08:12");
    expect(card()).toContain("Sudah diserahkan. Pengumpulan bersifat final.");
    expect(s.has(ATTACH)).toBe(false);
    expect(s.world.edunex.task(117003).attributes.answers).toHaveLength(1);
  });

  it("cancelling the confirmation sends nothing", async () => {
    const s = await openTask("Tugas 02 Bab II", "2026-10-16T16:00:00+07:00");
    s.willPick([{ name: "Bab II.pdf" }]);
    await s.click(ATTACH);
    await s.click("Kumpulkan");
    await s.click("Batal");
    expect(answerWrites(s)).toEqual([]);
    expect(card()).toContain("Belum dikerjakan");
  });

  it("a failed upload keeps the file attached with a clear error, and trying again sends it", async () => {
    const s = await openTask("Tugas 02 Bab II");
    s.world.failUploads(503);
    s.willPick([{ name: "Bab II.pdf" }]);
    await s.click(ATTACH);
    expect(card()).toContain("Bab II.pdf");
    // The whole reason, a labelled way to try again, and why Kumpulkan waits.
    expect(card()).toContain("Edunex tidak menerima unggahan ini (galat di server Edunex). Berkasmu tetap di sini.");
    expect(s.button("Unggah ulang Bab II.pdf").textContent).toBe("Coba lagi");
    expect(s.button("Simpan draf").disabled).toBe(true);
    expect(s.button("Kumpulkan").disabled).toBe(true);
    expect(card()).toContain("Coba lagi atau hapus berkas yang gagal terunggah.");
    await s.click("Unggah ulang Bab II.pdf");
    expect(card()).toContain("Belum disimpan");
    expect(s.button("Kumpulkan").disabled).toBe(false);
  });

  it("no connection while uploading says so, and the file stays", async () => {
    const s = await openTask("Tugas 02 Bab II");
    s.world.failUploads("network");
    s.willPick([{ name: "Bab II.pdf" }]);
    await s.click(ATTACH);
    expect(card()).toContain("Tidak ada koneksi, jadi belum terunggah. Berkasmu tetap di sini.");
  });

  it("several files go up one by one, then all are in the answer", async () => {
    const s = await openTask("Tugas 02 Bab II");
    s.willPick([{ name: "Bab II.pdf" }, { name: "Lampiran.zip", type: "application/zip" }]);
    await s.click(ATTACH);
    expect(s.world.edunex.writes.filter((w) => w.path === "/blob-storage/sas").map((w) => w.body.files[0].fileName)).toEqual(["Bab II.pdf", "Lampiran.zip"]);
    expect(s.world.edunex.writes[1].body.files[0].contentType).toBe("application/zip");
    await s.click("Simpan draf");
    expect(s.world.edunex.task(117003).attributes.answers[0].files.map((f: { name: string }) => f.name)).toEqual(["Bab II.pdf", "Lampiran.zip"]);
  });

  it("a file over 100 MB is refused at once, without uploading", async () => {
    const s = await openTask("Tugas 02 Bab II");
    s.willPick([{ name: "rekaman.mp4", size: 200 * 1024 * 1024 }]);
    await s.click(ATTACH);
    expect(card()).toContain("Lebih dari 100 MB: Edunex tidak menerima berkas sebesar ini");
    expect(s.has(/^Unggah ulang/)).toBe(false);
    expect(s.world.edunex.writes).toEqual([]);
    await s.click("Hapus rekaman.mp4");
    expect(card()).not.toContain("rekaman.mp4");
  });

  it("a file dropped on the window is attached and uploaded", async () => {
    const s = await openTask("Tugas 02 Bab II");
    const zone = s.button(ATTACH);
    const content = new TextEncoder().encode("%PDF dropped");
    const dropped = { name: "Bab II final.pdf", size: content.byteLength, type: "application/pdf", arrayBuffer: async () => content.buffer };
    await act(async () => {
      const event = new Event("drop", { bubbles: true, cancelable: true });
      Object.defineProperty(event, "dataTransfer", { value: { files: [dropped] } });
      zone.dispatchEvent(event);
    });
    await s.wait(0);
    expect(card()).toContain("Bab II final.pdf");
    expect(card()).toContain("Belum disimpan");
    const upload = [...s.world.blobs.values()].at(-1) as Uint8Array;
    expect(Buffer.from(upload).toString()).toBe("%PDF dropped");
  });

  it("a draft saved on the website is updated, never answered twice", async () => {
    const s = await openTask("Tugas 02 Bab II");
    s.world.edunex.draftOnWebsite(117003, "draf-web.pdf");
    // The app hasn't seen that draft yet: saving re-reads Edunex first.
    s.willPick([{ name: "Bab II.pdf" }]);
    await s.click(ATTACH);
    await s.click("Simpan draf");
    expect(answerWrites(s)).toEqual(["PATCH /course/task/answers/:id"]);
    expect(s.world.edunex.task(117003).attributes.answers).toHaveLength(1);
  });

  it("removing a file from a saved draft takes effect when the draft is saved", async () => {
    const s = await openTask("Tugas 02 Bab II");
    s.world.edunex.draftOnWebsite(117003, "salah.pdf");
    await s.engineDoes(() => s.engine.refresh("edunex"));
    s.willPick([{ name: "benar.pdf" }]);
    await s.click(ATTACH);
    await s.click("Hapus salah.pdf");
    await s.click("Simpan draf");
    expect(s.world.edunex.task(117003).attributes.answers[0].files.map((f: { name: string }) => f.name)).toEqual(["benar.pdf"]);
    expect(card()).not.toContain("salah.pdf");
  });

  it("the session ending during a submit says so, keeps the files, and works after signing in again", async () => {
    const s = await openTask("Tugas 02 Bab II");
    s.willPick([{ name: "Bab II.pdf" }]);
    await s.click(ATTACH);
    s.world.edunex.expireSession();
    await s.click("Kumpulkan");
    await s.click(confirmButton()!);
    expect(card()).toContain("Sesi Edunex berakhir. Masuk lagi, lalu coba lagi. Berkasmu tetap terlampir.");
    expect(card()).toContain("Bab II.pdf");
    s.world.edunex.sessionValid = true;
    await s.click("Masuk lagi");
    expect(card()).not.toContain("Sesi Edunex berakhir");
    await s.click("Kumpulkan");
    await s.click(confirmButton()!);
    expect(card()).toContain("Terkumpul");
  });

  it("a Task closed meanwhile: Edunex is asked first, and the page says the answer wasn't sent", async () => {
    const s = await openTask("Tugas 02 Bab II");
    s.willPick([{ name: "Bab II.pdf" }]);
    await s.click(ATTACH);
    s.world.edunex.closeTask(117003);
    await s.click("Kumpulkan");
    await s.click(confirmButton()!);
    expect(card()).toContain("Edunex sudah menutup pengumpulan tugas ini. Jawabanmu tidak terkirim.");
    expect(card()).toContain("Ditutup");
    expect(answerWrites(s)).toEqual([]);
  });

  it("Edunex taking a submit without showing it sent: no receipt, a way to check on Edunex", async () => {
    const s = await openTask("Tugas 02 Bab II");
    s.willPick([{ name: "Bab II.pdf" }]);
    await s.click(ATTACH);
    await s.click("Simpan draf");
    s.world.edunex.fail(/^\/course\/task\/answers\/\d+$/, 200, 1);
    await s.click("Kumpulkan");
    await s.click(confirmButton()!);
    expect(card()).toContain("Edunex menerima permintaanmu, tapi belum menunjukkan perubahannya.");
    expect(card()).toContain("Draf");
    await s.click("Buka di Edunex");
    expect(s.calls.at(-1)).toEqual({ name: "shell.openExternal", input: { url: "https://edunex.itb.ac.id/assignment/take/117003" } });
  });

  it("late allowed: Submit late works past the deadline", async () => {
    const s = await openTask("Tugas 02 Bab II", "2026-10-20T09:00:00+07:00");
    s.willPick([{ name: "Bab II.pdf" }]);
    await s.click(ATTACH);
    await s.click("Kumpulkan terlambat");
    expect(confirmButton()?.textContent).toBe("Kumpulkan terlambat");
    await s.click(confirmButton()!);
    expect(card()).toContain("Terkumpul");
  });

  it("no late answers: past the deadline there's nothing to hand in", async () => {
    const s = await openTask("UTS Markom", "2026-10-23T09:00:00+07:00");
    s.world.edunex.closeTask(117764);
    expect(card()).toContain("Ditutup");
    expect(card()).toContain("Pengumpulan sudah ditutup");
    expect(s.has(ATTACH)).toBe(false);
    expect(s.has("Kumpulkan")).toBe(false);
  });

  it("speaks English, the draft-vs-submitted line included", async () => {
    const s = await openTask("Tugas 02 Bab II");
    await s.engineDoes(() => s.engine.updateSettings({ lang: "en" }));
    expect(card()).toContain("Not started");
    expect(s.has(/^Attach files · Drop files here/)).toBe(true);
    expect(s.has("Save draft")).toBe(true);
    expect(s.has("Submit")).toBe(true);
    expect(card()).toContain("A draft is only visible to you. Submit to hand it in.");
    expect(card()).toContain("File required · PDF file");
    expect(card()).toContain("Attach a file first to hand it in.");
    expect(s.text()).toContain("Late submission allowed");
  });
});

describe("handing in can't cost the Student their attendance", () => {
  const dialogText = () => document.querySelector("[role=alertdialog]")?.textContent ?? "";
  const article = () => document.querySelector("article")?.textContent ?? "";

  it("outside the attendance window the confirm says it won't count, and keeping a draft is the default", async () => {
    // Thu 8 Oct: Tugas 02 counts as attendance only if handed in Fri 16 Oct 15:00–23:59.
    const s = await openTask("Tugas 02 Bab II");
    s.willPick([{ name: "18222001 Dimas - Tugas 02.pdf" }]);
    await s.click(ATTACH);
    // Waiting is the right default: Simpan draf is the main button, and the line under it says why.
    expect(s.button("Simpan draf").className).toContain("bg-accent");
    expect(s.button("Kumpulkan").className).not.toContain("bg-accent");
    expect(card()).toContain("Belum masuk jendela presensi. Simpan draf sekarang, lalu kumpulkan Jum, 16 Okt, 15:00–23:59 agar terhitung hadir.");
    await s.click("Kumpulkan");
    expect(dialogText()).toContain(
      "Belum masuk jendela presensi (Jum, 16 Okt, 15:00–23:59). Kalau dikumpulkan sekarang, tugas terkumpul tapi tidak dihitung hadir.",
    );
    const save = s.button("Simpan sebagai draf");
    expect(save.className).toContain("bg-accent");
    expect(save.className).not.toContain("danger");
    await s.click(save);
    // Kept as a draft: nothing handed in.
    expect(answerWrites(s)).toEqual(["POST /course/task/answers", "PATCH /course/task/answers/:id"]);
    expect(s.world.edunex.writes.some((w) => w.body?.is_sent === 1)).toBe(false);
    expect(card()).toContain("DrafTersimpan");
    expect(card()).toContain("Drafmu aman. Kumpulkan Jum, 16 Okt, 15:00–23:59 agar terhitung hadir.");
  });

  it("handing in anyway outside the window: done, and the page says it didn't count", async () => {
    const s = await openTask("Tugas 02 Bab II");
    s.willPick([{ name: "18222001 Dimas - Tugas 02.pdf" }]);
    await s.click(ATTACH);
    await s.click("Kumpulkan");
    await s.click("Kumpulkan tetap (tidak dihitung hadir)");
    expect(card()).toContain("Terkumpul");
    expect(article()).toContain("Tidak dihitung hadir: dikumpulkan di luar jendela presensi (Jum, 16 Okt, 15:00–23:59).");
    expect(article()).not.toContain("hanya terhitung jika dikumpulkan");
  });

  it("inside the window: the confirm says it counts, the primary button is a blue Kumpulkan sekarang, and the page then says counted", async () => {
    const s = await openTask("Tugas 02 Bab II", "2026-10-16T16:00:00+07:00");
    s.willPick([{ name: "18222001 Dimas - Tugas 02.pdf" }]);
    await s.click(ATTACH);
    expect(s.button("Kumpulkan").className).toContain("bg-accent");
    await s.click("Kumpulkan");
    expect(dialogText()).toContain("Di dalam jendela presensi: terhitung hadir.");
    const submit = s.button("Kumpulkan sekarang");
    expect(submit.className).toContain("bg-accent");
    await s.click(submit);
    expect(article()).toContain("Terhitung hadir: kamu mengumpulkan di dalam jendela presensi (Hari ini, 15:00–23:59).");
  });

  it("a file unlike what the lecturer asked for gets a soft hint, and the confirm names it", async () => {
    const s = await openTask("Tugas 02 Bab II", "2026-10-16T16:00:00+07:00");
    s.willPick([{ name: "Laporan Tugas - Dimas Pratama.pdf" }]);
    await s.click(ATTACH);
    expect(card()).toContain("Dosen minta nama \u2018NIM Nama - Tugas 02.pdf\u2019");
    // A long file name wraps and shows whole on hover; it's never cut with no way to read it.
    const name = [...document.querySelectorAll<HTMLElement>("main aside li span")].find((el) => el.textContent === "Laporan Tugas - Dimas Pratama.pdf")!;
    expect(name.title).toBe("Laporan Tugas - Dimas Pratama.pdf");
    expect(name.className).not.toContain("truncate");
    await s.click("Kumpulkan");
    expect(dialogText()).toContain("Dosen minta nama berkas \u2018NIM Nama - Tugas 02.pdf\u2019.");
  });

  it("no connection: Kumpulkan waits, says why, and offers to try again", async () => {
    const s = await openTask("Tugas 02 Bab II", "2026-10-16T16:00:00+07:00");
    s.willPick([{ name: "18222001 Dimas - Tugas 02.pdf" }]);
    await s.click(ATTACH);
    s.world.setOffline(true);
    await s.engineDoes(() => s.engine.refresh("edunex"));
    expect(s.button("Kumpulkan").disabled).toBe(true);
    expect(card()).toContain("Tidak terhubung ke Edunex. Berkasmu tetap di sini; kumpulkan setelah tersambung lagi.");
    s.world.setOffline(false);
    const retry = [...document.querySelectorAll<HTMLButtonElement>("main aside button")].find((b) => b.textContent === "Coba lagi")!;
    await s.click(retry);
    expect(s.button("Kumpulkan").disabled).toBe(false);
  });

  it("a session that ended: Kumpulkan waits, with Masuk lagi next to the reason", async () => {
    const s = await openTask("Tugas 02 Bab II", "2026-10-16T16:00:00+07:00");
    s.willPick([{ name: "18222001 Dimas - Tugas 02.pdf" }]);
    await s.click(ATTACH);
    s.world.edunex.expireSession();
    await s.engineDoes(() => s.engine.refresh("edunex"));
    expect(s.button("Kumpulkan").disabled).toBe(true);
    expect(card()).toContain("Sesi Edunex berakhir. Masuk lagi untuk mengumpulkan.");
  });
});
