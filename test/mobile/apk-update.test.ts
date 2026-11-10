// Android's update from inside the app (mobile/src/host/apk-update.ts): the newer release's APK comes from GitHub's
// own release, its progress shows on the version row, and Android's installer opens once it's whole. A file from
// anywhere else is never downloaded, and a dropped connection says so.
import { describe, expect, it, vi } from "vitest";
import { type ApkFiles, apkUpdater } from "../../mobile/src/host/apk-update";
import type { UpdateInstall } from "../../src/core/models";

const RELEASE = "https://github.com/pablonification/edunex-plus/releases/download/v0.2.0";

function release(assets: { name: string; browser_download_url: string }[], status = 200) {
  return vi.fn(async () => new Response(JSON.stringify({ tag_name: "v0.2.0", assets }), { status })) as unknown as typeof fetch;
}

function world(get: typeof fetch, download?: ApkFiles["download"]) {
  const sent: UpdateInstall[] = [];
  const fetched = new Set<string>();
  const files: ApkFiles = {
    download: vi.fn(
      download ??
        (async (_url: string, version: string, progress: (done: number) => void) => {
          progress(0.004);
          progress(0.5);
          progress(0.504);
          progress(1);
          fetched.add(version);
        }),
    ),
    has: (version) => fetched.has(version),
    open: vi.fn(async () => undefined),
  };
  const updater = apkUpdater({
    notice: () => ({ version: "0.2.0", url: "https://github.com/pablonification/edunex-plus/releases/tag/v0.2.0" }),
    send: (update) => sent.push(update),
    log: () => undefined,
    files,
    fetch: get,
  });
  return { updater, files, sent };
}

describe("Android's update from inside the app", () => {
  it("downloads the release's APK from GitHub, shows each whole percent, then opens the installer", async () => {
    const get = release([
      { name: "Edunex-Plus-0.2.0-arm64.dmg", browser_download_url: `${RELEASE}/Edunex-Plus-0.2.0-arm64.dmg` },
      { name: "Edunex-Plus-0.2.0-android.apk", browser_download_url: `${RELEASE}/Edunex-Plus-0.2.0-android.apk` },
    ]);
    const { updater, files, sent } = world(get);
    const done = await updater.download();
    expect(vi.mocked(get).mock.calls[0]?.[0]).toBe("https://api.github.com/repos/pablonification/edunex-plus/releases/tags/v0.2.0");
    expect(vi.mocked(files.download).mock.calls[0]?.[0]).toBe(`${RELEASE}/Edunex-Plus-0.2.0-android.apk`);
    // downloading, 0%, 50% (50.4% isn't a new whole percent), 100%, ready.
    expect(sent.map((update) => [update.step, update.progress])).toEqual([
      ["downloading", null],
      ["downloading", 0.004],
      ["downloading", 0.5],
      ["downloading", 1],
      ["ready", 1],
    ]);
    expect(done).toMatchObject({ step: "ready", version: "0.2.0", blocked: null, problem: null });
    expect(files.open).toHaveBeenCalledWith("0.2.0");
  });

  it("never downloads an APK linked from anywhere but the release on github.com", async () => {
    const { updater, files } = world(release([{ name: "Edunex-Plus-0.2.0-android.apk", browser_download_url: "https://example.com/Edunex-Plus.apk" }]));
    expect(await updater.download()).toMatchObject({ step: "failed", problem: "failed" });
    expect(files.download).not.toHaveBeenCalled();
    expect(files.open).not.toHaveBeenCalled();
  });

  it("says the connection dropped, and tries again from the start", async () => {
    const offline = vi.fn(async () => {
      throw new TypeError("Network request failed");
    }) as unknown as typeof fetch;
    const { updater } = world(offline);
    expect(await updater.download()).toMatchObject({ step: "failed", problem: "offline" });
    await expect(updater.install()).rejects.toThrow();
  });

  it("opens the installer again on the same download, without downloading it twice", async () => {
    const { updater, files } = world(release([{ name: "x-android.apk", browser_download_url: `${RELEASE}/x-android.apk` }]));
    await updater.download();
    await updater.install();
    await updater.download();
    expect(files.download).toHaveBeenCalledTimes(1);
    expect(files.open).toHaveBeenCalledTimes(3);
  });
});
