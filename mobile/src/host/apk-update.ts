// Updating on Android from inside the app: the desktop's "Unduh & pasang" (src/desktop/self-update.ts), with
// Android's own installer at the end instead of a restart. Only once the Student asks: the newer release's APK comes
// from GitHub (the release the daily check found, its file on github.com only), into the app's cache, with its
// progress on the version row; then Android's installer opens on it, and the Student confirms there. Android
// installs it over this copy only when it's signed with the same key (release.yml's), so a file that isn't ours
// can't replace the app; sign-in and saved data stay. An iPhone can't install an app itself: its row opens the
// release page (Sideloadly, docs/install.md).
import type { UpdateInstall, UpdateNotice } from "../../../src/core/models";
import { RELEASES_REPO } from "../../../src/core/updates";
import type { AreaLog } from "../../../src/engine/app-log";
import { EngineError } from "../../../src/engine/errors";

/** The release's APK, as mobile-release.yml names it (`Edunex-Plus-<version>-android.apk`); any APK on older ones. */
const APK = /\.apk$/i;
/** Where a release's files are served from: nothing else is downloaded. */
const FROM = `https://github.com/${RELEASES_REPO}/releases/download/`;

/** The phone's side: a file downloaded from GitHub, and Android's installer opened on it (host.ts, expo-file-system). */
export interface ApkFiles {
  /** Downloads `url` as this version's APK (replacing any earlier one); `progress` 0–1 as it goes. */
  download(url: string, version: string, progress: (done: number) => void): Promise<void>;
  /** Whether this version's APK is there, downloaded whole. */
  has(version: string): boolean;
  /** Opens Android's installer on it. */
  open(version: string): Promise<void>;
}

export interface ApkUpdater {
  /** How far it got, for the snapshot and the "update" events. */
  state(): UpdateInstall;
  /** Downloads the newer release's APK (once at a time), then opens Android's installer on it. */
  download(): Promise<UpdateInstall>;
  /** Opens Android's installer again on the downloaded APK (the Student backed out of it the first time). */
  install(): Promise<void>;
}

/**
 * Android's update from inside the app: `download` finds the newer release's APK on GitHub, downloads it with its
 * progress sent as "update" events, then opens the installer; `install` opens it again. One download at a time.
 */
export function apkUpdater(deps: {
  /** The newer release the update check found, or null. */
  notice(): UpdateNotice | null;
  send(update: UpdateInstall): void;
  log: AreaLog;
  files: ApkFiles;
  fetch?: typeof fetch;
}): ApkUpdater {
  const get = deps.fetch ?? fetch;
  let current: UpdateInstall = { blocked: null, step: "idle", version: null, progress: null, problem: null };
  const set = (next: Partial<UpdateInstall>) => {
    current = { ...current, ...next };
    deps.send(current);
  };

  /** The release's APK link, from GitHub's own answer for that tag; only a link to a file on that release counts. */
  async function apkUrl(version: string): Promise<string> {
    const response = await get(`https://api.github.com/repos/${RELEASES_REPO}/releases/tags/v${encodeURIComponent(version)}`, {
      headers: { accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" },
    });
    if (!response.ok) throw new EngineError("Failed", `GitHub answered ${response.status} for v${version}`);
    const release = (await response.json()) as { assets?: { name?: unknown; browser_download_url?: unknown }[] };
    const asset = release.assets?.find((item) => typeof item.name === "string" && APK.test(item.name));
    const url = asset?.browser_download_url;
    if (typeof url !== "string" || !url.startsWith(FROM)) throw new EngineError("Failed", `No APK on v${version}`);
    return url;
  }

  /** Opens Android's installer on the downloaded APK; refused when there's none whole for the version. */
  async function install(): Promise<void> {
    if (current.step !== "ready" || !current.version || !deps.files.has(current.version)) throw new EngineError("Rejected", "No downloaded update to install");
    // Android asks once whether Edunex Plus may install apps, then shows its own install screen.
    await deps.files.open(current.version);
  }

  return {
    state: () => current,
    async download() {
      const notice = deps.notice();
      if (!notice) throw new EngineError("Rejected", "No newer release");
      if (current.step === "downloading") return current;
      if (current.step === "ready" && current.version === notice.version && deps.files.has(notice.version)) {
        await install();
        return current;
      }
      set({ step: "downloading", version: notice.version, progress: null, problem: null });
      try {
        const url = await apkUrl(notice.version);
        let shown = -1;
        await deps.files.download(url, notice.version, (done) => {
          // A whole percent at a time: the version row redraws on each.
          const percent = Math.floor(done * 100);
          if (percent === shown) return;
          shown = percent;
          set({ progress: Math.min(1, done) });
        });
        set({ step: "ready", progress: 1 });
        deps.log("info", `downloaded ${notice.version}`);
      } catch (error) {
        const offline = error instanceof TypeError || /network|unable to resolve|timeout|failed to connect/i.test(String(error));
        deps.log("warn", `download failed: ${String(error)}`);
        set({ step: "failed", progress: null, problem: offline ? "offline" : "failed" });
        return current;
      }
      await install().catch((error) => deps.log("warn", `installer didn't open: ${String(error)}`));
      return current;
    },
    install,
  };
}
