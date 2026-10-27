// The Electron side of updating from inside the app (the plan and its rules are
// ./self-update.ts): requests on a session of their own that follow a redirect
// only to GitHub's download hosts, the download written to a fresh folder in
// the system's temporary folder, and starting the new version once this copy
// has quit.
import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { app, type IncomingMessage, net, type Session, shell } from "electron";
import type { UpdateInstall, UpdateNotice } from "../core/models";
import { errorLine } from "../engine/app-log";
import { downloadPartial, isRangeAnswer } from "./partial-update";
import {
  type Arch,
  createUpdater,
  isDownloadUrl,
  isPlainFileName,
  MAC_SWAP_SCRIPT,
  type MacArchive,
  MismatchError,
  macBundleOf,
  macPlaceProblem,
  type ReleaseFile,
  START_AFTER_QUIT_SCRIPT,
  type UpdateKind,
  type Updater,
  type UpdaterDeps,
} from "./self-update";

const run = promisify(execFile);
/** Give up on a download that sends nothing for this long. */
const STALLED_AFTER = 60_000;
const MAX_TEXT = 2 * 1024 * 1024;
/** How long a signed link GitHub sent a download on to is used again (GitHub's last longer). */
const SIGNED_FOR = 5 * 60_000;

/** GitHub answered, but not as asked (a signed link that ran out answers 403). */
class StatusError extends Error {}

/** GitHub's API, the only place the release's file list comes from. */
const isApiUrl = (url: string) => url.startsWith("https://api.github.com/");

/** Where an update is downloaded and unpacked, in the system's temporary folder; emptied for each download. */
const updateFolder = () => path.join(app.getPath("temp"), "edunex-plus-update");

export interface ElectronUpdaterOptions {
  /** False for development and demo builds: they only ever open the release page. */
  packaged: boolean;
  userAgent: string;
  session: Session;
  notice(): UpdateNotice | null;
  send(state: UpdateInstall): void;
  log?: UpdaterDeps["log"];
}

export function electronUpdater(options: ElectronUpdaterOptions): Updater {
  const folder = updateFolder();

  /**
   * GET with redirects followed only while `allowed` says so; the body goes to `sink`. `status` is the
   * answer expected (206 for a range), and `redirected` hears each place it's sent on to.
   */
  function get(
    url: string,
    allowed: (url: string) => boolean,
    sink: (response: IncomingMessage) => Promise<void>,
    { headers = {}, status = 200, redirected }: { headers?: Record<string, string>; status?: number; redirected?: (url: string) => void } = {},
  ): Promise<void> {
    if (!allowed(url)) return Promise.reject(new Error(`Not a GitHub address: ${url}`));
    return new Promise((resolve, reject) => {
      let timer: NodeJS.Timeout | null = null;
      const client = net.request({ url, session: options.session, redirect: "manual", credentials: "omit", bypassCustomProtocolHandlers: true });
      const fail = (error: Error) => {
        if (timer) clearTimeout(timer);
        client.abort();
        reject(error);
      };
      const stall = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => fail(new Error("net::ERR_TIMED_OUT")), STALLED_AFTER);
      };
      client.setHeader("user-agent", options.userAgent);
      for (const [name, value] of Object.entries(headers)) client.setHeader(name, value);
      client.on("redirect", (_status, _method, location) => {
        // Followed now or never (ClientRequest drops it otherwise); anywhere else ends the download.
        if (!allowed(location)) return fail(new Error(`Sent away from GitHub: ${location}`));
        redirected?.(location);
        client.followRedirect();
      });
      client.on("response", (response) => {
        if (response.statusCode !== status) return fail(new StatusError(`GitHub answered ${response.statusCode}`));
        response.on("data", stall);
        sink(response).then(
          () => {
            if (timer) clearTimeout(timer);
            resolve();
          },
          (error: Error) => fail(error),
        );
      });
      client.on("error", (error) => fail(error));
      stall();
      client.end();
    });
  }

  async function text(url: string, allowed: (url: string) => boolean, headers?: Record<string, string>): Promise<string> {
    return (await bytes(url, allowed, MAX_TEXT, headers)).toString("utf8");
  }

  async function bytes(url: string, allowed: (url: string) => boolean, max: number, headers?: Record<string, string>): Promise<Buffer> {
    let body = Buffer.alloc(0);
    await get(
      url,
      allowed,
      (response) =>
        new Promise((resolve, reject) => {
          const chunks: Buffer[] = [];
          let size = 0;
          response.on("data", (chunk: Buffer) => {
            size += chunk.length;
            // A release's file list, its latest*.yml and its chunk maps are small; anything bigger isn't them.
            if (size > max) return reject(new MismatchError(`${url} is too big`));
            chunks.push(chunk);
          });
          response.on("end", () => {
            body = Buffer.concat(chunks);
            resolve();
          });
          response.on("error", reject);
        }),
      { headers },
    );
    return body;
  }

  /** Where GitHub last sent each release file on to, and when: a signed link, good for a while, so each range skips a step. */
  const signed = new Map<string, { url: string; at: number }>();

  /** Bytes `start` to `end` (not included) of a release file, as ./partial-update.ts asks for them. */
  async function range(file: ReleaseFile, start: number, end: number, onData: (data: Buffer) => void): Promise<void> {
    const reused = signed.get(file.url);
    const from = reused && Date.now() - reused.at < SIGNED_FOR ? reused.url : file.url;
    const ask = (url: string) =>
      get(
        url,
        isDownloadUrl,
        (response) =>
          new Promise((resolve, reject) => {
            if (!isRangeAnswer(String(response.headers["content-range"] ?? ""), start, end, file.size)) {
              return reject(new MismatchError(`GitHub sent another part of ${file.name}`));
            }
            let size = 0;
            let stopped = false;
            const stop = (error: unknown) => {
              stopped = true;
              reject(error);
            };
            response.on("data", (chunk: Buffer) => {
              if (stopped) return;
              size += chunk.length;
              if (size > end - start) return stop(new MismatchError(`GitHub sent more of ${file.name} than asked`));
              try {
                onData(chunk);
              } catch (error) {
                stop(error);
              }
            });
            response.on("end", () => (size === end - start ? resolve() : stop(new Error(`GitHub sent less of ${file.name} than asked`))));
            response.on("error", stop);
          }),
        {
          headers: { range: `bytes=${start}-${end - 1}` },
          status: 206,
          redirected: (location) => signed.set(file.url, { url: location, at: Date.now() }),
        },
      );
    try {
      await ask(from);
    } catch (error) {
      // The signed link has run out (or was refused) before anything came: GitHub is asked for a new one.
      if (from === file.url || !(error instanceof StatusError)) throw error;
      signed.delete(file.url);
      await ask(file.url);
    }
  }

  const deps: UpdaterDeps = {
    way: async () => {
      if (!options.packaged) return { blocked: "notPackaged" };
      // An Intel build running on Apple silicon (through Rosetta) moves on to the Apple-silicon one.
      const arch: Arch = process.arch === "arm64" || app.runningUnderARM64Translation ? "arm64" : "x64";
      if (process.platform === "darwin") {
        const bundle = macBundleOf(app.getPath("exe"));
        if (!bundle) return { blocked: "readOnly" };
        const problem = macPlaceProblem(bundle, await writable(path.dirname(bundle), bundle));
        return problem ? { blocked: problem } : { kind: "mac", arch };
      }
      if (process.platform === "win32") {
        // Installed for this Windows user only, in a folder of theirs; a copy installed for everyone isn't.
        return (await writable(path.dirname(app.getPath("exe")))) ? { kind: "windows", arch } : { blocked: "readOnly" };
      }
      const appImage = process.env.APPIMAGE;
      if (!appImage) return { blocked: "deb" };
      return (await writable(path.dirname(appImage), appImage)) ? { kind: "appImage", arch } : { blocked: "readOnly" };
    },
    notice: options.notice,
    api: async (url) => JSON.parse(await text(url, isApiUrl, { accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" })),
    text: (url) => text(url, isDownloadUrl),
    patch: async (update, progress) => {
      const have = await haveAlready(update.kind);
      if (!have) return null;
      await fsp.rm(folder, { recursive: true, force: true });
      const into = update.kind === "mac" ? path.join(folder, "app") : folder;
      await fsp.mkdir(into, { recursive: true });
      try {
        const made = await downloadPartial({ ...update, have, into, progress }, { bytes: (file) => bytes(file.url, isDownloadUrl, file.size), range });
        return made && update.kind === "mac" ? await checkApp(made, update.version) : made;
      } catch (error) {
        console.warn("[update] downloading only what changed didn't work, so the whole file comes instead:", error);
        options.log?.("warn", `only what changed didn't download, so the whole file comes: ${errorLine(error)}`);
        throw error;
      }
    },
    download: async (file: ReleaseFile, progress) => {
      await fsp.rm(folder, { recursive: true, force: true });
      await fsp.mkdir(folder, { recursive: true });
      // pickReleaseFile only takes plain names; checked again here, where the name becomes a place on disk.
      if (!isPlainFileName(file.name)) throw new MismatchError(`${file.name} isn't a plain file name`);
      const target = path.join(folder, file.name);
      const hash = createHash("sha512");
      let size = 0;
      await get(
        file.url,
        isDownloadUrl,
        (response) =>
          new Promise((resolve, reject) => {
            const out = fs.createWriteStream(target);
            const total = Number(response.headers["content-length"]) || file.size;
            response.on("data", (chunk: Buffer) => {
              hash.update(chunk);
              size += chunk.length;
              // Never more than the release says: a longer file is not the one it lists.
              if (size > file.size) {
                out.destroy();
                return reject(new MismatchError(`${file.name} is longer than the release says`));
              }
              out.write(chunk);
              if (total) progress(size / total);
            });
            response.on("end", () => out.end(() => resolve()));
            response.on("error", (error: Error) => {
              out.destroy();
              reject(error);
            });
            out.on("error", reject);
          }),
      );
      return { path: target, sha512: hash.digest("base64"), size };
    },
    unpack: unpackMacUpdate,
    install: async (kind: UpdateKind, staged, reopen) => {
      if (kind === "mac") {
        const bundle = macBundleOf(app.getPath("exe"));
        if (!bundle) throw new Error("Not in an app bundle");
        const script = path.join(folder, "swap.sh");
        await fsp.writeFile(script, MAC_SWAP_SCRIPT, { mode: 0o700 });
        startDetached("/bin/sh", [script, String(process.pid), staged, bundle, reopen ? "1" : "0"]);
      } else if (kind === "windows") {
        // As electron-updater runs it: an update (keeps the shortcuts), silent, then opens the app (only with --force-run).
        startDetached(staged, reopen ? ["--updated", "/S", "--force-run"] : ["--updated", "/S"]);
      } else {
        const appImage = process.env.APPIMAGE;
        if (!appImage) throw new Error("Not an AppImage");
        // Linux lets a running file be replaced: the new one is put in its place now and opened once this copy quits.
        const next = `${appImage}.update`;
        await fsp.copyFile(staged, next);
        await fsp.chmod(next, 0o755);
        await fsp.rename(next, appImage);
        if (reopen) {
          const script = path.join(folder, "start.sh");
          await fsp.writeFile(script, START_AFTER_QUIT_SCRIPT, { mode: 0o700 });
          startDetached("/bin/sh", [script, String(process.pid), appImage]);
        }
      }
      // Quitting already, it's put in place once this copy has.
      if (reopen) app.quit();
    },
    openPage: (url) => shell.openExternal(url),
    send: options.send,
    log: options.log,
  };
  return createUpdater(deps);
}

/**
 * Unpacks a downloaded Mac update into a fresh folder in the update folder, and checks it holds one
 * app, a folder, that is this app at `version`; the new app's path. The zip with ditto; the .tar.xz
 * with macOS's own tar (bsdtar), which reads xz on every macOS the app runs on. Without -P, tar
 * refuses an entry with ".." in its path or one that goes through a link, and takes the "/" off an
 * absolute path, so nothing it unpacks lands outside that folder.
 */
export async function unpackMacUpdate(archive: string, kind: MacArchive, version: string): Promise<string> {
  const into = path.join(updateFolder(), "app");
  await fsp.rm(into, { recursive: true, force: true });
  await fsp.mkdir(into, { recursive: true });
  if (kind === "tarXz") await run("/usr/bin/tar", ["-x", "-f", archive, "-C", into]);
  else await run("/usr/bin/ditto", ["-x", "-k", archive, into]);
  await fsp.rm(archive, { force: true });
  return checkApp(into, version);
}

/** Mac: the one app in `into` (unpacked, or put together from chunks), a folder, checked to be this app at `version`; its path. */
async function checkApp(into: string, version: string): Promise<string> {
  const apps = (await fsp.readdir(into)).filter((name) => name.endsWith(".app"));
  const unpacked = apps.length === 1 ? path.join(into, apps[0]) : null;
  // A link named like an app would put whatever it points at in the app's place.
  if (!unpacked || !(await fsp.lstat(unpacked)).isDirectory()) throw new MismatchError("The update doesn't hold one app");
  const plist = path.join(unpacked, "Contents", "Info.plist");
  const read = async (key: string) => (await run("/usr/bin/plutil", ["-extract", key, "raw", "-o", "-", plist])).stdout.trim();
  if ((await read("CFBundleIdentifier")) !== "id.edunexplus.desktop" || (await read("CFBundleShortVersionString")) !== version) {
    throw new MismatchError("The update holds another app or another version");
  }
  // Downloaded by the app itself, so not marked; cleared anyway, so macOS opens it without asking.
  await run("/usr/bin/xattr", ["-dr", "com.apple.quarantine", unpacked]).catch(() => undefined);
  return unpacked;
}

/**
 * What this computer already has of the new version, for ./partial-update.ts to take chunks from:
 * the Mac app itself; on Windows the installer that put this version in place, which
 * electron-builder's installer copies to %LOCALAPPDATA%\<package name>-updater\installer.exe each
 * time it runs (its updaterCacheDirName); the AppImage running now. Null when it isn't there.
 */
async function haveAlready(kind: UpdateKind): Promise<string | null> {
  const found =
    kind === "mac"
      ? macBundleOf(app.getPath("exe"))
      : kind === "windows"
        ? process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "edunex-plus-updater", "installer.exe")
        : process.env.APPIMAGE;
  return found && (await fsp.stat(found).catch(() => null)) ? found : null;
}

/** Whether this user may replace what's at these paths. */
async function writable(...paths: string[]): Promise<boolean> {
  try {
    for (const target of paths) await fsp.access(target, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function startDetached(command: string, args: string[]): void {
  spawn(command, args, { detached: true, stdio: "ignore" }).unref();
}
