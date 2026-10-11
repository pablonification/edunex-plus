// @vitest-environment jsdom
// v2-05 (#73), seam 2: handing a Task in from the window: attach files (the
// system file picker is the only pretend part), save a quiet draft, submit
// with a confirmation, and a receipt only once EduNex says it's submitted.
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { PretendWorld } from "../pretend/world";
import { openApp } from "./harness";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

const ATTACH = /^Lampirkan berkas · Lepas berkas di sini$/;
const card = () => document.querySelector("main aside")?.textContent ?? "";
const answerWrites = (s: NonNullable<typeof screen>) =>
  s.world.edunex.writes.filter((w) => w.path.startsWith("/course/task/answers")).map((w) => `${w.method} ${w.path.replace(/\d+$/, ":id")}`);
const confirmButton = () => [...(document.querySelector("[role=alertdialog]")?.querySelectorAll("button") ?? [])].find((b) => b.textContent !== "Batal");

const openTask = async (title: string, now?: string) => {
  const s = await openApp({ signedIn: true, world: new PretendWorld({ now }) });
  screen = s;
  await s.click(/^Tugas & Ujian\d*$/);
  const row = () => [...document.querySelectorAll<HTMLButtonElement>("main li button")].find((b) => b.textContent?.startsWith(title));
  if (!row()) await s.click("Selesai");
  const found = row();
  if (!found) throw new Error(`No Task row ${title}`);
  await s.click(found);
  return s;
};

describe("handing in", () => {
  it("attach, save a draft quietly, then submit with a confirmation and a receipt from EduNex", async () => {
    const s = await openTask("Tugas 02 Bab II");
    s.willPick([{ name: "Bab II.pdf", content: "%PDF bab dua" }]);
    await s.click(ATTACH);
    expect(card()).toContain("Bab II.pdf");
    expect(card()).toContain("Belum disimpan · 12 B");
    // Uploading goes to EduNex's storage; nothing is in the answer yet.
    expect(s.world.edunex.writes.map((w) => w.path)).toEqual(["/blob-storage/sas"]);

    await s.click("Simpan draf");
    expect(s.text()).toContain("Draf tersimpan");
    expect(card()).toContain("DrafBelum diserahkan");
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
    expect(card()).toContain("TerkumpulHari ini, 08:12");
    expect(card()).toContain("Sudah diserahkan. Pengumpulan bersifat final.");
    expect(s.text()).toContain("Terkumpul. EduNex mencatatnya Hari ini, 08:12.");
    expect(s.has(ATTACH)).toBe(false);
    expect(s.world.edunex.task(117003).attributes.answers).toHaveLength(1);
  });

  it("cancelling the confirmation sends nothing", async () => {
    const s = await openTask("Tugas 02 Bab II");
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
    expect(card()).toContain("Gagal diunggah. Berkas tetap terlampir.");
    expect(s.button("Simpan draf").disabled).toBe(true);
    expect(s.button("Kumpulkan").disabled).toBe(true);
    await s.click("Unggah ulang Bab II.pdf");
    expect(card()).toContain("Belum disimpan");
    expect(s.button("Kumpulkan").disabled).toBe(false);
  });

  it("no connection while uploading says so, and the file stays", async () => {
    const s = await openTask("Tugas 02 Bab II");
    s.world.failUploads("network");
    s.willPick([{ name: "Bab II.pdf" }]);
    await s.click(ATTACH);
    expect(card()).toContain("Gagal diunggah: tidak terhubung. Berkas tetap terlampir.");
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
    expect(card()).toContain("Lebih dari 100 MB");
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
    // The app hasn't seen that draft yet: saving re-reads EduNex first.
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
    expect(card()).toContain("Sesi EduNex berakhir. Masuk lagi, lalu coba lagi. Berkasmu tetap terlampir.");
    expect(card()).toContain("Bab II.pdf");
    s.world.edunex.sessionValid = true;
    await s.click("Masuk lagi");
    expect(card()).not.toContain("Sesi EduNex berakhir");
    await s.click("Kumpulkan");
    await s.click(confirmButton()!);
    expect(card()).toContain("Terkumpul");
  });

  it("a Task closed meanwhile: EduNex is asked first, and the page says the answer wasn't sent", async () => {
    const s = await openTask("Tugas 02 Bab II");
    s.willPick([{ name: "Bab II.pdf" }]);
    await s.click(ATTACH);
    s.world.edunex.closeTask(117003);
    await s.click("Kumpulkan");
    await s.click(confirmButton()!);
    expect(card()).toContain("EduNex sudah menutup pengumpulan tugas ini. Jawabanmu tidak terkirim.");
    expect(card()).toContain("Ditutup");
    expect(answerWrites(s)).toEqual([]);
  });

  it("EduNex taking a submit without showing it sent: no receipt, a way to check on EduNex", async () => {
    const s = await openTask("Tugas 02 Bab II");
    s.willPick([{ name: "Bab II.pdf" }]);
    await s.click(ATTACH);
    await s.click("Simpan draf");
    s.world.edunex.fail(/^\/course\/task\/answers\/\d+$/, 200, 1);
    await s.click("Kumpulkan");
    await s.click(confirmButton()!);
    expect(card()).toContain("EduNex menerima permintaanmu, tapi belum menunjukkan perubahannya.");
    expect(card()).toContain("Draf");
    await s.click("Buka di EduNex");
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
    expect(card()).toContain("Tidak bisa terlambat");
    expect(s.has(ATTACH)).toBe(false);
    expect(s.has("Kumpulkan")).toBe(false);
  });

  it("speaks English, the draft-vs-submitted line included", async () => {
    const s = await openTask("Tugas 02 Bab II");
    await s.engineDoes(() => s.engine.updateSettings({ lang: "en" }));
    expect(card()).toContain("Not started");
    expect(s.has(/^Attach files · Drop files here$/)).toBe(true);
    expect(s.has("Save draft")).toBe(true);
    expect(s.has("Submit")).toBe(true);
    expect(card()).toContain("A draft is only visible to you. Submit to hand it in.");
    expect(card()).toContain("File required");
    expect(card()).toContain("Late submission allowed");
  });
});
