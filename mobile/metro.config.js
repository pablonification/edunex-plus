// Metro bundles the phone app with the desktop's own code: src/core, src/engine and the
// DOM-free data hooks of src/app (and, in a demo build, test/pretend). A package those files
// import resolves as if mobile/ imported it, from mobile/node_modules, so there's one copy of
// each library (one React) whether or not the repository root has its own installed.
// A few desktop modules that touch Electron or the DOM have a phone version (SWAPS); the
// desktop's files stay as they are.
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const root = path.resolve(__dirname, "..");
const config = getDefaultConfig(__dirname);

config.watchFolders = [path.join(root, "src"), path.join(root, "test")];

// Each module runs when it's first used, not all at once as the bundle starts (Metro's inline requires, which Expo's
// defaults leave off): what Beranda's first frame doesn't touch (the HTML parsers behind every reader, the pages and
// sheets not open yet, the reports, the demo) no longer runs between Android's START and the first frame. A module
// whose import is only there for what it does when it loads has to be imported bare (`import "./x"`), which is never
// deferred: ../index.ts does that for the start (src/start.ts), the crypto and the background sync. The UI libraries
// below load with the first frame anyway, and some set themselves up as they load: they stay where they're imported.
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: true,
    inlineRequires: true,
    nonInlinedRequires: [
      "React",
      "react",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "react-compiler-runtime",
      "react-native",
      "react-native-gesture-handler",
      "react-native-reanimated",
      "react-native-worklets",
      "react-native-screens",
      "react-native-safe-area-context",
      "expo-router",
    ],
  },
});
const mobileFolder = __dirname + path.sep;
const fromMobile = path.join(__dirname, "package.json");
const isPackage = (name) => !name.startsWith(".") && !path.isAbsolute(name);

/** A desktop file (by its path from the repository root, without extension) → its phone version. */
const SWAPS = {
  "src/app/ui/overlays": "mobile/src/swaps/overlays.ts",
  "test/kit/fixtures": "mobile/src/demo/fixtures.ts",
};
const swapOf = (file) => {
  const relative = path
    .relative(root, file)
    .replace(/\\/g, "/")
    .replace(/\.(tsx?|jsx?|mjs|cjs)$/, "");
  const swap = SWAPS[relative];
  return swap ? path.join(root, swap) : null;
};

const demo = process.env.EXPO_PUBLIC_DEMO === "1";
const demoFolder = path.join(__dirname, "src", "demo") + path.sep;
// QA session restore (src/qa) is only in a debug QA build: EXPO_PUBLIC_R3_GUARD=1, and not a release bundle.
const qa = process.env.EXPO_PUBLIC_R3_GUARD === "1";
const qaFolder = path.join(__dirname, "src", "qa") + path.sep;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // cheerio's browser build is its parse5 loader without fromURL (which needs Node's undici):
  // pages parse exactly as on the desktop.
  if (moduleName === "cheerio") {
    return context.resolveRequest(
      { ...context, originModulePath: fromMobile, unstable_conditionNames: ["browser", "import", "require"] },
      moduleName,
      platform,
    );
  }
  const outside = !context.originModulePath.startsWith(mobileFolder);
  const asked = outside && isPackage(moduleName) ? { ...context, originModulePath: fromMobile } : context;
  const resolved = asked.resolveRequest(asked, moduleName, platform);
  if (resolved.type === "sourceFile") {
    // The real app carries no demo: no pretend Edunex, no recordings.
    if (!demo && resolved.filePath.startsWith(demoFolder)) return { type: "empty" };
    if ((!qa || context.dev === false) && resolved.filePath.startsWith(qaFolder)) return { type: "empty" };
    const swap = swapOf(resolved.filePath);
    if (swap) return { type: "sourceFile", filePath: swap };
  }
  return resolved;
};

module.exports = config;
