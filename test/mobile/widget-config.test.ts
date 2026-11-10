// The home-screen widgets as Android is told about them (mobile/app.config.ts, mobile/plugins/widget-extras.js): every
// widget the app draws is declared, with its own picture, sizes it can really be made, its picker words in both
// languages, and no update more often than every 30 minutes. The native build can't be run here, so the plugin's own
// steps are checked on the files the library writes.
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";
import config from "../../mobile/app.config";
import { WIDGET_NAMES } from "../../mobile/src/widget/names";

const require = createRequire(import.meta.url);
const mobile = path.resolve(import.meta.dirname, "../../mobile");
const extras = require("../../mobile/plugins/widget-extras.js") as {
  patchProvider(xml: string, widget: object): string;
  stringsXml(widgets: object[], lang: "id" | "en"): string;
  labelReceivers(manifest: object, widgets: object[]): { manifest: { application: { receiver: { $: Record<string, string> }[] }[] } };
};

type Plugin = [string, { widgets: Record<string, unknown>[] }];
const expo = config({ config: {} } as never);
const plugin = (name: string) => (expo.plugins as unknown[]).find((entry): entry is Plugin => Array.isArray(entry) && entry[0] === name)?.[1];
const library = plugin("react-native-android-widget")!.widgets;
const ours = plugin("./plugins/widget-extras")!.widgets;
const dp = (value: unknown) => Number(String(value).replace("dp", ""));

describe("the widgets Android is told about", () => {
  it("every widget the app draws, under its own name, the two already on home screens unchanged", () => {
    expect(library.map((widget) => widget.name)).toEqual([...WIDGET_NAMES]);
    expect(WIDGET_NAMES.slice(0, 2)).toEqual(["Now", "Today"]);
    expect(ours.map((widget) => widget.name)).toEqual([...WIDGET_NAMES]);
  });

  it("each its own picture in the picker, made by the script and on disk", () => {
    const pictures = library.map((widget) => widget.previewImage as string);
    expect(new Set(pictures).size).toBe(pictures.length);
    for (const picture of pictures) expect(fs.existsSync(path.join(mobile, picture)), picture).toBe(true);
  });

  it("sizes it can really be made: smallest ≤ first ≤ largest, and never updated more often than every 30 minutes", () => {
    for (const [index, widget] of library.entries()) {
      const extra = ours[index]!;
      expect(dp(extra.minResizeWidth), String(widget.name)).toBeLessThanOrEqual(dp(widget.minWidth));
      expect(dp(extra.minResizeHeight), String(widget.name)).toBeLessThanOrEqual(dp(widget.minHeight));
      expect(dp(widget.maxResizeWidth)).toBeGreaterThanOrEqual(dp(widget.minWidth));
      expect(dp(widget.maxResizeHeight)).toBeGreaterThanOrEqual(dp(widget.minHeight));
      const period = widget.updatePeriodMillis as number;
      expect(period === 0 || period >= 30 * 60 * 1000, String(widget.name)).toBe(true);
    }
    // The single cell is one cell.
    expect(library.find((widget) => widget.name === "Next")).toMatchObject({ targetCellWidth: 1, targetCellHeight: 1 });
    // Only "Satu mata kuliah" asks a question, and never as it's placed on Android 12+.
    expect(library.filter((widget) => widget.widgetFeatures).map((widget) => [widget.name, widget.widgetFeatures])).toEqual([
      ["Course", "reconfigurable|configuration_optional"],
    ]);
  });

  it("the picker's words in Indonesian and English, each widget its own", () => {
    const labels = ours.map((widget) => (widget.label as { id: string }).id);
    expect(new Set(labels).size).toBe(labels.length);
    for (const widget of ours) {
      for (const lang of ["id", "en"] as const) {
        expect((widget.label as Record<string, string>)[lang], String(widget.name)).toBeTruthy();
        expect((widget.description as Record<string, string>)[lang], String(widget.name)).toBeTruthy();
      }
    }
    // The library's own untranslatable description is left out: ours replaces it.
    for (const widget of library) expect(widget.description).toBeUndefined();
  });

  it("the plugin's steps after the library's (Expo runs a later plugin's steps first)", () => {
    const names = (expo.plugins as unknown[]).map((entry) => (Array.isArray(entry) ? entry[0] : entry));
    expect(names.indexOf("./plugins/widget-extras")).toBeLessThan(names.indexOf("react-native-android-widget"));
  });
});

describe("plugins/widget-extras.js", () => {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="250dp"
    android:minHeight="110dp"
    android:resizeMode="horizontal|vertical"
    android:initialLayout="@layout/rn_widget"
    android:updatePeriodMillis="1800000"
    android:widgetCategory="home_screen">
</appwidget-provider>
`;
  const now = {
    name: "Now",
    minResizeWidth: "110dp",
    minResizeHeight: "40dp",
    label: { id: "Sekarang", en: "Now" },
    description: { id: "Kuliah sekarang", en: "Your class now" },
  };

  it("adds the smallest size and the translated description to the library's XML, once", () => {
    const patched = extras.patchProvider(xml, now);
    expect(patched).toContain('android:minResizeWidth="110dp"');
    expect(patched).toContain('android:minResizeHeight="40dp"');
    expect(patched).toContain('android:description="@string/widget_now_description"');
    expect(extras.patchProvider(patched, now)).toBe(patched);
  });

  it("writes each language's words, escaped for Android", () => {
    const id = extras.stringsXml([{ ...now, description: { id: "Kuliah & tugas 'hari ini'", en: "x" } }], "id");
    expect(id).toContain('<string name="widget_now_label">Sekarang</string>');
    expect(id).toContain("<string name=\"widget_now_description\">Kuliah &amp; tugas \\'hari ini\\'</string>");
    expect(extras.stringsXml([now], "en")).toContain('<string name="widget_now_label">Now</string>');
  });

  it("names each widget's receiver from those words", () => {
    const manifest = {
      manifest: {
        application: [
          {
            receiver: [
              { $: { "android:name": ".widget.Now", "android:label": "Sekarang" } },
              { $: { "android:name": ".SomethingElse", "android:label": "x" } },
            ],
          },
        ],
      },
    };
    const receivers = extras.labelReceivers(manifest, [now]).manifest.application[0]!.receiver;
    expect(receivers[0]!.$["android:label"]).toBe("@string/widget_now_label");
    expect(receivers[1]!.$["android:label"]).toBe("x");
  });
});
