// Alerts on the Student's phone through ntfy, by the real engine against the
// pretend Edunex and a pretend ntfy on a fake clock: what's sent now, what's
// booked ahead (and cancelled), quiet hours, the "laptop hasn't checked"
// warning, unlinking, and that the topic stays out of everything the app writes
// or says. Times are Bandung's (vitest.config.ts).
import { afterEach, describe, expect, it, vi } from "vitest";
import { edunexCourseUrl } from "../../src/core/links";
import { edunexTaskUrl } from "../../src/core/tasks";
import { phoneMessage, phoneTime, quietUntil, sequenceId } from "../../src/engine/alerts/phone";
import { PRETEND_TOKEN, wib } from "../pretend/edunex";
import { startAlerts } from "./alerts-harness";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const COURSE = 95326;

const due24 = (task: number, due: number) => sequenceId(`task.due24:${task}:${due}`);
const due3 = (task: number, due: number) => sequenceId(`task.due3:${task}:${due}`);
/** ntfy's delay for a moment in Bandung. */
const delayAt = (iso: string) => String(Date.parse(iso) / 1000);

/** Signed in, past the first sync, with the phone linked. */
async function linked() {
  const app = await startAlerts();
  await app.wait(10 * MINUTE);
  const link = await app.engine.phone.connect();
  if (!link.connected) throw new Error("not linked");
  await app.engine.phone.idle();
  const topic = link.topic;
  /** The reminders booked: sequence IDs, the "laptop hasn't checked" warning left out. */
  const booked = () =>
    app.ntfy
      .booked(topic)
      .map((message) => message.sequence_id)
      .filter((id) => id !== "ep-watchdog");
  /** Posts a Task due `ahead` from now and lets the app read it. */
  const taskDue = async (ahead: number, name?: string) => {
    const due = Math.floor((app.world.clock.now() + ahead) / MINUTE) * MINUTE;
    const id = app.world.edunex.postTask(COURSE, { end_at: wib(due), ...(name ? { name } : {}) });
    await app.wait(5 * MINUTE);
    return { id, due };
  };
  const posts = () => app.ntfy.posts().filter((message) => message.sequence_id !== "ep-watchdog");
  return { ...app, topic, booked, taskDue, posts };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("booking ahead", () => {
  it("books reminders due within 3 days and not beyond, then the later ones once they come within reach", async () => {
    const app = await linked();
    const near = await app.taskDue(2 * DAY, "Laporan kemajuan");
    const far = await app.taskDue(3 * DAY + 4 * HOUR);
    expect(app.booked()).toEqual(expect.arrayContaining([due24(near.id, near.due), due3(near.id, near.due), due24(far.id, far.due)]));
    expect(app.booked()).not.toContain(due3(far.id, far.due));
    const limit = (app.world.clock.now() + 3 * DAY) / 1000;
    expect(app.ntfy.booked(app.topic).every((message) => Number(message.delay) <= limit)).toBe(true);

    // The message: in the Student's language, the phone-only line last, a tap opens the Task on Edunex.
    const reminder = app.ntfy.booked(app.topic).find((message) => message.sequence_id === due24(near.id, near.due));
    expect(reminder).toMatchObject({
      title: "Tenggat 24 jam lagi · II4091",
      message: "Laporan kemajuan · belum dikumpulkan\nAbaikan kalau sudah dikumpulkan.",
      priority: 3,
      click: edunexTaskUrl(near.id),
      delay: String((near.due - DAY) / 1000),
    });

    await app.wait(4 * HOUR);
    expect(app.booked()).toContain(due3(far.id, far.due));
  });

  it("posts only what changed: nothing while the plan stays, everything again under the same IDs when the language changes", async () => {
    const app = await linked();
    // Past 2 days, so its 2-day reminder is still to come and is booked too.
    await app.taskDue(2 * DAY + 6 * HOUR);
    const before = app.posts().length;
    const ids = app.booked();
    await app.wait(2 * HOUR);
    expect(app.posts()).toHaveLength(before);
    // What came due meanwhile (another reminder of the term) was delivered: it isn't posted again.
    const waiting = app.ntfy
      .booked(app.topic)
      .filter((message) => message.sequence_id !== "ep-watchdog" && Number(message.delay) * 1000 > app.world.clock.now())
      .map((message) => message.sequence_id);

    await app.engine.updateSettings({ lang: "en" });
    await app.wait(6 * MINUTE);
    const again = app.posts().slice(before);
    expect(again.map((message) => message.sequence_id).sort()).toEqual([...waiting].sort());
    expect(app.ntfy.deletes()).toEqual([]);
    expect(app.booked().sort()).toEqual([...ids].sort());
    expect(again.find((message) => message.title?.startsWith("Due in 24 hours"))?.message).toMatch(/Ignore this if you've already handed it in\.$/);
  });

  it("cancels the reminders of a Task handed in, and moves those of a moved deadline", async () => {
    const app = await linked();
    const handedIn = await app.taskDue(2 * DAY);
    const moved = await app.taskDue(2 * DAY + HOUR);
    expect(app.booked()).toEqual(expect.arrayContaining([due24(handedIn.id, handedIn.due), due24(moved.id, moved.due)]));

    app.world.edunex.submitOnWebsite(handedIn.id);
    const later = moved.due + 6 * HOUR;
    app.world.edunex.moveDeadline(moved.id, wib(later));
    await app.wait(20 * MINUTE);
    expect(app.ntfy.deletes()).toEqual(
      expect.arrayContaining([due24(handedIn.id, handedIn.due), due3(handedIn.id, handedIn.due), due24(moved.id, moved.due), due3(moved.id, moved.due)]),
    );
    expect(app.booked()).not.toContain(due24(handedIn.id, handedIn.due));
    expect(app.booked()).not.toContain(due24(moved.id, moved.due));
    expect(app.booked()).toContain(due24(moved.id, later));
  });

  it("cancels a group the Student turns off", async () => {
    const app = await linked();
    const task = await app.taskDue(2 * DAY);
    expect(app.booked()).toContain(due24(task.id, task.due));
    await app.engine.updateSettings({ mutedAlerts: ["deadline"] });
    await app.wait(6 * MINUTE);
    expect(app.ntfy.deletes()).toContain(due24(task.id, task.due));
    expect(app.ntfy.booked(app.topic).filter((message) => message.title?.startsWith("Tenggat"))).toEqual([]);
  });

  it("doesn't send a booked reminder again when the laptop raises it, and sends what wasn't booked at once", async () => {
    const app = await linked();
    const task = await app.taskDue(DAY + HOUR, "Esai singkat");
    expect(app.booked()).toContain(due24(task.id, task.due));
    // The new-Task alert wasn't booked: it went out now, with a tap to the Task on Edunex.
    expect(app.ntfy.sent).toEqual([
      expect.objectContaining({ title: "Tugas baru · II4091", message: "Esai singkat", priority: 3, click: edunexTaskUrl(task.id) }),
    ]);

    await app.wait(HOUR);
    expect(app.shown.filter((notice) => notice.kind === "deadline")).toHaveLength(1);
    expect(app.ntfy.sent).toHaveLength(1);
  });

  it("tries again later when offline, and waits longer each time ntfy says it's busy", async () => {
    const app = await linked();
    app.ntfy.answer = "offline";
    const task = await app.taskDue(2 * DAY);
    expect(app.booked()).not.toContain(due24(task.id, task.due));
    expect(app.engine.phone.link()).toMatchObject({ problem: "offline" });
    app.ntfy.answer = "ok";
    await app.wait(6 * MINUTE);
    expect(app.booked()).toContain(due24(task.id, task.due));
    expect(app.engine.phone.link()).toMatchObject({ problem: null });

    app.ntfy.answer = "busy";
    await app.taskDue(2 * DAY);
    expect(app.engine.phone.link()).toMatchObject({ problem: "busy" });
    const tried = app.ntfy.log.length;
    await app.wait(10 * MINUTE);
    expect(app.ntfy.log).toHaveLength(tried);
    await app.wait(6 * MINUTE);
    expect(app.ntfy.log).toHaveLength(tried + 1);
    // Busy again: the next wait is twice as long.
    await app.wait(25 * MINUTE);
    expect(app.ntfy.log).toHaveLength(tried + 1);
    await app.wait(10 * MINUTE);
    expect(app.ntfy.log).toHaveLength(tried + 2);
  });

  it("never stops the OS notification when ntfy fails", async () => {
    const app = await linked();
    app.ntfy.answer = "offline";
    await app.taskDue(2 * DAY + 6 * HOUR, "Esai kebijakan");
    expect(app.shown.map((notice) => notice.text)).toEqual(["Tugas baru · II4091 — Esai kebijakan"]);
  });
});

describe("quiet hours on the phone", () => {
  const T = (iso: string) => Date.parse(`${iso}+07:00`);
  const night = { start: 22, end: 6 };

  it("ends them at the next end hour, across midnight or inside a day, and not outside them", () => {
    expect(quietUntil(T("2026-10-08T23:00:00"), night)).toBe(T("2026-10-09T06:00:00"));
    expect(quietUntil(T("2026-10-08T22:00:00"), night)).toBe(T("2026-10-09T06:00:00"));
    expect(quietUntil(T("2026-10-09T03:30:00"), night)).toBe(T("2026-10-09T06:00:00"));
    expect(quietUntil(T("2026-10-09T06:00:00"), night)).toBeNull();
    expect(quietUntil(T("2026-10-08T21:59:00"), night)).toBeNull();
    const lunch = { start: 13, end: 15 };
    expect(quietUntil(T("2026-10-08T13:00:00"), lunch)).toBe(T("2026-10-08T15:00:00"));
    expect(quietUntil(T("2026-10-08T14:59:00"), lunch)).toBe(T("2026-10-08T15:00:00"));
    expect(quietUntil(T("2026-10-08T15:00:00"), lunch)).toBeNull();
    expect(quietUntil(T("2026-10-08T23:00:00"), lunch)).toBeNull();
    expect(quietUntil(T("2026-10-08T23:00:00"), null)).toBeNull();
  });

  it("moves a planned alert that can wait to their end, unless it's urgent or over by then", () => {
    const at = T("2026-10-08T23:00:00");
    const until = T("2026-10-09T20:00:00");
    expect(phoneTime({ kind: "deadline", at, until }, night)).toBe(T("2026-10-09T06:00:00"));
    expect(phoneTime({ kind: "deadline", at, until: T("2026-10-09T02:00:00") }, night)).toBe(at);
    expect(phoneTime({ kind: "presenceOpen", at, until }, night)).toBe(at);
    expect(phoneTime({ kind: "presenceClosing", at, until }, night)).toBe(at);
    expect(phoneTime({ kind: "classSoon", at, until }, night)).toBe(at);
    expect(phoneTime({ kind: "exam", urgent: true, at, until }, night)).toBe(at);
    expect(phoneTime({ kind: "deadline", at, until }, null)).toBe(at);
  });

  it("books what can wait for 06:00 instead of sending it at 23:00; urgent alerts and the laptop's own notification come at once", async () => {
    const app = await linked();
    await app.until("2026-10-08T23:00:00+07:00");
    const later = await app.taskDue(3 * DAY, "Esai malam");
    expect(app.shown.map((notice) => notice.text)).toContain("Tugas baru · II4091 — Esai malam");
    expect(app.ntfy.sent).toEqual([]);
    expect(app.ntfy.booked(app.topic).find((message) => message.sequence_id === sequenceId(`task.new:${later.id}`))).toMatchObject({
      title: "Tugas baru · II4091",
      delay: delayAt("2026-10-09T06:00:00+07:00"),
    });

    const soon = await app.taskDue(5 * HOUR, "Kuis kilat");
    expect(app.ntfy.sent).toEqual([expect.objectContaining({ sequence_id: sequenceId(`task.new:${soon.id}`), title: "Tugas singkat · II4091" })]);
    expect(app.ntfy.sent[0].delay).toBeUndefined();

    // Unlinking cancels what's held too (what was delivered earlier in the day is past cancelling).
    await app.engine.phone.disconnect();
    expect(app.ntfy.booked(app.topic).filter((message) => Number(message.delay) * 1000 > app.world.clock.now())).toEqual([]);
  });

  it("books a reminder at 02:00 for 06:00, keeps one at 23:00 whose deadline comes first, and doesn't cancel it when the laptop raises it", async () => {
    const app = await linked();
    const due = Date.parse("2026-10-10T02:00:00+07:00");
    const id = app.world.edunex.postTask(COURSE, { end_at: wib(due) });
    await app.wait(5 * MINUTE);
    const delays = () => Object.fromEntries(app.ntfy.booked(app.topic).map((message) => [message.sequence_id, message.delay]));
    expect(delays()).toMatchObject({ [due24(id, due)]: delayAt("2026-10-09T06:00:00+07:00"), [due3(id, due)]: delayAt("2026-10-09T23:00:00+07:00") });

    await app.until("2026-10-09T02:30:00+07:00");
    expect(app.shown.filter((notice) => notice.kind === "deadline")).toHaveLength(1);
    expect(app.ntfy.sent.map((message) => message.sequence_id)).not.toContain(due24(id, due));
    expect(app.ntfy.deletes()).not.toContain(due24(id, due));
    expect(delays()[due24(id, due)]).toBe(delayAt("2026-10-09T06:00:00+07:00"));
  });

  it("books everything again when the Student changes them, and at the alerts' own times when turned off", async () => {
    const app = await linked();
    const due = Date.parse("2026-10-10T02:00:00+07:00");
    const id = app.world.edunex.postTask(COURSE, { end_at: wib(due) });
    await app.wait(5 * MINUTE);
    const reminder = () => app.ntfy.booked(app.topic).find((message) => message.sequence_id === due24(id, due))?.delay;
    expect(reminder()).toBe(delayAt("2026-10-09T06:00:00+07:00"));

    await app.engine.updateSettings({ phoneQuietHours: { start: 1, end: 5 } });
    await app.wait(6 * MINUTE);
    expect(reminder()).toBe(delayAt("2026-10-09T05:00:00+07:00"));
    await app.engine.updateSettings({ phoneQuietHours: null });
    await app.wait(6 * MINUTE);
    expect(reminder()).toBe(delayAt("2026-10-09T02:00:00+07:00"));
    expect(app.ntfy.deletes()).toEqual([]);

    // Off: what's raised at 23:00 goes now.
    await app.until("2026-10-08T23:00:00+07:00");
    const task = await app.taskDue(3 * DAY, "Esai malam");
    expect(app.ntfy.sent.at(-1)).toMatchObject({ sequence_id: sequenceId(`task.new:${task.id}`), message: "Esai malam" });
    expect(app.ntfy.sent.at(-1)?.delay).toBeUndefined();
  });

  it("moves the 'laptop hasn't checked' warning out of them", async () => {
    const app = await linked();
    await app.until("2026-10-08T23:00:00+07:00");
    const warning = app.ntfy.booked(app.topic).find((message) => message.sequence_id === "ep-watchdog");
    expect(warning?.delay).toBe(delayAt("2026-10-10T06:00:00+07:00"));
  });
});

describe("the 'laptop hasn't checked' warning", () => {
  it("is booked a day after the last good read of Edunex, moved at most once an hour, and cancelled when signed out of Edunex", async () => {
    const app = await linked();
    const warnings = () => app.ntfy.posts().filter((message) => message.sequence_id === "ep-watchdog");
    expect(warnings()).toHaveLength(1);
    expect(warnings()[0].message).toMatch(
      /^Edunex Plus belum mengecek Edunex sejak Kam, 8 Okt \d\d:\d\d\. Buka laptop sebentar supaya tugas baru tidak terlewat\.$/,
    );
    expect(Number(warnings()[0].delay) * 1000).toBeGreaterThan(app.world.clock.now() + 23 * HOUR);

    await app.wait(50 * MINUTE);
    expect(warnings()).toHaveLength(1);
    await app.wait(15 * MINUTE);
    expect(warnings()).toHaveLength(2);
    await app.wait(2 * HOUR);
    expect(warnings().length).toBeLessThanOrEqual(4);
    expect(Number(warnings().at(-1)!.delay) * 1000).toBeGreaterThan(app.world.clock.now() + 22 * HOUR);

    await app.engine.signOut("edunex");
    await app.engine.phone.idle();
    expect(app.ntfy.deletes()).toContain("ep-watchdog");
    expect(app.ntfy.booked(app.topic).filter((message) => message.sequence_id === "ep-watchdog")).toEqual([]);
  });
});

describe("unlinking", () => {
  it("disconnect cancels everything booked and forgets the topic", async () => {
    const app = await linked();
    await app.taskDue(2 * DAY);
    expect(app.ntfy.booked(app.topic).length).toBeGreaterThan(2);
    expect(await app.engine.phone.disconnect()).toEqual({ cancelled: true });
    expect(app.ntfy.booked(app.topic)).toEqual([]);
    expect(app.engine.phone.link()).toEqual({ connected: false });
    expect([...app.vault.secrets.keys()]).not.toContain("phone.ntfy");
    const sent = app.ntfy.log.length;
    await app.taskDue(2 * DAY);
    expect(app.ntfy.log).toHaveLength(sent);
  });

  it("says so when ntfy can't be reached to cancel", async () => {
    const app = await linked();
    await app.taskDue(2 * DAY);
    app.ntfy.answer = "offline";
    expect(await app.engine.phone.disconnect()).toEqual({ cancelled: false });
    expect(app.engine.phone.link()).toEqual({ connected: false });
  });

  it("signing out of everything cancels everything and unlinks the phone", async () => {
    const app = await linked();
    await app.taskDue(2 * DAY);
    await app.engine.signOut();
    expect(app.ntfy.booked(app.topic)).toEqual([]);
    expect(app.engine.phone.link()).toEqual({ connected: false });
  });

  it("another Student signing in on this computer unlinks the last one's phone", async () => {
    const app = await linked();
    await app.taskDue(2 * DAY);
    app.world.edunex.me = { ...app.world.edunex.me, name: "Rina Sari", code: "18224999" };
    await app.engine.signIn("edunex", { token: PRETEND_TOKEN });
    await app.wait(MINUTE);
    expect(app.ntfy.booked(app.topic)).toEqual([]);
    expect(app.engine.phone.link()).toEqual({ connected: false });
  });

  it("keeps the link and what's booked across a restart, without posting it again", async () => {
    const app = await linked();
    await app.taskDue(2 * DAY);
    const posted = app.posts().length;
    app.engine.stop();
    const again = await startAlerts({ world: app.world, storage: app.storage, vault: app.vault, ntfy: app.ntfy, signIn: false });
    await again.wait(30 * MINUTE);
    expect(again.engine.phone.link()).toMatchObject({ connected: true, topic: app.topic });
    expect(app.posts()).toHaveLength(posted);
  });
});

describe("the message", () => {
  const courses = [{ code: "PL3032", name: "Ekonomi", classNo: "01", term: "2026-1", edunex: { courseId: 95059, classId: 1, relatedCourseIds: [] } }];
  const base = { id: "x", source: "edunex", body: { key: "alert.plain", vars: { title: "Tugas 1" } } } as const;

  it("comes through first for Presence opening and other urgent alerts, as default for the rest", () => {
    const presence = { ...base, kind: "presenceOpen", title: { key: "alert.plain", vars: { title: "Presensi" } }, target: { screen: "presence" } } as const;
    const task = { ...base, kind: "newTask", title: { key: "alert.newTask", vars: { course: "PL3032" } }, target: { screen: "task", taskId: 7 } } as const;
    expect(phoneMessage(presence, "id", { ahead: false, courses }).priority).toBe(4);
    expect(phoneMessage({ ...task, urgent: true }, "id", { ahead: false, courses }).priority).toBe(4);
    expect(phoneMessage(task, "id", { ahead: false, courses }).priority).toBe(3);
  });

  it("ends a booked deadline or Presence alert with what the Student may have done since, only when booked", () => {
    const deadline = { ...base, kind: "deadline", title: { key: "alert.due24", vars: { course: "PL3032" } }, target: { screen: "task", taskId: 7 } } as const;
    const presence = { ...base, kind: "presenceOpen", title: { key: "alert.plain", vars: { title: "Presensi" } }, target: { screen: "presence" } } as const;
    const grade = { ...base, kind: "grade", title: { key: "alert.plain", vars: { title: "Nilai" } }, target: { screen: "grades" } } as const;
    expect(phoneMessage(deadline, "id", { ahead: true, courses }).message).toBe("Tugas 1\nAbaikan kalau sudah dikumpulkan.");
    expect(phoneMessage(deadline, "en", { ahead: true, courses }).message).toBe("Tugas 1\nIgnore this if you've already handed it in.");
    expect(phoneMessage(presence, "id", { ahead: true, courses }).message).toBe("Tugas 1\nAbaikan kalau sudah tercatat hadir.");
    expect(phoneMessage(grade, "id", { ahead: true, courses }).message).toBe("Tugas 1");
    expect(phoneMessage(deadline, "id", { ahead: false, courses }).message).toBe("Tugas 1");
  });

  it("opens the Task's or the course's Edunex page when tapped, and nothing for other screens", () => {
    const at = (target: Parameters<typeof phoneMessage>[0]["target"]) =>
      phoneMessage({ ...base, kind: "newTask", title: { key: "alert.plain", vars: { title: "x" } }, target }, "id", { ahead: false, courses }).click;
    expect(at({ screen: "task", taskId: 7 })).toBe(edunexTaskUrl(7));
    expect(at({ screen: "course", code: "PL3032", tab: "meetings" })).toBe(edunexCourseUrl(95059));
    expect(at({ screen: "course", code: "XX0000" })).toBeUndefined();
    expect(at({ screen: "schedule" })).toBeUndefined();
  });

  it("stays under ntfy's 4096 bytes", () => {
    const long = { ...base, kind: "newTask", title: { key: "alert.plain", vars: { title: "Judul" } }, target: { screen: "home" } } as const;
    const message = phoneMessage({ ...long, body: { key: "alert.plain", vars: { title: "é".repeat(5_000) } } }, "id", { ahead: false, courses });
    expect(new TextEncoder().encode(message.message).length).toBeLessThan(4096);
    expect(message.message.endsWith("…")).toBe(true);
  });
});

describe("the topic", () => {
  it("never appears in what the app writes in the clear, its events, its logs or its errors, and is gone after signing out of everything", async () => {
    const said: unknown[] = [];
    for (const method of ["log", "info", "warn", "error"] as const) vi.spyOn(console, method).mockImplementation((...args) => void said.push(...args));
    const app = await linked();
    await app.taskDue(2 * DAY);
    app.ntfy.answer = "offline";
    await app.taskDue(2 * DAY);
    await app.engine.phone.test();
    app.ntfy.answer = "busy";
    await app.wait(HOUR);
    expect(app.ntfy.posts().every((message) => message.topic === app.topic)).toBe(true);
    const leaks = (text: string) => text.includes(app.topic) || text.includes(app.topic.slice(7));
    expect([...app.storage.files.values()].filter(leaks)).toEqual([]);
    expect(leaks(JSON.stringify(app.events))).toBe(false);
    expect(leaks(JSON.stringify(app.engine.snapshot()))).toBe(false);
    expect(said.map(String).filter(leaks)).toEqual([]);

    await app.engine.signOut();
    expect([...app.vault.secrets.values()].filter(leaks)).toEqual([]);
  });
});
