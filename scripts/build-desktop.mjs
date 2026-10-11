// Builds the main process and preload into dist/desktop.
import { build } from "esbuild";
import { desktopBundle } from "./desktop-bundle.mjs";

await build({ ...desktopBundle, minifySyntax: true, minifyWhitespace: true });
