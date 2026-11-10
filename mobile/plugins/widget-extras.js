// What react-native-android-widget's own config can't say about the home-screen widgets (src/widget/,
// qa/superapp-widgets.md): how small each may be made (minResizeWidth/Height: without them a widget
// only grows from its first size), and its name and line in the widget picker in the phone's language
// (Indonesian in values-in, English otherwise; the library writes one untranslatable string).
//
// Listed before "react-native-android-widget" in app.config.ts's plugins: Expo runs the mods of a later
// plugin first, so these run after the library has written each widget's manifest entry and XML.
const fs = require("node:fs");
const path = require("node:path");
const { withAndroidManifest, withDangerousMod } = require("expo/config-plugins");

/** The resource names of a widget's picker words. */
const labelKey = (name) => `widget_${name.toLowerCase()}_label`;
const descriptionKey = (name) => `widget_${name.toLowerCase()}_description`;

const escaped = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "\\'").replace(/"/g, '\\"');

/** One strings file: every widget's label and description in `lang`. */
function stringsXml(widgets, lang) {
  const items = widgets.flatMap((widget) => [
    `  <string name="${labelKey(widget.name)}">${escaped(widget.label[lang])}</string>`,
    `  <string name="${descriptionKey(widget.name)}">${escaped(widget.description[lang])}</string>`,
  ]);
  return `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n${items.join("\n")}\n</resources>\n`;
}

/** The library's provider XML with the smallest size and the translated description added (once). */
function patchProvider(xml, widget) {
  const extra = [
    widget.minResizeWidth && !/android:minResizeWidth=/.test(xml) ? `android:minResizeWidth="${widget.minResizeWidth}"` : null,
    widget.minResizeHeight && !/android:minResizeHeight=/.test(xml) ? `android:minResizeHeight="${widget.minResizeHeight}"` : null,
    /android:description=/.test(xml) ? null : `android:description="@string/${descriptionKey(widget.name)}"`,
  ].filter(Boolean);
  if (!extra.length) return xml;
  if (!/<appwidget-provider\b/.test(xml)) throw new Error("widget-extras: no <appwidget-provider> in the widget's XML");
  return xml.replace(/<appwidget-provider\b/, (open) => `${open}\n    ${extra.join("\n    ")}`);
}

/** Each widget's receiver named from the strings, so the picker says it in the phone's language. */
function labelReceivers(manifest, widgets) {
  const application = manifest.manifest.application?.[0];
  for (const receiver of application?.receiver ?? []) {
    const name = receiver.$["android:name"] ?? "";
    const widget = widgets.find((one) => name.endsWith(`.${one.name}`));
    if (widget) receiver.$["android:label"] = `@string/${labelKey(widget.name)}`;
  }
  return manifest;
}

/** `widgets`: { name, minResizeWidth?, minResizeHeight?, label: { id, en }, description: { id, en } }[]. */
function withWidgetExtras(config, { widgets }) {
  config = withAndroidManifest(config, (mod) => {
    mod.modResults = labelReceivers(mod.modResults, widgets);
    return mod;
  });
  return withDangerousMod(config, [
    "android",
    (mod) => {
      const res = path.join(mod.modRequest.platformProjectRoot, "app/src/main/res");
      for (const widget of widgets) {
        const file = path.join(res, "xml", `widgetprovider_${widget.name.toLowerCase()}.xml`);
        if (!fs.existsSync(file)) throw new Error(`widget-extras: ${file} wasn't written; list this plugin before react-native-android-widget`);
        fs.writeFileSync(file, patchProvider(fs.readFileSync(file, "utf8"), widget));
      }
      for (const [folder, lang] of [
        ["values", "en"],
        ["values-in", "id"],
      ]) {
        fs.mkdirSync(path.join(res, folder), { recursive: true });
        fs.writeFileSync(path.join(res, folder, "widget_strings.xml"), stringsXml(widgets, lang));
      }
      return mod;
    },
  ]);
}

module.exports = withWidgetExtras;
module.exports.patchProvider = patchProvider;
module.exports.stringsXml = stringsXml;
module.exports.labelReceivers = labelReceivers;
