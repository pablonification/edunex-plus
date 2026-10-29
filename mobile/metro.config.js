// Metro bundles the phone app with the desktop's own code: src/core, src/engine and the
// DOM-free data hooks of src/app (and, in a demo build, test/pretend). Every import, theirs
// too, resolves from mobile/node_modules only, so there's one copy of each library.
// A few desktop modules that touch Electron or the DOM have a phone version (SWAPS); the
// desktop's files stay as they are.
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const root = path.resolve(__dirname, "..");
const config = getDefaultConfig(__dirname);

config.watchFolders = [path.join(root, "src"), path.join(root, "test")];
config.resolver.nodeModulesPaths = [path.join(__dirname, "node_modules")];
config.resolver.disableHierarchicalLookup = true;

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

/** A library's own copy of a package npm couldn't lift to the top (expo-router's @expo/metro-runtime)
 * sits beside the library: a library not found from the top is looked for there, as Node would. */
const nodeModules = path.join(__dirname, "node_modules") + path.sep;
const resolveOrNested = (context, moduleName, platform) => {
  try {
    return context.resolveRequest(context, moduleName, platform);
  } catch (error) {
    if (!context.originModulePath.startsWith(nodeModules)) throw error;
    return context.resolveRequest({ ...context, disableHierarchicalLookup: false }, moduleName, platform);
  }
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // cheerio's browser build is its parse5 loader without fromURL (which needs Node's undici):
  // pages parse exactly as on the desktop.
  if (moduleName === "cheerio") {
    return context.resolveRequest({ ...context, unstable_conditionNames: ["browser", "import", "require"] }, moduleName, platform);
  }
  const resolved = resolveOrNested(context, moduleName, platform);
  if (resolved.type === "sourceFile") {
    const swap = swapOf(resolved.filePath);
    if (swap) return { type: "sourceFile", filePath: swap };
  }
  return resolved;
};

module.exports = config;
