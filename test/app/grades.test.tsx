// @vitest-environment jsdom
// v2-10 (#78), seam 2: Nilai as the Student sees it, the real window code on
// the real engine, with SIX's records (read from the recorded pages) and
// ITB's calendar arriving as datasets (until #76 lands SIX's sign-in).
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import type { Transcript } from "../../src/core/models";
import { records } from "../engine/grades-records";
import { PretendWorld } from "../pretend/world";
import { openApp } from "./harness";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

let hash = 0;
async function inject(name: string, value: unknown) {
  await screen!.apply({ type: "dataset", dataset: { name: name as never, value: value as never, fetchedAt: 0, hash: `g${++hash}` } });
}

/** Opens Nilai with the Student's records; `edit` changes the transcript first, the way SIX would. */
async function openGrades(options: { now?: string; edit?: (t: Transcript) => void; lang?: "en" } = {}) {
  const world = new PretendWorld({ now: options.now ?? "2026-10-11T09:00:00+07:00" });
  screen = await openApp({ world, signedIn: true });
  if (options.lang) await screen.engineDoes(() => screen!.engine.updateSettings({ lang: options.lang }));
  const data = await records();
  options.edit?.(data.transcript);
  for (const [name, value] of [
    ["six.transcript", data.transcript],
    ["six.progress", data.progress],
    ["six.curriculum", data.curriculum],
    ["itb.catalog", data.catalog],
    ["itb.calendar", data.calendar],
  ] as const)
    await inject(name, value);
  await screen.click(options.lang === "en" ? "Grades" : "Nilai");
  return screen;
}

const select = (label: string) => document.querySelector<HTMLSelectElement>(`select[aria-label='${label}']`)!;
async function choose(label: string, value: string) {
  await act(async () => {
    const el = select(label);
    el.value = value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
async function type(label: string, value: string) {
  await act(async () => {
    const input = document.querySelector<HTMLInputElement>(`input[aria-label='${label}']`)!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const text = (selector: string) => document.querySelector(selector)?.textContent ?? "";

const stats = () => [...document.querySelectorAll("main .grid-cols-2 > div")].map((el) => el.textContent);
const chartRows = () =>
  [...document.querySelectorAll("table")]
    .find((table) => table.querySelector("caption")?.textContent?.startsWith("IP dan IPK per semester"))
    ?.querySelectorAll("tbody tr") ?? [];
const termRow = (name: RegExp) => screen!.button(name);

describe("Nilai", () => {
  it("before SIX is read: what SIX unlocks, this term's courses from Edunex, and a way in", async () => {
    screen = await openApp({ signedIn: true });
    await screen.click("Nilai");
    expect(screen.text()).toContain("Transkrip & IPK butuh SIX");
    expect(screen.text()).toContain("Masuk ke SIX untuk melihat IPK, transkrip, dan perkiraan IPK saat lulus.");
    // No grade published yet: said once, not on every course.
    expect(screen.text()).toContain("Belum ada nilai yang dirilis");
    expect(screen.text()).not.toContain("Nilai belum dirilis di Edunex");
    await screen.click("Masuk ke SIX");
    await screen.wait();
    expect(screen.store.status("six").state).toBe("live");
    expect(screen.text()).not.toContain("Transkrip & IPK butuh SIX");
    expect(screen.text()).toContain("3,26");
  });

  it("answers first: the IPK and where the expected grades lead, then four equal figures", async () => {
    const s = await openGrades();
    expect(text("main header")).toContain("IPK-mu 3,26. Dengan perkiraan nilaimu, lulus dengan sekitar 3,30 (sangat memuaskan).");
    expect(stats()).toEqual([
      "IPK3,26Sangat memuaskan",
      "SKS lulus125dari 144 SKS untuk lulus",
      "IP semester lalu3,27Smt 6 · +0,17 dari sebelumnya",
      // (408 + 4 × 26) / 151
      "IPK tertinggi yang masih mungkin3,39jika semua A di 26 SKS tersisa",
    ]);
    expect(s.text()).not.toContain("SIX menampilkan IPK");
    expect(s.text()).not.toContain("Tahap Sarjana");
    // SIX's stage IPK in the Student's words, not SIX's.
    expect(s.text()).toContain("IPK tanpa TPB: 3,18");
    expect(s.text()).not.toMatch(/tahap sarjana/i);
  });

  it("IP and IPK per semester on one chart, this semester and the plan marked as estimates", async () => {
    await openGrades();
    expect([...chartRows()].map((tr) => tr.textContent)).toEqual([
      "Smt 13,693,69",
      "Smt 23,433,17",
      "Smt 33,333,17",
      "Smt 43,303,24",
      "Smt 53,263,10",
      "Smt 63,263,27",
      "Smt 7 (Perkiraan)3,293,50",
      "Smt 8 (Perkiraan)3,303,50",
    ]);
  });

  it("each course's \"Butuh berapa?\" says which course, for a screen reader, and opens that course's grades", async () => {
    const s = await openGrades();
    const asks = [...document.querySelectorAll("main button")].filter((b) => b.textContent === "Butuh berapa?").map((b) => b.getAttribute("aria-label"));
    expect(asks.length).toBeGreaterThan(1);
    expect(new Set(asks).size).toBe(asks.length);
    await s.click(asks[0]!);
    expect(document.querySelector("main h1")?.textContent).not.toBe("Nilai");
  });

  it("IPK at graduation with one positive honors line; the ladder stays in the planner", async () => {
    const s = await openGrades();
    expect(s.text()).toContain("IPK saat lulusPerkiraan, dari nilai perkiraanmu3,30Sangat memuaskanLulus Smt 8 · 2026/2027 Genap");
    expect(s.text()).toContain("Cum laude (≥ 3,50) sudah di luar jangkauan. Tiap nilai bagus tetap menaikkan IPK-mu.");
    expect(s.text()).not.toContain("Magna cum laude");
    expect(s.text()).not.toContain("tak tercapai");
    await s.click("Atur di Rencana studi");
    expect(document.querySelector("[role=tab][data-state=active]")?.textContent).toBe("Rencana");
  });

  it("this semester is a what-if: guesses look like guesses until changed, and move the IPK", async () => {
    const s = await openGrades();
    expect(text("section[aria-labelledby=this-term]")).toContain("Perkiraan nilaimu · ubah untuk mencoba");
    expect(select("Perkiraan nilai KU5014").className).toContain("border-dashed");
    expect(text("[aria-live=polite]")).toContain("IPK setelah semester ini 3,29");
    await choose("Perkiraan nilai KU5014", "A");
    expect(text("[aria-live=polite]")).toContain("IPK setelah semester ini 3,30");
    expect(select("Perkiraan nilai KU5014").className).not.toContain("border-dashed");
    expect(s.calls.at(-1)).toMatchObject({ name: "local.set", input: { name: "local.plan" } });
    expect(s.store.dataset("local.plan")?.value).toMatchObject({ expected: { KU5014: "A" } });
  });

  it("a target says what it needs, positively; the planner's quick picks are the same setting", async () => {
    const s = await openGrades();
    // 408 points over 125 SKS; 14 SKS this semester: (3.3 × 139 − 408) / 14 = 3.62…, rounded up.
    await type("Target IPK lainnya", "3,3");
    expect(text("section[aria-labelledby=this-term] [role=status]")).toBe("Untuk IPK 3,30: rata-rata 3,63 (sekitar A) di 14 SKS semester ini.");
    expect(s.store.dataset("local.plan")?.value).toMatchObject({ target: 3.3 });
    await s.click("Target IPK 3,50");
    expect(text("section[aria-labelledby=this-term] [role=status]")).toContain("IPK 3,50 belum terkejar semester ini, walau semua A.");
    // (3 × 139 − 408) / 14 = 0.64: below a D average, so it's safe, never "about D".
    await s.click("Target IPK 3,00");
    expect(text("section[aria-labelledby=this-term] [role=status]")).toBe("Sudah aman: nilai D semua pun tetap mencapai 3,00.");
    await type("Target IPK lainnya", "2,5");
    expect(text("section[aria-labelledby=this-term] [role=status]")).toBe("IPK 2,50 sudah pasti tercapai.");
  });

  it("an empty or impossible target is said, never 'already reached' (bug)", async () => {
    const s = await openGrades();
    await s.click("Target IPK 3,50");
    await type("Target IPK lainnya", "4,5");
    expect(s.text()).toContain("Isi target antara 2,00 dan 4,00.");
    expect(text("section[aria-labelledby=this-term] [role=status]")).not.toContain("tercapai");
    expect(s.store.dataset("local.plan")?.value).toMatchObject({ target: 3.5 });
    // The target still counted stays marked.
    expect(s.button("Target IPK 3,50").getAttribute("aria-checked")).toBe("true");
    await type("Target IPK lainnya", "");
    expect(s.text()).not.toContain("Isi target antara 2,00 dan 4,00.");
    expect(text("section[aria-labelledby=this-term] [role=status]")).toContain("IPK 3,50 belum terkejar");
    expect(s.store.dataset("local.plan")?.value).toMatchObject({ target: 3.5 });
  });

  it("Edunex's placeholder gradebook is never a grade, said once", async () => {
    const s = await openGrades();
    expect(s.text().match(/Nilai Edunex belum dirilis/g)).toHaveLength(1);
    expect(s.text()).not.toMatch(/Edunex 0[.,]0+ · E/);
  });

  it("the questionnaire reminder: ahead of ITB's window, during it, and gone once every grade is in", async () => {
    let s = await openGrades();
    expect(s.text()).toContain("SIX menyembunyikan nilai sampai kuesioner mata kuliahnya diisi (30 Nov–11 Des). Kamu akan diingatkan.");
    s.close();

    s = await openGrades({ now: "2026-12-01T10:00:00+07:00" });
    expect(s.text()).toContain("SIX menyembunyikan nilai sampai kamu mengisi kuesioner mata kuliahnya. Isi sebelum 11 Des.");
    await s.click("Isi kuesioner di SIX");
    expect(s.calls.at(-1)).toMatchObject({ name: "shell.openExternal", input: { url: "https://six.itb.ac.id" } });
    s.close();

    s = await openGrades({
      now: "2026-12-01T10:00:00+07:00",
      edit: (t) => {
        for (const c of t.terms.at(-1)!.courses) Object.assign(c, { grade: "A", standing: "counted" });
      },
    });
    expect(s.text()).not.toContain("kuesioner");
    expect(s.text()).toContain("Semua nilai semester ini sudah keluar.");
  });

  it("the transcript by term, named one way, each row's standing said honestly", async () => {
    await openGrades({
      edit: (t) => {
        const term = t.terms.find((x) => x.term === "2025-2")!;
        Object.assign(term.courses.find((c) => c.code === "FK3057")!, { standing: "off-transcript", onTranscript: false });
        Object.assign(term.courses.find((c) => c.code === "II4012")!, { standing: "replaced" });
      },
    });
    const row = termRow(/^Smt 6 · 2025\/2026 Genap/);
    expect(row.getAttribute("aria-expanded")).toBe("true");
    expect(row.textContent).toContain("8 mata kuliahIP 3,27");
    const rows = [...row.parentElement!.querySelectorAll("ul li")].map((li) => li.textContent);
    expect(rows).toContain("FK3057Sains Sepak BolaBelum masuk transkrip2 SKSB");
    expect(rows).toContain("II4012Inteligensi Artifisial untuk BisnisDiganti nilai ulang3 SKSC");
    const now = termRow(/^Smt 7 · 2026\/2027 Ganjil/);
    expect(now.textContent).toContain("Berlangsung");
    await screen!.click(now);
    expect([...now.parentElement!.querySelectorAll("ul li")].map((li) => li.textContent)).toContain("II4091Proposal Tugas AkhirBelum ada nilai2 SKS—");
  });

  it("when SIX's IPK and the rows disagree, says so plainly and shows SIX's figure", async () => {
    const s = await openGrades({
      edit: (t) => {
        t.ipk = { ...t.ipk, six: 3.3, agrees: false };
        t.terms[0].ip = { ...t.terms[0].ip, six: 3.7, agrees: false };
      },
    });
    expect(s.text()).toContain("SIX menampilkan IPK 3,30, sedangkan nilai di transkripmu menghasilkan 3,26. Yang ditampilkan angka SIX.");
    expect(stats()[0]).toBe("IPK3,30Sangat memuaskan");
    expect(termRow(/^Smt 1 · 2023\/2024 Ganjil/).textContent).toContain("SIX 3,70 · dari baris 3,69");
  });

  it("in English", async () => {
    const s = await openGrades({ lang: "en" });
    expect(s.text()).toContain("SKS passed125");
    expect(s.text()).toContain("IPK at graduation");
    expect(s.text()).toContain("Very satisfactory");
    expect(s.text()).toContain("Sem 6 · 2025/2026 Even");
    expect(s.text()).toContain("Highest IPK still possible3.39");
  });
});
