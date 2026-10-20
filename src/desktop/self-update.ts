// Updating from inside the app: once the Student presses "Unduh & pasang", main
// asks GitHub for the release the update check found, picks this computer's
// file from GitHub's answer (never an address from the window), downloads it
// only from GitHub, checks it against the sha512 the release's latest*.yml
// lists, and waits. Nothing is installed until the Student presses "Mulai ulang
// untuk memperbarui". This file is the plan and its rules; the Electron side
// (downloading, unpacking, starting the new version) is ./updater.ts.
//
// - macOS: the zip for this Mac (arm64 or x64), unpacked beside the running app
//   and swapped in by a small script once the app has quit. Not Squirrel.Mac:
//   it refuses apps signed ad-hoc, as these are.
// - Windows: the one-click installer for this PC (x64 or ARM), run silently as an update.
// - Linux AppImage: the new AppImage, put where the running one is.
// - A .deb, a development or demo build, or an app it can't replace where it
//   is: the release page opens instead, and the window says why.
import path from "node:path";
import { z } from "zod";
import type { UpdateBlock, UpdateInstall, UpdateNotice, UpdateProblem } from "../core/models";
import { RELEASES_REPO } from "../core/updates";
import { EngineError } from "../engine/errors";

/** How this copy puts a new version in place. */
export type UpdateKind = "mac" | "windows" | "appImage";
export type Arch = "arm64" | "x64";

/** The only hosts a release's files come from: GitHub, and where it sends downloads on to. */
const DOWNLOAD_HOSTS = ["github.com", "objects.githubusercontent.com", "release-assets.githubusercontent.com"];

const parseUrl = (url: string) => {
  try {
    return new URL(url);
  } catch {
    return null;
  }
};

/** A file name and nothing more: letters, digits, ".", "-" and "_", not starting with a dot. */
export const isPlainFileName = (name: string) => /^[\w-][\w.-]{0,199}$/.test(name);

/** A download, or a step a download is sent on to: https on GitHub's own hosts, no name, password or odd port in it. */
export function isDownloadUrl(url: string): boolean {
  const parsed = parseUrl(url);
  return parsed?.protocol === "https:" && !parsed.username && !parsed.password && parsed.port === "" && DOWNLOAD_HOSTS.includes(parsed.hostname);
}

/** One of this app's own release files, as GitHub's API names it. */
export function isReleaseFileUrl(url: string): boolean {
  const parsed = parseUrl(url);
  return isDownloadUrl(url) && parsed?.hostname === "github.com" && parsed.pathname.startsWith(`/${RELEASES_REPO}/releases/download/`);
}

/** GitHub's API answer for one release, as far as updating needs it. */
export const ReleaseAnswer = z.object({
  tag_name: z.string(),
  draft: z.boolean().optional(),
  assets: z.array(z.object({ name: z.string(), browser_download_url: z.string(), size: z.number().int().nonnegative() })),
});

export interface ReleaseFile {
  name: string;
  url: string;
  size: number;
}

/** The release's API address for the tag the update check found (its page ends with the tag). */
export function releaseApiUrl(notice: UpdateNotice): string {
  const tag = decodeURIComponent(notice.url.slice(notice.url.lastIndexOf("/") + 1));
  return `https://api.github.com/repos/${RELEASES_REPO}/releases/tags/${encodeURIComponent(tag)}`;
}

/**
 * This computer's file in a release, and the latest*.yml that lists its sha512 (null when
 * the release has none). Names are electron-builder's (electron-builder.config.mjs):
 * Edunex-Plus-1.2.3-arm64-mac.zip, Edunex-Plus-Setup-1.2.3.exe (Intel and AMD PCs; up to
 * 0.1.0-alpha.5 both kinds in one) or Edunex-Plus-1.2.3-arm64.exe (ARM PCs, with its own
 * latest-win-arm64.yml), Edunex-Plus-1.2.3-x86_64.AppImage. Only files at this app's own release addresses count, and only
 * plain file names: the download is saved under its name, so one naming a folder ("..", "a/b") never is.
 */
export function pickReleaseFile(files: ReleaseFile[], kind: UpdateKind, arch: Arch): { file: ReleaseFile; info: ReleaseFile | null } | null {
  const ours = files.filter((file) => isReleaseFileUrl(file.url) && isPlainFileName(file.name));
  const named = (test: (name: string) => boolean) => ours.find((file) => test(file.name)) ?? null;
  const pick = {
    mac: { file: (name: string) => name.endsWith(`-${arch}-mac.zip`), info: "latest-mac.yml" },
    windows:
      arch === "arm64"
        ? { file: (name: string) => name.endsWith("-arm64.exe"), info: "latest-win-arm64.yml" }
        : { file: (name: string) => /Setup.*\.exe$/i.test(name), info: "latest.yml" },
    appImage: {
      file: (name: string) => name.endsWith(`-${arch === "x64" ? "x86_64" : "arm64"}.AppImage`),
      info: arch === "x64" ? "latest-linux.yml" : "latest-linux-arm64.yml",
    },
  }[kind];
  const file = named(pick.file);
  return file && { file, info: named((name) => name === pick.info) };
}

const unquote = (value: string) => value.trim().replace(/^(['"])(.*)\1$/, "$2");
const SHA512 = /^[A-Za-z0-9+/]{86}==$/;

/**
 * The sha512 (base64) electron-builder's latest*.yml gives for a file, or null if it doesn't
 * list it. The yml is a short, fixed shape: `files:` then `- url: …` items with `sha512:`.
 */
export function sha512From(yml: string, fileName: string): string | null {
  let current: string | null = null;
  for (const line of yml.split(/\r?\n/)) {
    const item = /^\s*-\s+url:\s*(.+)$/.exec(line);
    if (item) {
      current = unquote(item[1]);
      continue;
    }
    // Anything at the left edge ends the list of files.
    if (/^\S/.test(line)) current = null;
    const sha = /^\s+sha512:\s*(.+)$/.exec(line);
    if (sha && current === fileName) {
      const value = unquote(sha[1]);
      return SHA512.test(value) ? value : null;
    }
  }
  return null;
}

/** The .app bundle the running program is in (…/Edunex Plus.app/Contents/MacOS/Edunex Plus), or null. */
export function macBundleOf(exe: string): string | null {
  const bundle = path.posix.dirname(path.posix.dirname(path.posix.dirname(exe)));
  return bundle.endsWith(".app") && path.posix.basename(path.posix.dirname(exe)) === "MacOS" ? bundle : null;
}

/**
 * Why a Mac app can't be replaced where it is: macOS runs it from a temporary copy until it's
 * moved (App Translocation), it's open from the disk image, or the folder is someone else's.
 */
export function macPlaceProblem(bundle: string, writable: boolean): UpdateBlock | null {
  if (bundle.includes("/AppTranslocation/")) return "translocated";
  if (writable) return null;
  return bundle.startsWith("/Volumes/") ? "diskImage" : "readOnly";
}

/**
 * Swaps the new Mac app in once this one has quit, then opens it. `$1` this process's id,
 * `$2` the new app (unpacked and checked), `$3` the app to replace. If anything fails the old
 * app goes back where it was and opens again.
 */
export const MAC_SWAP_SCRIPT = `#!/bin/sh
pid="$1"; new="$2"; app="$3"
waited=0
while kill -0 "$pid" 2>/dev/null; do
  waited=$((waited + 1))
  [ "$waited" -gt 600 ] && exit 1
  sleep 0.1
done
old="$app.old-$pid"
rm -rf "$old"
if mv "$app" "$old"; then
  if mv "$new" "$app"; then rm -rf "$old"; else mv "$old" "$app"; fi
fi
xattr -dr com.apple.quarantine "$app" 2>/dev/null
open "$app"
`;

/** Starts a program once this process has quit (a second copy started earlier would close itself: one copy at a time). */
export const START_AFTER_QUIT_SCRIPT = `#!/bin/sh
pid="$1"; shift
waited=0
while kill -0 "$pid" 2>/dev/null; do
  waited=$((waited + 1))
  [ "$waited" -gt 600 ] && exit 1
  sleep 0.1
done
exec "$@"
`;

/** What the Electron side does; tests stand in for it. */
export interface UpdaterDeps {
  /** How this copy updates, or why it can't (worked out once, at start). */
  way(): Promise<{ kind: UpdateKind; arch: Arch } | { blocked: UpdateBlock }>;
  /** The newer release the update check found, if any. */
  notice(): UpdateNotice | null;
  /** GitHub's API answer (JSON), from api.github.com only. */
  api(url: string): Promise<unknown>;
  /** A small file from the release (latest*.yml), as text. */
  text(url: string): Promise<string>;
  /** Downloads a release file into a fresh folder; its sha512 (base64) and size. `progress` gets 0–1. */
  download(file: ReleaseFile, progress: (share: number) => void): Promise<{ path: string; sha512: string; size: number }>;
  /** Mac: unpacks the zip and checks the app in it is this app at `version`; the new app's path. */
  unpack(zip: string, version: string): Promise<string>;
  /** Puts the downloaded version in place once this copy quits, and quits. */
  install(kind: UpdateKind, staged: string): Promise<void>;
  openPage(url: string): Promise<void>;
  send(state: UpdateInstall): void;
}

export interface Updater {
  state(): Promise<UpdateInstall>;
  /** Starts the download (or opens the release page when this copy can't update itself). */
  download(): Promise<UpdateInstall>;
  /** Only once a download is ready: puts it in place and restarts. */
  install(): Promise<void>;
}

/** No connection (Chromium's net errors for it), as opposed to anything else going wrong. */
const OFFLINE =
  /ERR_(INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|NAME_RESOLUTION_FAILED|NETWORK_CHANGED|NETWORK_IO_SUSPENDED|ADDRESS_UNREACHABLE|CONNECTION_REFUSED|CONNECTION_RESET|CONNECTION_CLOSED|CONNECTION_TIMED_OUT|TIMED_OUT|PROXY_CONNECTION_FAILED)/;

/** A file that isn't the one the release lists. */
export class MismatchError extends Error {}

export function createUpdater(deps: UpdaterDeps): Updater {
  let state: UpdateInstall | null = null;
  let way: Awaited<ReturnType<UpdaterDeps["way"]>> | null = null;
  let staged: string | null = null;

  async function current(): Promise<UpdateInstall> {
    if (!state) {
      way = await deps.way();
      state = { blocked: "blocked" in way ? way.blocked : null, step: "idle", version: null, progress: null, problem: null };
    }
    return state;
  }

  function set(patch: Partial<UpdateInstall>): UpdateInstall {
    state = { ...(state as UpdateInstall), ...patch };
    deps.send(state);
    return state;
  }

  async function run(notice: UpdateNotice, kind: UpdateKind, arch: Arch): Promise<void> {
    try {
      const release = ReleaseAnswer.parse(await deps.api(releaseApiUrl(notice)));
      const picked = pickReleaseFile(
        release.assets.map((asset) => ({ name: asset.name, url: asset.browser_download_url, size: asset.size })),
        kind,
        arch,
      );
      if (!picked) {
        set({ blocked: "noFile", step: "idle", progress: null });
        await deps.openPage(notice.url);
        return;
      }
      // A release that publishes its update info must list this file in it.
      const expected = picked.info ? sha512From(await deps.text(picked.info.url), picked.file.name) : null;
      if (picked.info && !expected) throw new MismatchError(`${picked.info.name} doesn't list ${picked.file.name}`);
      let shown = -1;
      const file = await deps.download(picked.file, (share) => {
        const percent = Math.floor(Math.max(0, Math.min(1, share)) * 100);
        if (percent !== shown) set({ progress: (shown = percent) / 100 });
      });
      if (file.size !== picked.file.size || (expected && file.sha512 !== expected))
        throw new MismatchError(`${picked.file.name} isn't the file the release lists`);
      staged = kind === "mac" ? await deps.unpack(file.path, notice.version) : file.path;
      set({ step: "ready", progress: 1 });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const problem: UpdateProblem = error instanceof MismatchError ? "mismatch" : OFFLINE.test(message) ? "offline" : "failed";
      set({ step: "failed", progress: null, problem });
    }
  }

  return {
    state: current,
    async download() {
      const now = await current();
      const notice = deps.notice();
      if (!notice) throw new EngineError("Rejected", "No newer release");
      if (now.blocked || !way || "blocked" in way) {
        await deps.openPage(notice.url);
        return now;
      }
      // Already on its way, or there: nothing to start again.
      if ((now.step === "downloading" || now.step === "ready") && now.version === notice.version) return now;
      staged = null;
      const started = set({ step: "downloading", version: notice.version, progress: null, problem: null });
      void run(notice, way.kind, way.arch);
      return started;
    },
    async install() {
      const now = await current();
      if (now.step !== "ready" || !staged || !way || "blocked" in way) throw new EngineError("Rejected", "No update is ready to install");
      await deps.install(way.kind, staged);
    },
  };
}
