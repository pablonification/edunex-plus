// The website on this computer, for working on it: `npm run site`, then open the address it prints.
// Every page load builds the site again, so a change to a template, the words or the stylesheet shows
// on refresh.
//
//   node site/serve.mjs [--port 4321] [--release <release.json>] [--cards]
//
// --release and --cards are the build's own (site/build.mjs).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "dist");
const { values } = parseArgs({
  options: { port: { type: "string", default: "4321" }, release: { type: "string" }, cards: { type: "boolean", default: false } },
});

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

// In a process of its own, so the templates and words are read afresh each time.
const build = () => {
  const args = [path.join(here, "build.mjs"), "--out", out, ...(values.release ? ["--release", values.release] : []), ...(values.cards ? ["--cards"] : [])];
  const built = spawnSync(process.execPath, args, { encoding: "utf8" });
  if (built.status !== 0) console.error(built.stderr);
  return built.status === 0;
};

build();
http
  .createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    let file;
    try {
      file = path.join(out, decodeURIComponent(url.pathname));
    } catch {
      // An address that isn't one (a "%" alone).
      response.writeHead(400).end();
      return;
    }
    if (!file.startsWith(out)) {
      response.writeHead(403).end();
      return;
    }
    if (url.pathname.endsWith("/")) {
      file = path.join(file, "index.html");
      build();
    }
    const found = fs.existsSync(file) && fs.statSync(file).isFile();
    const served = found ? file : path.join(out, "404.html");
    response.writeHead(found ? 200 : 404, { "Content-Type": TYPES[path.extname(served)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    fs.createReadStream(served).pipe(response);
  })
  // This computer only: nobody else on the network needs it.
  .listen(Number(values.port), "127.0.0.1", () => console.log(`The website is at http://localhost:${values.port}/ (Indonesian: /id/)`));
