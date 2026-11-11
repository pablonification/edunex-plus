// The iPhone's widgets' document (mobile/src/widget-ios/doc.ts): Android's widget model, from the real engine against
// the pretend Edunex and SIX, made ready for a widget that can't import anything (every tap a link, every colour a
// hex for both looks), and plain JSON, as the shared store keeps it. Thursday 8 October, as widget-model.test.ts.
import { describe, expect, it } from "vitest";
import type { WidgetTarget } from "../../mobile/src/widget/model";
import { widgetModel } from "../../mobile/src/widget/model";
import { courseColor, type IosWidgetDoc, iosWidgetDoc, setupDoc, storable } from "../../mobile/src/widget-ios/doc";
import { liveDoc } from "../../mobile/src/widget-ios/live-doc";
import { startEngine } from "../engine/harness";
import { startHome } from "../engine/needs-harness";

const link = (open: WidgetTarget) => `edunexplus-test://${JSON.stringify(open)}`;
const docOf = (h: { engine: { snapshot(): Parameters<typeof widgetModel>[0] }; world: { clock: { now(): number } } }): IosWidgetDoc =>
  iosWidgetDoc(widgetModel(h.engine.snapshot(), h.world.clock.now()), "Edunex Plus", link);
const HEX = /^#[0-9a-f]{6}$/i;

describe("the iPhone widgets' document", () => {
  it("the class on now, with its start for the Lock Screen, its course colour in both looks and its link", async () => {
    const h = await startHome();
    const doc = docOf(h);
    expect(doc).toMatchObject({ v: 1, state: "ready", title: "Edunex Plus", hint: null, url: link({ kind: "route", route: { screen: "home" } }) });
    expect(doc.now).toMatchObject({
      kind: "class",
      heading: "Sedang berlangsung",
      live: true,
      code: "PL3002",
      time: "08:00–10:00",
      start: "08:00",
      url: link({ kind: "route", route: { screen: "course", code: "PL3002", tab: "meetings" } }),
    });
    const color = doc.now?.kind === "class" ? doc.now.color : null;
    expect(color?.light).toMatch(HEX);
    expect(color?.dark).toMatch(HEX);
    // The Presence to fill in is a quiet button: only SIX's "Tandai Hadir" is the main one.
    expect(doc.actions).toEqual([
      {
        label: "Isi Presensi PL3002",
        detail: "Tutup 09:30",
        a11y: null,
        url: link({ kind: "url", url: "https://edunex.itb.ac.id/courses/95001" }),
        primary: false,
      },
    ]);
    for (const palette of [doc.colors.light, doc.colors.dark]) for (const value of Object.values(palette)) expect(value).toMatch(HEX);
  });

  it("Tandai Hadir open in SIX: the main button, opening SIX's check-in page", async () => {
    const h = await startHome();
    h.world.six.openCheckIn("2194342");
    await h.until("2026-10-08T08:40:00+07:00");
    expect(docOf(h).actions[0]).toMatchObject({ primary: true, detail: "PL3002", url: link({ kind: "checkIn", meetingId: "2194342" }) });
  });

  it("Hari ini: every class with its colour and link, the next deadline; and the whole is plain JSON", async () => {
    const h = await startHome();
    const doc = docOf(h);
    expect(doc.today?.heading).toBe("Hari ini · Kam 8 Okt");
    expect(doc.today?.classes.length).toBeGreaterThan(0);
    for (const one of doc.today?.classes ?? []) {
      expect(one.color.light).toMatch(HEX);
      expect(one.url).toMatch(/^edunexplus-test:\/\/\{"kind":"class"/);
    }
    expect(doc.today?.deadline?.label).toMatch(/^Tenggat /);
    expect(JSON.parse(JSON.stringify(doc))).toStrictEqual(doc);
  });

  it("no class in the coming week is a line, not a class", async () => {
    const h = await startHome();
    await h.until("2026-10-08T18:00:00+07:00");
    // The next class is tomorrow's: still a class. A line only when the model says there's none.
    expect(docOf(h).now?.kind).toBe("class");
  });

  it("never signed in: the status says where to start, and nothing else", async () => {
    const h = await startEngine();
    const doc = docOf(h);
    expect(doc.status).toEqual({ text: "Hubungkan Edunex atau SIX dulu", problem: true });
    expect([doc.now, doc.actions, doc.needs, doc.today]).toEqual([null, [], null, null]);
  });

  it("before anything is saved: the setup document, and a course without a colour is grey", () => {
    expect(setupDoc("Edunex Plus", "Hubungkan Edunex atau SIX dulu", "edunexplus://")).toMatchObject({ v: 1, state: "setup", now: null, today: null });
    expect(courseColor(undefined)).toEqual({ light: "#5f6673", dark: "#9aa1ae" });
  });

  it("what the iPhone's store is handed has no null anywhere: iOS refuses a document with one, and that closed the app", async () => {
    const nulls = (value: unknown, path = "doc"): string[] =>
      value === null || value === undefined
        ? [path]
        : typeof value === "object"
          ? Object.entries(value).flatMap(([key, one]) => nulls(one, `${path}.${key}`))
          : [];
    const h = await startHome();
    const signedOut = docOf(await startEngine());
    const docs = [docOf(h), signedOut, setupDoc("Edunex Plus", null, ""), setupDoc("Edunex Plus", "Hubungkan Edunex atau SIX dulu", "edunexplus://")];
    // The documents do have empty fields: the store's copy is what mustn't.
    expect(docs.flatMap((doc) => nulls(doc)).length).toBeGreaterThan(0);
    for (const doc of docs) expect(nulls(storable(doc))).toEqual([]);
    // Nothing else is lost: what is there is kept as it was, lists in their order.
    const kept = storable(docOf(h));
    expect(kept).toMatchObject({ v: 1, state: "ready", status: docOf(h).status, colors: docOf(h).colors });
    expect(kept.actions.map((one) => one.label)).toEqual(docOf(h).actions.map((one) => one.label));
    expect(kept.today?.classes.map((one) => one.code)).toEqual(docOf(h).today?.classes.map((one) => one.code));
    expect("hint" in kept).toBe(false);
    expect(storable({ list: [1, null, { a: null, b: 0, c: false, d: "" }] })).toEqual({ list: [1, { b: 0, c: false, d: "" }] });
  });

  it("the Live Activity: the class on now, its end, and its Presence window's close for iOS to count down", async () => {
    const h = await startHome();
    const live = liveDoc(h.engine.snapshot(), h.world.clock.now(), docOf(h));
    expect(live).toMatchObject({
      key: `PL3002@${Date.parse("2026-10-08T08:00:00+07:00")}`,
      code: "PL3002",
      detail: "08:00–10:00 · R.SG PWK LT.6",
      startsAt: Date.parse("2026-10-08T08:00:00+07:00"),
      endsAt: Date.parse("2026-10-08T10:00:00+07:00"),
      // The window's close is the countdown: its words keep only what to do.
      presence: { label: "Isi Presensi PL3002", closesAt: Date.parse("2026-10-08T09:30:00+07:00") },
      checkIn: null,
    });
    expect(JSON.parse(JSON.stringify(live))).toStrictEqual(live);
  });

  it("no Live Activity between classes", async () => {
    const h = await startHome();
    await h.until("2026-10-08T10:30:00+07:00");
    expect(liveDoc(h.engine.snapshot(), h.world.clock.now(), docOf(h))).toBeNull();
  });
});
