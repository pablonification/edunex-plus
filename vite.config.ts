import fs from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { openSourceList, PDFJS_DATA } from "./scripts/third-party-notices.mjs";

const outDir = path.resolve(__dirname, "dist/app");

/**
 * The PDF viewer's data files, loaded by pdf.js at run time from the app's own
 * files under /pdfjs/: fonts a PDF names but doesn't embed, the character maps
 * of Asian scripts, and the image decoders' JavaScript versions (the viewer
 * runs without WebAssembly, so the window's content policy needn't allow it).
 * Which files, and their licences: scripts/third-party-notices.mjs.
 */
function pdfjsAssets(): Plugin {
  const source = path.resolve(__dirname, "node_modules/pdfjs-dist");
  const files = PDFJS_DATA;
  const served = (relative: string) => files.some((file) => relative === file || relative.startsWith(`${file}/`));
  return {
    name: "pdfjs-assets",
    configureServer(server) {
      server.middlewares.use("/pdfjs/", (request, response, next) => {
        const relative = decodeURIComponent((request.url ?? "").split("?")[0]).replace(/^\/+/, "");
        const file = path.resolve(source, relative);
        if (!served(relative) || !file.startsWith(source + path.sep) || !fs.existsSync(file)) return next();
        response.setHeader("content-type", file.endsWith(".js") ? "text/javascript" : "application/octet-stream");
        fs.createReadStream(file).pipe(response);
      });
    },
    writeBundle() {
      for (const file of files) fs.cpSync(path.join(source, file), path.join(outDir, "pdfjs", file), { recursive: true });
    },
  };
}

/**
 * The open-source software the app ships, each with its licence
 * (scripts/third-party-notices.mjs), as licences.json next to the window.
 * Settings reads it only when the Student opens the list, so none of it loads
 * with the window.
 */
function licencesFile(): Plugin {
  let json: string | undefined;
  const list = () => (json ??= JSON.stringify(openSourceList()));
  return {
    name: "licences-file",
    configureServer(server) {
      server.middlewares.use("/licences.json", (_request, response) => {
        response.setHeader("content-type", "application/json");
        response.end(list());
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "licences.json", source: list() });
    },
  };
}

// The window (src/app). Built into dist/app and served from app://edunex-plus
// in the app; in development the dev server runs on 127.0.0.1 only.
export default defineConfig({
  root: path.resolve(__dirname, "src/app"),
  base: "./",
  plugins: [react(), tailwindcss(), pdfjsAssets(), licencesFile()],
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  build: { outDir, emptyOutDir: true, target: "chrome140", sourcemap: false },
});
