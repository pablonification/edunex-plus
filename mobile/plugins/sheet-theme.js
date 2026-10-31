// The native bottom sheets (react-native-screens' FormSheet, a Material BottomSheetDialog) edge to edge,
// as the rest of the app. react-native-screens themes the sheet's dialog with Material 3's own
// (Theme.Material3.DayNight.NoActionBar, whose bottomSheetDialogTheme is
// ThemeOverlay.Material3.BottomSheetDialog), and that overlay sets no navigation bar colour: on Android 14
// and older the dialog's window paints the bar black over the sheet's end, hiding its last row (Android 15
// and later draw every window edge to edge). The app's resources win over a library's of the same name, so
// this redefines that overlay with a transparent bar and Material's own edge-to-edge handling.
const { withAndroidStyles } = require("expo/config-plugins");

const OVERLAY = "ThemeOverlay.Material3.BottomSheetDialog";

module.exports = function withSheetTheme(config) {
  return withAndroidStyles(config, (mod) => {
    const styles = mod.modResults.resources.style ?? [];
    const items = [
      ["android:navigationBarColor", "@android:color/transparent"],
      ["android:statusBarColor", "@android:color/transparent"],
      ["android:enforceNavigationBarContrast", "false"],
      ["android:windowLightNavigationBar", "?attr/isLightTheme"],
      ["enableEdgeToEdge", "true"],
    ];
    const overlay = {
      $: { name: OVERLAY, parent: "Base.ThemeOverlay.Material3.BottomSheetDialog" },
      item: items.map(([name, value]) => ({ $: { name }, _: value })),
    };
    mod.modResults.resources.style = [...styles.filter((style) => style.$.name !== OVERLAY && style.$.name !== "AppBottomSheetDialog"), overlay];
    return mod;
  });
};
