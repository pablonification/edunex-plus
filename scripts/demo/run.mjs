// Opens the demo app by hand: the real app on the pretend Edunex and SIX with
// made-up data (see ./setup.ts for the scenarios).
//
//   npm run demo                        signed in to both, on the recorded Thursday morning
//   npm run demo -- first-run           the welcome screen, nobody signed in
//   npm run demo -- edunex-only         Edunex connected, SIX not
//   npm run demo -- signed-in --dev     the window from Vite: edits to the screens show live
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const args = process.argv.slice(2);
const scenario = args.find((arg) => !arg.startsWith("--")) ?? "signed-in";
const env = { ...process.env, EDUNEX_DEMO: scenario };
delete env.ELECTRON_RUN_AS_NODE;

let server = null;
if (args.includes("--dev")) {
  const { createServer } = await import("vite");
  server = await createServer();
  await server.listen();
  env.ELECTRON_START_URL = server.resolvedUrls?.local[0] ?? "http://127.0.0.1:5173/";
}
const electron = createRequire(import.meta.url)("electron");
const child = spawn(electron, [path.resolve("dist/desktop/demo-main.cjs")], { stdio: "inherit", env });
child.on("exit", (code) => {
  void server?.close();
  process.exit(code ?? 0);
});
