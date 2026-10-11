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

describe("Nilai", () => {
  it("before SIX is read: one plain line, no numbers, and a way in", async () => {
    screen = await openApp({ signedIn: true });
    await screen.click("Nilai");
    expect(screen.text()).toContain("Transkrip muncul setelah SIX tersambung.");
    await screen.click("Masuk");
    await screen.wait();
    expect(screen.store.status("six").state).toBe("live");
    expect(screen.text()).not.toContain("Transkrip muncul setelah SIX tersambung.");
    expect(screen.text()).toContain("3,26");
  });

  it("where the Student stands: IPK, SKS passed, last IP, stage, from SIX", async () => {
    const s = await openGrades();
    const stats = [...document.querySelectorAll("main .grid-cols-4 > div")].map((el) => el.textContent);
    expect(stats).toEqual(["IPK3,26", "SKS lulus125", "IP semester lalu3,27", "Tahap SarjanaIP 3,18"]);
    expect(s.text()).not.toContain("SIX menampilkan IPK");
  });

  it("IP per semester, with this semester and the plan as dashed estimates", async () => {
    await openGrades();
    const bars = [...document.querySelectorAll("ol[aria-label^='IP per semester'] > li")].map((li) => li.getAttribute("aria-label"));
    expect(bars).toEqual(["Smt 1: IP 3,69", "Smt 2: IP 3,17", "Smt 3: IP 3,17", "Smt 4: IP 3,24", "Smt 5: IP 3,10", "Smt 6: IP 3,27", "Smt 7: IP 3,50 (Perkiraan)", "Smt 8: IP 3,50 (Perkiraan)"]);
  });

  it("IPK at graduation and honors from the planner's projection", async () => {
    const s = await openGrades();
    expect(s.text()).toContain("IPK saat lulus14 SKS semester ini · 12 SKS direncanakan3,30Sangat memuaskan");
    expect(s.text()).toContain("Cum laude ≥ 3,50tak tercapai");
    expect(s.text()).toContain("Summa cum laude ≥ 3,85tak tercapai");
    await s.click("Ubah nilai atau mata kuliah di perencana");
    expect(document.querySelector("[role=tab][data-state=active]")?.textContent).toBe("Rencana");
  });

  it("this semester's expected grades move the IPK, and a target says what it needs", async () => {
    const s = await openGrades();
    expect(text("[aria-live=polite]")).toContain("IPK setelah semester ini 3,29");
    await choose("Perkiraan nilai KU5014", "A");
    expect(text("[aria-live=polite]")).toContain("IPK setelah semester ini 3,30");
    expect(s.calls.at(-1)).toMatchObject({ name: "local.set", input: { name: "local.plan" } });
    expect(s.store.dataset("local.plan")?.value).toMatchObject({ expected: { KU5014: "A" } });

    // 408 points over 125 SKS; 14 SKS this semester: (3.3 × 139 − 408) / 14 = 3.62…, rounded up.
    await type("Target IPK", "3.3");
    expect(text("[role=status]")).toContain("Rata-rata 3,63 (sekitar A) di 14 SKS semester ini.");
    await type("Target IPK", "3.5");
    expect(s.text()).toContain("Tidak tercapai semester ini, walau semua A.");
    await type("Target IPK", "2.5");
    expect(s.text()).toContain("Sudah tercapai.");
  });

  it("EduNex's placeholder gradebook is never a grade", async () => {
    const s = await openGrades();
    expect(s.text()).toContain("Nilai EduNex belum dirilis");
    expect(s.text()).not.toMatch(/EduNex 0[.,]0+ · E/);
  });

  it("the questionnaire reminder: ahead of ITB's window, during it, and gone once every grade is in", async () => {
    let s = await openGrades();
    expect(s.text()).toContain("SIX menyembunyikan nilai sampai kuesioner mata kuliahnya diisi (30 Nov–11 Des). Kamu akan diingatkan.");
    s.close();

    s = await openGrades({ now: "2026-12-01T10:00:00+07:00" });
    expect(s.text()).toContain("SIX menyembunyikan nilai sampai kamu mengisi kuesioner mata kuliahnya. Isi sebelum 11 Des.");
    await s.click("Buka SIX");
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

  it("the transcript by term, each row's standing said honestly", async () => {
    const s = await openGrades({
      edit: (t) => {
        const term = t.terms.find((x) => x.term === "2025-2")!;
        Object.assign(term.courses.find((c) => c.code === "FK3057")!, { standing: "off-transcript", onTranscript: false });
        Object.assign(term.courses.find((c) => c.code === "II4012")!, { standing: "replaced" });
      },
    });
    const row = s.button(/^Semester 2 2025\/2026/);
    expect(row.getAttribute("aria-expanded")).toBe("true");
    expect(row.textContent).toContain("8 mata kuliahIP 3,27");
    const rows = [...row.parentElement!.querySelectorAll("ul li")].map((li) => li.textContent);
    expect(rows).toContain("FK3057Sains Sepak BolaBelum masuk transkrip2 SKSB");
    expect(rows).toContain("II4012Inteligensi Artifisial untuk BisnisDiganti nilai ulang3 SKSC");
    const now = s.button(/^Semester 1 2026\/2027/);
    await s.click(now);
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
    expect(document.querySelector("main .grid-cols-4 > div")?.textContent).toBe("IPK3,30");
    expect(s.button(/^Semester 1 2023\/2024/).textContent).toContain("SIX 3,70 · dari baris 3,69");
  });

  it("in English", async () => {
    const s = await openGrades({ lang: "en" });
    expect(s.text()).toContain("SKS passed125");
    expect(s.text()).toContain("IPK at graduation");
    expect(s.text()).toContain("Very satisfactory");
    expect(s.text()).toContain("Transcript");
  });
});
