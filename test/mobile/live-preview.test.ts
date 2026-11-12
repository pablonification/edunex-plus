// Settings' "Coba Aktivitas Langsung" on an iPhone (mobile/src/widget-ios/live-preview.ts): a made-up class that is on
// now, in the very shape the real Live Activity is handed (live-doc.ts's LiveDoc), and the rule that keeps it running
// after the app is left, when the widgets' update would otherwise end it for want of a real class.
import { describe, expect, it } from "vitest";
import { widgetModel } from "../../mobile/src/widget/model";
import { iosWidgetDoc } from "../../mobile/src/widget-ios/doc";
import { liveDoc } from "../../mobile/src/widget-ios/live-doc";
import { PREVIEW_KEY, parseMark, previewLiveDoc, previewProblem, previewStep } from "../../mobile/src/widget-ios/live-preview";
import { startHome } from "../engine/needs-harness";

const NOW = Date.parse("2026-11-12T10:20:00+07:00");
const MINUTE = 60_000;
const HEX = /^#[0-9a-f]{6}$/i;

describe("the Live Activity's preview", () => {
  it("is a class on now: started 5 minutes ago, ending in 15, its Presence window closing in 10", () => {
    const doc = previewLiveDoc("id", NOW, "edunexplus://");
    expect(doc).toMatchObject({
      v: 1,
      key: PREVIEW_KEY,
      name: "Contoh Kuliah",
      startsAt: NOW - 5 * MINUTE,
      endsAt: NOW + 15 * MINUTE,
      presence: { label: `Isi Presensi ${doc.code}`, closesAt: NOW + 10 * MINUTE, url: "edunexplus://" },
      checkIn: null,
      url: "edunexplus://",
    });
    expect(doc.detail).toMatch(/^\d\d:\d\d–\d\d:\d\d · Ruang Contoh$/);
    expect(previewLiveDoc("en", NOW, "edunexplus://")).toMatchObject({ name: "Sample Class", presence: { label: `Fill in ${doc.code} Presence` } });
  });

  it("has the real one's shape, field for field, and is plain JSON with both looks' colours", async () => {
    const h = await startHome();
    const now = h.world.clock.now();
    const real = liveDoc(
      h.engine.snapshot(),
      now,
      iosWidgetDoc(widgetModel(h.engine.snapshot(), now), "Edunex Plus", () => "edunexplus://"),
    );
    const doc = previewLiveDoc("id", NOW, "edunexplus://");
    expect(Object.keys(doc).sort()).toEqual(Object.keys(real!).sort());
    expect(Object.keys(doc.presence!).sort()).toEqual(Object.keys(real!.presence!).sort());
    expect(doc.colors).toEqual(real!.colors);
    expect(doc.color.light).toMatch(HEX);
    expect(doc.color.dark).toMatch(HEX);
    expect(JSON.parse(JSON.stringify(doc))).toStrictEqual(doc);
  });

  describe("what the widgets' update does with the activity that's running", () => {
    const mark = { id: "A1", endsAt: NOW + 15 * MINUTE };

    it("keeps the preview while no class is on, until its own end", () => {
      expect(previewStep(mark, "A1", false, NOW + MINUTE)).toBe("keep");
      expect(previewStep(mark, "A1", false, mark.endsAt - 1)).toBe("keep");
    });

    it("after its end, the usual rule cleans it up", () => {
      expect(previewStep(mark, "A1", false, mark.endsAt)).toBe("usual");
    });

    it("a real class starting meanwhile takes the activity over", () => {
      expect(previewStep(mark, "A1", true, NOW + MINUTE)).toBe("handOver");
      // Past the preview's end too: the class is what's on.
      expect(previewStep(mark, "A1", true, mark.endsAt + MINUTE)).toBe("usual");
    });

    it("an activity that isn't the preview goes by the usual rule", () => {
      expect(previewStep(null, "A1", false, NOW)).toBe("usual");
      expect(previewStep(mark, "B2", false, NOW)).toBe("usual");
      expect(previewStep(mark, null, false, NOW)).toBe("usual");
    });
  });

  it("the mark kept on disk is read back only when it's whole", () => {
    expect(parseMark(JSON.stringify({ id: "A1", endsAt: 5 }))).toEqual({ id: "A1", endsAt: 5 });
    for (const text of [null, "", "{", "null", JSON.stringify({ id: 1, endsAt: 5 }), JSON.stringify({ id: "A1" })]) expect(parseMark(text)).toBeNull();
  });

  it("iOS saying no: Live Activities turned off is told apart from anything else", () => {
    // expo-widgets' LiveActivitiesNotSupportedException (ios/WidgetsExceptions.swift), as Expo hands it to JavaScript.
    expect(previewProblem(Object.assign(new Error("Live Activities are not supported on this device"), { code: "ERR_LIVE_ACTIVITIES_NOT_SUPPORTED" }))).toBe(
      "off",
    );
    expect(previewProblem(new Error("Calling the 'start' function has failed\n→ Caused by: Live Activities are not supported on this device"))).toBe("off");
    expect(previewProblem(new Error("Failed to start live activity: The operation couldn’t be completed."))).toBe("failed");
    expect(previewProblem("nope")).toBe("failed");
  });
});
