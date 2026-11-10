// The demo's states for pictures (mobile/src/demo/states.ts): each option on the demo's link puts the pretend world in
// the state its row in mobile/qa/superapp-states.md pictures, and none changes the demo when it's absent.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyAfterFirstRead, applyBeforeFirstRead, demoStates, LONG_COURSE, LONG_COURSE_EDUNEX, LONG_TASK } from "../../mobile/src/demo/states";
import { NetworkError } from "../../src/engine/http/transport";
import { demoOptions, demoWorld } from "../pretend/demo";
import { PRETEND_TOKEN } from "../pretend/edunex";
import { PRETEND_SIX_COOKIE } from "../pretend/six";

const EDUNEX = "https://api-edunex.cognisia.id";
const SIX = "https://six.itb.ac.id/app/mahasiswa:18223901/statusmhs";

function world(asked: Record<string, string> = {}) {
  const states = demoStates(asked);
  const w = demoWorld(demoOptions({ EDUNEX_DEMO: "signed-in" }));
  applyBeforeFirstRead(w, states);
  const refreshed: string[] = [];
  const firstRead = () => applyAfterFirstRead(w, states, (source) => refreshed.push(source));
  const edunex = (path: string) => w.request({ method: "GET", url: `${EDUNEX}${path}`, headers: { authorization: `Bearer ${PRETEND_TOKEN}` } });
  const six = () => w.request({ method: "GET", url: SIX, headers: { cookie: PRETEND_SIX_COOKIE } });
  return { w, states, refreshed, firstRead, edunex, six };
}

describe("the demo's states", () => {
  it("change nothing when the link names none", async () => {
    const { states, firstRead, refreshed, edunex, six } = world();
    expect(states).toEqual({ offline: undefined, fail: [], failAtStart: false, ended: undefined, hold: false, slowSeconds: 0, empty: [], long: false });
    firstRead();
    expect(refreshed).toEqual([]);
    expect((await edunex("/course/courses")).status).toBe(200);
    expect((await six()).status).not.toBe(500);
  });

  it("offline: every request fails as on a phone with no network, once the first read is saved", async () => {
    const { firstRead, refreshed, edunex } = world({ EDUNEX_DEMO_OFFLINE: "1" });
    expect((await edunex("/course/courses")).status).toBe(200);
    firstRead();
    await expect(edunex("/course/courses")).rejects.toBeInstanceOf(NetworkError);
    expect(refreshed).toEqual(["edunex", "six"]);
    expect(demoStates({ EDUNEX_DEMO_OFFLINE: "later" }).offline).toBe("later");
  });

  it("a server error: Edunex's data answers 500 but its sign-in still works; SIX alone, or both", async () => {
    const { firstRead, refreshed, edunex, six } = world({ EDUNEX_DEMO_FAIL: "edunex" });
    firstRead();
    expect((await edunex("/course/courses")).status).toBe(500);
    expect((await edunex("/login/me")).status).toBe(200);
    expect((await six()).status).not.toBe(500);
    expect(refreshed).toEqual(["edunex"]);
    const bothDown = world({ EDUNEX_DEMO_FAIL: "both" });
    bothDown.firstRead();
    expect((await bothDown.six()).status).toBe(500);
    expect(bothDown.refreshed).toEqual(["edunex", "six"]);
  });

  it("a server error from the first read on, so nothing is saved", async () => {
    const { edunex, refreshed, firstRead } = world({ EDUNEX_DEMO_FAIL: "edunex", EDUNEX_DEMO_FAIL_AT: "start" });
    expect((await edunex("/course/courses")).status).toBe(500);
    firstRead();
    expect(refreshed).toEqual([]);
  });

  it("SIX's session ends right after the first read, and the app reads it at once", async () => {
    const { firstRead, refreshed, w } = world({ EDUNEX_DEMO_ENDED: "six" });
    firstRead();
    expect(w.six.sessionValid).toBe(false);
    expect(w.edunex.sessionValid).toBe(true);
    expect(refreshed).toEqual(["six"]);
  });

  it("loading: a hold, or a wait of so many seconds", () => {
    expect(demoStates({ EDUNEX_DEMO_HOLD: "1" }).hold).toBe(true);
    expect(demoStates({ EDUNEX_DEMO_SLOW: "8" }).slowSeconds).toBe(8);
    expect(demoStates({ EDUNEX_DEMO_SLOW: "soon" }).slowSeconds).toBe(0);
  });

  it("empty: Edunex has no Tasks, exams, material, announcements or grades", async () => {
    const { w } = world({ EDUNEX_DEMO_EMPTY: "tasks,exams,material,alerts,grades" });
    expect([...w.edunex.tasks.values()].flat()).toEqual([]);
    expect(w.edunex.exams.size).toBe(0);
    expect(w.edunex.contents.size).toBe(0);
    expect(w.edunex.modules.size).toBe(0);
    expect(w.edunex.announcements.size).toBe(0);
    expect(w.edunex.activeAnnouncements).toEqual([]);
    expect(w.edunex.gradebooks.size).toBe(0);
    const full = world();
    expect([...full.w.edunex.tasks.values()].flat().length).toBeGreaterThan(0);
  });

  it("a long name: II4091 on SIX's pages and Edunex's courses, and Task 117001's title", async () => {
    const { w, edunex } = world({ EDUNEX_DEMO_LONG: "1" });
    const six = [...w.six.pages.values()].join("");
    expect(six).toContain(LONG_COURSE);
    expect(six).not.toContain("Proposal Tugas Akhir<");
    expect(JSON.stringify((await edunex("/course/courses")).body)).toContain(LONG_COURSE_EDUNEX);
    expect(w.edunex.task(117001).attributes.name).toBe(LONG_TASK);
  });

  it("refuses an option it doesn't know, so a typo in a link isn't a quiet normal picture", () => {
    expect(() => demoStates({ EDUNEX_DEMO_EMPTY: "homework" })).toThrow(/homework/);
    expect(() => demoStates({ EDUNEX_DEMO_OFFLINE: "yes" })).toThrow();
    expect(() => demoStates({ EDUNEX_DEMO_ENDED: "both" })).toThrow();
  });
});

describe("the list of states (mobile/qa/superapp-states.md) and the capture script's data", () => {
  const read = (file: string) => readFileSync(new URL(`../../mobile/qa/${file}`, import.meta.url), "utf8");
  const data = JSON.parse(read("superapp-states.json")) as {
    states: Record<string, { query: string }>;
    screens: { id: string; name: string; path: string; cells: Record<string, { handling: string; query?: string }> }[];
  };
  const table = read("superapp-states.md");

  it("has every row of the data in the table, with the same link, and every link is one the demo reads", () => {
    for (const screen of data.screens)
      for (const [state, cell] of Object.entries(screen.cells)) {
        expect(data.states[state], `${screen.id}: no state ${state}`).toBeDefined();
        const shot = cell.handling !== "no-way" && cell.handling !== "n/a";
        const query = cell.query ?? data.states[state]!.query;
        const link = shot ? `\`edunexplusdemo://demo?${query}\`` : "–";
        expect(table, `${screen.id} ${state}`).toContain(`| ${screen.name} | `);
        expect(table, `${screen.id} ${state}`).toContain(`| ${state} | ${link} |`);
        if (shot) {
          const asked = Object.fromEntries(new URLSearchParams(query).entries());
          expect(() => demoStates(asked)).not.toThrow();
          expect(() => demoOptions(asked)).not.toThrow();
        }
      }
  });
});
