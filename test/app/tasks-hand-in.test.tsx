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
/** What the Student writes in the answer box: Edunex needs text in every answer. */
const ANSWER = "<p>Berikut jawaban saya.</p>";
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
    await s.write("<p>Berikut <strong>Bab II</strong> saya.</p>");
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
    // One request with the files in it, as the website's "Save Answer".
    expect(answerWrites(s)).toEqual(["POST /course/task/answers"]);

    await s.click("Kumpulkan");
    const dialog = document.querySelector("[role=alertdialog]");
    expect(dialog?.textContent).toContain("Kumpulkan tugas ini?");
    expect(dialog?.textContent).toContain("Bab II.pdf akan diserahkan ke dosen. Setelah dikumpulkan, jawabanmu final.");
    // Nothing is sent before the Student confirms.
    expect(answerWrites(s)).toHaveLength(1);
    await s.click(confirmButton()!);
    expect(answerWrites(s)).toHaveLength(2);
    expect(s.world.edunex.writes.filter((w) => w.method === "PATCH").at(-1)?.body).toEqual({ is_sent: 1 });
    expect(s.world.edunex.exportsCleared).toEqual([117003]);
    expect(card()).toContain("TerkumpulEdunex mencatatnya Hari ini, 08:12");
    expect(card()).toContain("Sudah diserahkan. Pengumpulan bersifat final.");
    expect(s.has(ATTACH)).toBe(false);
    expect(s.world.edunex.task(117003).attributes.answers).toHaveLength(1);
  });

  it("cancelling the confirmation sends nothing", async () => {
    const s = await openTask("Tugas 02 Bab II", "2026-10-16T16:00:00+07:00");
    await s.write(ANSWER);
    s.willPick([{ name: "Bab II.pdf" }]);
    await s.click(ATTACH);
    await s.click("Kumpulkan");
    await s.click("Batal");
    expect(answerWrites(s)).toEqual([]);
    expect(card()).toContain("Belum dikerjakan");
  });

  it("a failed upload keeps the file attached with a clear error, and trying again sends it", async () => {
    const s = await openTask("Tugas 02 Bab II");
    await s.write(ANSWER);
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
    await s.write(ANSWER);
    s.willPick([{ name: "Bab II.pdf" }, { name: "Lampiran.zip", type: "application/zip" }]);
    await s.click(ATTACH);
    // Each to its own place on the storage, named as the website names it.
    expect(s.world.edunex.writes.filter((w) => w.path === "/blob-storage/sas").map((w) => w.body.files[0].fileName.split("_").at(-1))).toEqual([
      "Bab-II",
      "Lampiran",
    ]);
    expect(s.world.edunex.writes[1].body.files[0].contentType).toBe("application/zip");
    await s.click("Simpan draf");
    expect(s.world.edunex.task(117003).attributes.answers[0].files.map((f: { name: string }) => f.name)).toEqual(["Bab II.pdf", "Lampiran.zip"]);
  });

  it("a file over 100 MB, or of a kind Edunex doesn't take, is refused at once, without uploading", async () => {
    const s = await openTask("Tugas 02 Bab II");
    s.willPick([{ name: "rekaman.zip", size: 200 * 1024 * 1024 }, { name: "rekaman.mp4" }]);
    await s.click(ATTACH);
    expect(card()).toContain("Lebih dari 100 MB: Edunex tidak menerima berkas sebesar ini");
    expect(card()).toContain("Edunex tidak menerima berkas jenis ini. Gunakan PDF, Word, Excel, PowerPoint, ZIP, RAR, JPG, atau PNG.");
    expect(s.has(/^Unggah ulang/)).toBe(false);
    expect(s.world.edunex.writes).toEqual([]);
    // Nothing failed to upload, so there's no "try again": only removing them.
    expect(s.button("Kumpulkan").disabled).toBe(true);
    expect(card()).toContain("Hapus dulu berkas yang tidak diterima Edunex.");
    expect(card()).not.toContain("Coba lagi");
    await s.click("Hapus rekaman.zip");
    await s.click("Hapus rekaman.mp4");
    expect(card()).not.toContain("rekaman");
    expect(card()).not.toContain("Hapus dulu berkas");
  });

  it("a group Task: no answer form, the way to hand it in with the group on Edunex", async () => {
    const world = new PretendWorld();
    world.edunex.postTask(95326, { name: "Tugas Kelompok 1", type: "GROUP" });
    screen = await openApp({ signedIn: true, world });
    const s = screen;
    await s.click(/^Tugas & Ujian\d*$/);
    await s.click([...document.querySelectorAll<HTMLButtonElement>("main li button")].find((b) => b.textContent?.startsWith("Tugas Kelompok 1"))!);
    expect(card()).toContain("Ini tugas kelompok. Kumpulkan bersama kelompokmu di Edunex.");
    // Nothing of the Student's own to show, so no "Jawabanmu" over it.
    expect(card()).not.toContain("Jawabanmu");
    expect(s.has(ATTACH)).toBe(false);
    expect(s.has("Kumpulkan")).toBe(false);
    await s.click("Buka di Edunex");
    expect(s.calls.at(-1)).toEqual({
      name: "shell.openExternal",
      input: { url: expect.stringMatching(/^https:\/\/edunex\.itb\.ac\.id\/assignment\/take\/\d+$/) },
    });
  });

  it("a dropped file of a kind Edunex doesn't take is said so, and never read or sent", async () => {
    const s = await openTask("Tugas 02 Bab II");
    let read = false;
    const arrayBuffer = async () => {
      read = true;
      return new ArrayBuffer(10);
    };
    const dropped = { name: "catatan.txt", size: 10, type: "text/plain", arrayBuffer };
    await act(async () => {
      const event = new Event("drop", { bubbles: true, cancelable: true });
      Object.defineProperty(event, "dataTransfer", { value: { files: [dropped] } });
      s.button(ATTACH).dispatchEvent(event);
    });
    expect(card()).toContain("catatan.txt");
    expect(card()).toContain("Edunex tidak menerima berkas jenis ini.");
    expect(card()).toContain("Hapus dulu berkas yang tidak diterima Edunex.");
    expect(read).toBe(false);
    expect(s.world.edunex.writes).toEqual([]);
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
    await s.write(ANSWER);
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
    await s.write(ANSWER);
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
    await s.write(ANSWER);
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
    await s.write(ANSWER);
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
    await s.write(ANSWER);
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
    // A lecturer sees a saved draft on Edunex (as "Answered"): the app never says it's private.
    expect(card()).toContain("Your lecturer can see a saved draft, but only Submit hands it in.");
    expect(card()).toContain("File required · PDF file");
    expect(card()).toContain("Write your answer first. Edunex needs text, even when you attach a file.");
    expect(s.text()).toContain("Late submission allowed");
  });
});

describe("the written answer", () => {
  const box = () => document.querySelector<HTMLElement>("main aside [role=textbox][contenteditable]");
  const sentAnswer = (s: NonNullable<typeof screen>) =>
    s.world.edunex.writes.filter((w) => w.path.startsWith("/course/task/answers") && "answer" in w.body).at(-1)?.body.answer;
  const goTo = async (s: NonNullable<typeof screen>, route: Parameters<typeof s.apply>[0]) => s.apply(route);

  it("is required, as on Edunex: Save draft and Submit wait for text, and say why", async () => {
    const s = await openTask("Tugas 02 Bab II", "2026-10-16T16:00:00+07:00");
    s.willPick([{ name: "Bab II.pdf" }]);
    await s.click(ATTACH);
    expect(s.button("Kumpulkan").disabled).toBe(true);
    expect(s.button("Simpan draf").disabled).toBe(true);
    expect(card()).toContain("Tulis jawabanmu dulu. Edunex butuh teks, meski kamu melampirkan berkas.");
    // The hint is read with the box.
    expect(document.getElementById((await s.editor()).getAttribute("aria-describedby") ?? "")?.textContent).toContain("Tulis jawabanmu dulu");
    expect((await s.editor()).querySelector("[data-placeholder]")?.getAttribute("data-placeholder")).toBe("Tulis jawabanmu di sini…");
    await s.write("<p>Berikut Bab II.</p>");
    expect(s.button("Kumpulkan").disabled).toBe(false);
    expect(card()).not.toContain("Tulis jawabanmu dulu");
    expect(answerWrites(s)).toEqual([]);
  });

  it("a draft keeps the text with simple formatting, as Edunex's editor writes it; what it can't hold is left out", async () => {
    const s = await openTask("Tugas 02 Bab II");
    // Pasted from a word processor: bold, a list, a link, a picture, a table, styles.
    await s.write(
      '<p style="font-family:Calibri"><b>Ringkasan</b> Bab II, lihat <a href="https://drive.google.com/x">draf lengkap</a>.</p><ul><li>Latar belakang</li><li>Tujuan</li></ul><img src="https://example.com/a.png"><table><tr><td>Tabel</td></tr></table>',
    );
    s.willPick([{ name: "Bab II.pdf" }]);
    await s.click(ATTACH);
    await s.click("Simpan draf");
    expect(answerWrites(s)).toEqual(["POST /course/task/answers"]);
    expect(sentAnswer(s)).toBe(
      '<p><strong>Ringkasan</strong> Bab II, lihat <a href="https://drive.google.com/x">draf lengkap</a>.</p><ul><li>Latar belakang</li><li>Tujuan</li></ul><p>Tabel</p>',
    );
    expect(card()).toContain("DrafTersimpan");
    expect(card()).not.toContain("Jawaban belum disimpan");
  });

  it("the toolbar formats the text, and says which formatting is on", async () => {
    const s = await openTask("Tugas 02 Bab II");
    await s.write("<p>Penting</p>");
    const editor = await s.editor();
    await act(async () => void editor.dispatchEvent(new KeyboardEvent("keydown", { key: "a", ctrlKey: true, bubbles: true, cancelable: true })));
    await s.click("Tebal");
    expect(s.button("Tebal").getAttribute("aria-pressed")).toBe("true");
    await s.click("Daftar berbutir");
    // Arrow keys move along the toolbar.
    s.button("Daftar berbutir").focus();
    await s.key("ArrowRight");
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Daftar bernomor");
    s.willPick([{ name: "Bab II.pdf" }]);
    await s.click(ATTACH);
    await s.click("Simpan draf");
    expect(sentAnswer(s)).toBe("<ul><li><strong>Penting</strong></li></ul>");
  });

  it("⌘K in the box opens its link field, not the app's search", async () => {
    const s = await openTask("Tugas 02 Bab II");
    await s.write("<p>Lihat sumbernya</p>");
    const editor = await s.editor();
    await act(async () => void editor.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true, cancelable: true })));
    expect(document.activeElement?.getAttribute("type")).toBe("url");
    expect(document.querySelector("[role=dialog]")).toBeNull();
  });

  it("submitted with text and a file, the text is then shown as handed in", async () => {
    const s = await openTask("Tugas 02 Bab II", "2026-10-16T16:00:00+07:00");
    await s.write("<p>Berikut <em>Bab II</em>.</p>");
    s.willPick([{ name: "Bab II.pdf" }]);
    await s.click(ATTACH);
    await s.click("Kumpulkan");
    expect(document.querySelector("[role=alertdialog]")?.textContent).toContain("Jawabanmu dan Bab II.pdf akan diserahkan ke dosen.");
    await s.click(confirmButton()!);
    expect(s.world.edunex.task(117003).attributes.answers[0]).toMatchObject({ is_sent: 1, answer: "<p>Berikut <em>Bab II</em>.</p>" });
    expect(card()).toContain("Terkumpul");
    expect(box()).toBeNull();
    expect(card()).toContain("Berikut Bab II.");
  });

  it("a draft from Edunex's website shows its text, ready to edit; left as it is, it's submitted untouched", async () => {
    const s = await openTask("Tugas 02 Bab II", "2026-10-16T16:00:00+07:00");
    s.world.edunex.draftOnWebsite(117003, "Bab II.pdf", "<p>Draf dari <i>Edunex</i>.</p>");
    await s.engineDoes(() => s.engine.refresh("edunex"));
    expect((await s.editor()).textContent).toBe("Draf dari Edunex.");
    expect(card()).not.toContain("Jawaban belum disimpan");
    await s.click("Kumpulkan");
    await s.click(confirmButton()!);
    // Nothing to save first: only the send.
    expect(answerWrites(s)).toEqual(["PATCH /course/task/answers/:id"]);
    expect(s.world.edunex.task(117003).attributes.answers[0]).toMatchObject({ is_sent: 1, answer: "<p>Draf dari <i>Edunex</i>.</p>" });
  });

  it("a website draft with a picture or a table stays as it is, with the way to change it on Edunex", async () => {
    const s = await openTask("Tugas 02 Bab II");
    const website = '<p>Lihat grafik:</p><figure class="image"><img src="https://edunexfixture.blob.core.windows.net/edunex/website-grafik.png"></figure>';
    s.world.edunex.draftOnWebsite(117003, "Bab II.pdf", website);
    await s.engineDoes(() => s.engine.refresh("edunex"));
    await s.wait(0);
    expect(box()).toBeNull();
    expect(card()).toContain("Lihat grafik:");
    expect(card()).toContain("Jawaban ini berisi gambar, tabel, rumus, atau gaya teks yang tidak bisa diubah di sini.");
    await s.click("Ubah di Edunex");
    expect(s.calls.at(-1)).toEqual({ name: "shell.openExternal", input: { url: "https://edunex.itb.ac.id/assignment/take/117003" } });
    // The files can still change; the text goes back exactly as Edunex has it.
    s.willPick([{ name: "Lampiran.pdf" }]);
    await s.click(ATTACH);
    await s.click("Simpan draf");
    expect(sentAnswer(s)).toBe(website);
  });

  it("a website draft with colours, sizes or centring stays as it is too: the box would drop them", async () => {
    const s = await openTask("Tugas 02 Bab II");
    const website = '<p style="text-align:center">Judul</p><p>Kata <span style="color:#e74c3c">merah</span> dan <span class="text-big">besar</span>.</p>';
    s.world.edunex.draftOnWebsite(117003, "Bab II.pdf", website);
    await s.engineDoes(() => s.engine.refresh("edunex"));
    await s.wait(0);
    expect(box()).toBeNull();
    expect(card()).toContain("Kata merah dan besar.");
    expect(s.has("Ubah di Edunex")).toBe(true);
    // Saving file changes sends the text back exactly as Edunex has it.
    s.willPick([{ name: "Lampiran.pdf" }]);
    await s.click(ATTACH);
    await s.click("Simpan draf");
    expect(sentAnswer(s)).toBe(website);
  });

  it("a website draft pasted from a document, with styles that show nothing, is ready to edit", async () => {
    const s = await openTask("Tugas 02 Bab II");
    s.world.edunex.draftOnWebsite(117003, "Bab II.pdf", '<p><span style="background-color:transparent;color:#000000;">Dari dokumen</span></p>');
    await s.engineDoes(() => s.engine.refresh("edunex"));
    expect((await s.editor()).textContent).toBe("Dari dokumen");
  });

  it("text not saved yet is kept when the page closes, until it's saved or thrown away", async () => {
    const s = await openTask("Tugas 02 Bab II");
    await s.write("<p>Separuh jalan</p>");
    expect(card()).toContain("Jawaban belum disimpan");
    await goTo(s, { type: "navigate", route: { screen: "home" } });
    expect(box()).toBeNull();
    await goTo(s, { type: "navigate", route: { screen: "task", taskId: 117003 } });
    expect((await s.editor()).textContent).toBe("Separuh jalan");
    expect(card()).toContain("Jawaban belum disimpan");
    // Nothing went to Edunex on its own.
    expect(answerWrites(s)).toEqual([]);
    await s.click("Buang perubahan");
    expect((await s.editor()).textContent).toBe("");
    expect(card()).not.toContain("Jawaban belum disimpan");
    // The cursor stays in the box, and Undo brings the text back.
    await act(async () => void (await new Promise((resolve) => setTimeout(resolve, 50))));
    expect(document.activeElement).toBe(await s.editor());
    await s.click("Urungkan");
    expect((await s.editor()).textContent).toBe("Separuh jalan");
    expect(card()).toContain("Jawaban belum disimpan");
    await s.click("Buang perubahan");
    await goTo(s, { type: "navigate", route: { screen: "home" } });
    await goTo(s, { type: "navigate", route: { screen: "task", taskId: 117003 } });
    expect((await s.editor()).textContent).toBe("");
  });

  it("text typed and thrown away in the same visit comes back with Undo", async () => {
    const s = await openTask("Tugas 02 Bab II");
    await s.write("<p>Baru saja</p>");
    await s.click("Buang perubahan");
    expect((await s.editor()).textContent).toBe("");
    await s.click("Urungkan");
    expect((await s.editor()).textContent).toBe("Baru saja");
    expect(answerWrites(s)).toEqual([]);
    // Unsaved text outlives the page while the app runs: leave none for the next test.
    await s.click("Buang perubahan");
  });

  it("speaks English, switched to with the page open", async () => {
    const s = await openApp({ signedIn: true });
    screen = s;
    await s.apply({ type: "navigate", route: { screen: "task", taskId: 117003 } });
    await s.editor();
    await s.engineDoes(() => s.engine.updateSettings({ lang: "en" }));
    const editor = await s.editor(/^Your answer$/);
    expect(editor.querySelector("[data-placeholder]")?.getAttribute("data-placeholder")).toBe("Write your answer here…");
    expect(s.has("Bold")).toBe(true);
    expect(card()).toContain("Write your answer first. Edunex needs text, even when you attach a file.");
  });
});

describe("handing in can't cost the Student their attendance", () => {
  const dialogText = () => document.querySelector("[role=alertdialog]")?.textContent ?? "";
  const article = () => document.querySelector("article")?.textContent ?? "";

  it("outside the attendance window the confirm says it won't count, and keeping a draft is the default", async () => {
    // Thu 8 Oct: Tugas 02 counts as attendance only if handed in Fri 16 Oct 15:00–23:59.
    const s = await openTask("Tugas 02 Bab II");
    await s.write(ANSWER);
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
    expect(answerWrites(s)).toEqual(["POST /course/task/answers"]);
    expect(s.world.edunex.writes.some((w) => w.body?.is_sent === 1)).toBe(false);
    expect(card()).toContain("DrafTersimpan");
    expect(card()).toContain("Drafmu aman. Kumpulkan Jum, 16 Okt, 15:00–23:59 agar terhitung hadir.");
  });

  it("handing in anyway outside the window: done, and the page says it didn't count", async () => {
    const s = await openTask("Tugas 02 Bab II");
    await s.write(ANSWER);
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
    await s.write(ANSWER);
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
    await s.write(ANSWER);
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
    await s.write(ANSWER);
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
    await s.write(ANSWER);
    s.willPick([{ name: "18222001 Dimas - Tugas 02.pdf" }]);
    await s.click(ATTACH);
    s.world.edunex.expireSession();
    await s.engineDoes(() => s.engine.refresh("edunex"));
    expect(s.button("Kumpulkan").disabled).toBe(true);
    expect(card()).toContain("Sesi Edunex berakhir. Masuk lagi untuk mengumpulkan.");
  });
});
