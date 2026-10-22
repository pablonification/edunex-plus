// "Sudah beres" (Handled), seam 1: the rules on Beranda's real items, built by
// the real engine from the pretend Edunex and SIX on the Monday of the UTS
// week, and on made-up Tasks. Which items have a ✓, which facts bring one
// back (and which don't), and what pruning keeps.
import { describe, expect, it } from "vitest";
import type { AttendanceHealth } from "../../src/core/attendance";
import {
  activeDone,
  billDoneKey,
  doneTerms,
  notHandingIn,
  outOfReachKey,
  partitionDone,
  pruneDone,
  putAway,
  taskDoneKey,
  taskPutAway,
} from "../../src/core/done";
import { Datasets, type DoneEntry } from "../../src/core/models";
import { type Need, type NeedDraft, needsYou } from "../../src/core/needs";
import { activeSnooze, snoozeKey } from "../../src/core/snooze";
import { aTask } from "../kit/tasks";
import { startHome } from "./needs-harness";

const MONDAY = "2026-10-12T08:07:00+07:00";
const DAY = 86_400_000;
const at = (iso: string) => Date.parse(`${iso}+07:00`);
const need = (needs: Need[], id: string) => {
  const found = needs.find((n) => n.id === id || n.id.startsWith(`${id}:`));
  if (!found) throw new Error(`No ${id} in ${needs.map((n) => n.id).join(", ")}`);
  return found;
};
const task = (fields: Partial<Parameters<typeof aTask>[0]> = {}) =>
  aTask({ id: 117001, courseCode: "II4091", courseId: 95001, title: "Tugas 01 Bab I", status: "not_started", ...fields });

describe("which items have a ✓", () => {
  it("only where the Student alone can know: a change checked, a target out of reach seen; never a Presence, an exam or a Task of their own", async () => {
    const h = await startHome({ now: MONDAY });
    const needs = needsYou(h.home());
    // Edited after handing in: "Sudah kucek", back with another edit.
    const edited = need(needs, "task:117432:edited");
    if (edited.kind !== "task") throw new Error("not a Task");
    expect(doneTerms(edited)).toEqual({ key: { id: "task:117432:edited", facts: `edited|${edited.task.editedAt}` }, how: "checked" });
    // Out of reach: "Sudah tahu", under the same id as the course page's banner.
    expect(doneTerms(need(needs, "attendance:KU5014"))).toEqual({ key: { id: "attendance:KU5014", facts: "out|80" }, how: "gotIt" });
    expect(doneTerms(need(needs, "attendance:KU5014"))?.key).toEqual(outOfReachKey("KU5014", { target: 80 }));
    // What clears itself has no ✓.
    expect(doneTerms(need(needs, "presence:2243740"))).toBeNull();
    expect(doneTerms(need(needs, "exam:DK4073-UTS"))).toBeNull();
  });

  it("a Task: a group's has the ✓ (its hand-in can't be seen); the Student's own is put away only from its page", () => {
    const own = task({ dueAt: at("2026-10-14T23:59:00") });
    const item = (t: ReturnType<typeof task>): NeedDraft => ({
      id: `task:${t.id}`,
      kind: "task",
      course: t.courseCode,
      band: "soon",
      at: t.dueAt,
      sources: ["edunex"],
      action: { kind: "go", route: { screen: "task", taskId: t.id } },
      task: t,
      reason: "due",
      draft: false,
    });
    expect(doneTerms(item(own))).toEqual({ key: taskDoneKey(own, "due"), how: null });
    expect(doneTerms(item({ ...own, group: true }))?.how).toBe("groupDone");
  });
});

describe("what brings a handled item back, and what doesn't", () => {
  it("an edit checked: back only with another edit", () => {
    const edited = task({ editedAt: at("2026-10-07T21:41:00") });
    const entries = putAway([], taskDoneKey(edited, "edited"), "checked", at("2026-10-07T22:00:00"));
    expect(activeDone(taskDoneKey(edited, "edited"), entries)?.how).toBe("checked");
    // A moved deadline alone isn't a new edit of what was checked.
    expect(activeDone(taskDoneKey({ ...edited, dueAt: at("2026-10-20T23:59:00") }, "edited"), entries)).toBeDefined();
    expect(activeDone(taskDoneKey({ ...edited, editedAt: at("2026-10-09T10:00:00") }, "edited"), entries)).toBeUndefined();
  });

  it("a Task handed in another way or not at all: back when its deadline, its late rule or the Task changes", () => {
    const open = task({ dueAt: at("2026-11-02T23:59:00") });
    const entries = putAway([], taskDoneKey(open, "due"), "notHandingIn", at("2026-10-12T09:00:00"));
    expect(taskPutAway(open, entries)?.how).toBe("notHandingIn");
    expect(notHandingIn(open, entries)).toBe(true);
    expect(taskPutAway({ ...open, dueAt: at("2026-11-09T23:59:00") }, entries)).toBeUndefined();
    expect(taskPutAway({ ...open, lateAllowed: true }, entries)).toBeUndefined();
    expect(taskPutAway({ ...open, editedAt: at("2026-10-13T10:00:00") }, entries)).toBeUndefined();
    // Another Task of the class is another Task.
    expect(taskPutAway({ ...open, id: 117002 }, entries)).toBeUndefined();
  });

  it("a target out of reach: SIX counting another meeting is no news; a new target is", async () => {
    const h = await startHome({ now: MONDAY });
    const before = doneTerms(need(needsYou(h.home()), "attendance:KU5014"))!.key;
    const entries = putAway([], before, "gotIt", h.world.clock.now());
    h.world.six.setAttendance("KU5014", 2, 7);
    await h.refresh();
    expect(activeDone(doneTerms(need(needsYou(h.home()), "attendance:KU5014"))!.key, entries)).toBeDefined();
    await h.engine.updateSettings({ attendanceTargets: { KU5014: 75 } });
    const ku = needsYou(h.home()).find((n) => n.id.startsWith("attendance:KU5014"));
    // At 75% it may be in reach again, or still out: either way it's not the item that was seen.
    expect(ku ? activeDone(doneTerms(ku)!.key, entries) : undefined).toBeUndefined();
  });

  it("a class's warning: each class is its own item; with no class known, back when SIX counts another", () => {
    const health = { state: "none", target: 80, attended: 9, held: 10 } as AttendanceHealth;
    const item = (atMs: number | null): NeedDraft => ({
      id: "attendance:PL3032:none",
      kind: "attendance",
      course: "PL3032",
      band: "soon",
      at: atMs,
      sources: ["six"],
      action: { kind: "go", route: { screen: "presence" } },
      health,
    });
    expect(doneTerms(item(at("2026-10-15T15:00:00")))?.key).toEqual({ id: "attendance:PL3032:class:2026-10-15", facts: "none|80" });
    expect(doneTerms(item(at("2026-10-22T15:00:00")))?.key.id).toBe("attendance:PL3032:class:2026-10-22");
    expect(doneTerms(item(null))?.key).toEqual({ id: "attendance:PL3032:none", facts: "none|80|9/10" });
  });

  it("a bill marked paid: back when the bill changes, or once it's overdue", () => {
    const bill = { term: "2026-1", amount: 5_000_000, paid: 0, nextDueAt: at("2026-10-20T23:59:59") };
    const entries = putAway([], billDoneKey(bill, false), "paid", at("2026-10-12T09:00:00"));
    expect(activeDone(billDoneKey(bill, false), entries)).toBeDefined();
    expect(activeDone(billDoneKey({ ...bill, paid: 2_500_000 }, false), entries)).toBeUndefined();
    expect(activeDone(billDoneKey(bill, true), entries)).toBeUndefined();
  });

  it("handled and snoozed on the same id don't fight: each list answers for itself", async () => {
    const h = await startHome({ now: MONDAY });
    const now = h.world.clock.now();
    const ku = need(needsYou(h.home()), "attendance:KU5014");
    const done = putAway([], doneTerms(ku)!.key, "gotIt", now);
    const snoozes = [{ id: "attendance:KU5014", facts: snoozeKey(ku).facts, until: now + DAY }];
    // Showing it again (the handled list emptied) leaves the course banner's snooze; waking that leaves it handled.
    expect(activeSnooze(snoozeKey(ku), snoozes, now)).toBeDefined();
    expect(activeDone(doneTerms(ku)!.key, [])).toBeUndefined();
    expect(activeDone(doneTerms(ku)!.key, done)?.how).toBe("gotIt");
    const { shown, done: away } = partitionDone([ku], (n) => doneTerms(n)?.key ?? null, done);
    expect(shown).toEqual([]);
    expect(away.map((d) => d.entry.how)).toEqual(["gotIt"]);
  });
});

describe("keeping the list", () => {
  const entry = (id: string, at: number, how: DoneEntry["how"] = "checked"): DoneEntry => ({ id, facts: "x", at, how });
  const now = at("2026-10-12T09:00:00");

  it("never drops an entry because Beranda doesn't show its item right now", () => {
    // Not handing it in, marked three weeks before it's due: Beranda lists it only from a week out.
    const early = entry("task:117001", now - 2 * DAY, "notHandingIn");
    // Checked eight days after the edit: the row left Beranda a day ago, the Task page still reads it.
    const checked = entry("task:117432:edited", now - 8 * DAY);
    expect(pruneDone([early, checked], now, { tasks: new Set([117001, 117432]) })).toEqual([early, checked]);
  });

  it("drops what's over 180 days old, and what's about a Task, course or bill that's gone (only once that list is known)", () => {
    const entries = [
      entry("task:1", now - 181 * DAY),
      entry("task:117001", now - DAY),
      entry("task:999", now - DAY),
      entry("attendance:KU5014", now - DAY, "gotIt"),
      entry("attendance:XX1000:class:2026-10-15", now - DAY, "gotIt"),
      entry("bill:2025-2", now - DAY, "paid"),
    ];
    expect(pruneDone(entries, now, { tasks: new Set([117001]), courses: new Set(["KU5014"]), bills: new Set(["2026-1"]) }).map((e) => e.id)).toEqual([
      "task:117001",
      "attendance:KU5014",
    ]);
    // Before the datasets arrive nothing is judged gone.
    expect(pruneDone(entries, now).map((e) => e.id)).toEqual(entries.slice(1).map((e) => e.id));
  });

  it("keeps the newest 300, and what it writes always loads back", () => {
    // Newest last, as the list is written.
    const many = Array.from({ length: 320 }, (_, i) => entry(`task:${i}`, now - (320 - i) * 60_000));
    const kept = pruneDone(many, now);
    expect(kept).toHaveLength(300);
    expect(kept[0]?.id).toBe("task:20");
    const next = putAway(kept, { id: "task:117001", facts: "1|false|false|" }, "handedElsewhere", now);
    expect(Datasets["local.done"].safeParse(next).success).toBe(true);
    expect(next.filter((e) => e.id === "task:117001")).toHaveLength(1);
  });
});
