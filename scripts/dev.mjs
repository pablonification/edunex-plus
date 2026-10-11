// Development: Vite serves the window with live reload, esbuild rebuilds the
// main process on save, and Electron restarts when main-process code changes.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { context } from "esbuild";
import { createServer } from "vite";
import { desktopBundle } from "./desktop-bundle.mjs";

const electron = createRequire(import.meta.url)("electron");
const server = await createServer();
await server.listen();
const url = server.resolvedUrls?.local[0] ?? "http://127.0.0.1:5173/";

let child = null;
let restarting = false;
const launch = () => {
  const env = { ...process.env, ELECTRON_START_URL: url };
  delete env.ELECTRON_RUN_AS_NODE;
  child = spawn(electron, ["."], { stdio: "inherit", env });
  child.on("exit", (code) => {
    if (restarting) return;
    void server.close();
    process.exit(code ?? 0);
  });
};

const restart = {
  name: "restart-electron",
  setup(build) {
    build.onEnd((result) => {
      if (result.errors.length) return;
      if (!child) return launch();
      restarting = true;
      child.once("exit", () => {
        restarting = false;
        launch();
      });
      child.kill();
    });
  },
};

const desktop = await context({ ...desktopBundle, plugins: [restart] });
await desktop.watch();
