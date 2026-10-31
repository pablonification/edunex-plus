// The native bottom sheets (react-native-screens' FormSheet, a Material BottomSheetDialog) edge to edge,
// as the rest of the app: without a theme of their own they take Material's default, whose window paints
// the navigation bar black over the sheet's end (on Android 14 and older; 15 and later draw every window
// edge to edge). AppTheme names a BottomSheetDialog theme with a transparent navigation bar, and Material's
// `enableEdgeToEdge`, so the sheet's colour runs under the bar and its content keeps clear of it.
const { withAndroidStyles } = require("expo/config-plugins");

const SHEET = "AppBottomSheetDialog";

module.exports = function withSheetTheme(config) {
  return withAndroidStyles(config, (mod) => {
    const styles = mod.modResults.resources.style ?? [];
    const app = styles.find((style) => style.$.name === "AppTheme");
    if (!app) throw new Error("sheet-theme: no AppTheme in styles.xml");
    app.item = (app.item ?? []).filter((item) => item.$.name !== "bottomSheetDialogTheme");
    app.item.push({ $: { name: "bottomSheetDialogTheme" }, _: `@style/${SHEET}` });
    const items = [
      ["android:navigationBarColor", "@android:color/transparent"],
      ["android:statusBarColor", "@android:color/transparent"],
      ["android:enforceNavigationBarContrast", "false"],
      ["enableEdgeToEdge", "true"],
      ["android:windowIsFloating", "false"],
    ];
    const sheet = { $: { name: SHEET, parent: "Theme.Design.Light.BottomSheetDialog" }, item: items.map(([name, value]) => ({ $: { name }, _: value })) };
    mod.modResults.resources.style = [...styles.filter((style) => style.$.name !== SHEET), sheet];
    return mod;
  });
};
