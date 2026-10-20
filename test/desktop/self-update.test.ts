// Updating from inside the app: which file of a release is this computer's,
// the sha512 the release's latest*.yml gives for it, the only hosts a download
// may come from or be sent on to, where a Mac app can be replaced, and the plan
// main follows (download, check, wait for the Student, install).
import { describe, expect, it } from "vitest";
import type { UpdateInstall, UpdateNotice } from "../../src/core/models";
import {
  createUpdater,
  followAutoUpdates,
  isDownloadUrl,
  isPlainFileName,
  isReleaseFileUrl,
  MAC_SWAP_SCRIPT,
  macBundleOf,
  macPlaceProblem,
  pickReleaseFile,
  type ReleaseFile,
  releaseApiUrl,
  sha512From,
  type UpdaterDeps,
} from "../../src/desktop/self-update";

const RELEASE = "https://github.com/pablonification/edunex-plus/releases/download/v1.2.0";
const file = (name: string, size = 10, url = `${RELEASE}/${name}`): ReleaseFile => ({ name, url, size });
const SHA = `${"a".repeat(86)}==`;
const OTHER_SHA = `${"b".repeat(86)}==`;

const release = [
  file("Edunex-Plus-1.2.0-arm64.dmg"),
  file("Edunex-Plus-1.2.0-x64.dmg"),
  file("Edunex-Plus-1.2.0-arm64-mac.zip"),
  file("Edunex-Plus-1.2.0-x64-mac.zip"),
  file("Edunex-Plus-Setup-1.2.0.exe"),
  file("Edunex-Plus-1.2.0-x86_64.AppImage"),
  file("Edunex-Plus-1.2.0-arm64.AppImage"),
  file("edunex-plus_1.2.0_amd64.deb"),
  file("latest-mac.yml"),
  file("latest.yml"),
  file("latest-linux.yml"),
  file("latest-linux-arm64.yml"),
  file("Edunex-Plus-1.2.0-arm64.exe"),
  file("latest-win-arm64.yml"),
];

describe("this computer's file in a release", () => {
  it("is the zip for this kind of Mac, with latest-mac.yml", () => {
    expect(pickReleaseFile(release, "mac", "arm64")).toEqual({ file: release[2], info: release[8] });
    expect(pickReleaseFile(release, "mac", "x64")).toEqual({ file: release[3], info: release[8] });
  });

  it("is never a name that points at a folder, since the download is saved under it", () => {
    const sneaky = [file("../Edunex-Plus-1.2.0-arm64-mac.zip"), file("a/Edunex-Plus-1.2.0-arm64-mac.zip"), file(".Edunex-Plus-1.2.0-arm64-mac.zip")];
    expect(pickReleaseFile(sneaky, "mac", "arm64")).toBeNull();
    for (const name of ["..", ".", "", "a\\b.zip", "a/b.zip"]) expect(isPlainFileName(name)).toBe(false);
    expect(isPlainFileName("Edunex-Plus-1.2.0-arm64-mac.zip")).toBe(true);
  });

  it("is the installer for this kind of Windows PC: Setup with latest.yml, or the ARM one with its own", () => {
    expect(pickReleaseFile(release, "windows", "x64")).toEqual({ file: release[4], info: release[9] });
    expect(pickReleaseFile(release, "windows", "arm64")).toEqual({ file: release[12], info: release[13] });
  });

  it("is the AppImage for this kind of PC, with its own latest-linux*.yml", () => {
    expect(pickReleaseFile(release, "appImage", "x64")).toEqual({ file: release[5], info: release[10] });
    expect(pickReleaseFile(release, "appImage", "arm64")).toEqual({ file: release[6], info: release[11] });
  });

  it("is there without an update info file (an older release), and missing when the release has none for this computer", () => {
    expect(pickReleaseFile(release.slice(0, 8), "mac", "arm64")).toEqual({ file: release[2], info: null });
    expect(
      pickReleaseFile(
        release.filter((f) => !f.name.endsWith("mac.zip")),
        "mac",
        "arm64",
      ),
    ).toBeNull();
  });

  it("only counts files at this app's own release addresses", () => {
    const elsewhere = [file("Edunex-Plus-1.2.0-arm64-mac.zip", 10, "https://evil.example/Edunex-Plus-1.2.0-arm64-mac.zip")];
    expect(pickReleaseFile(elsewhere, "mac", "arm64")).toBeNull();
    const otherRepo = [file("Edunex-Plus-1.2.0-arm64-mac.zip", 10, "https://github.com/someone/else/releases/download/v1/x.zip")];
    expect(pickReleaseFile(otherRepo, "mac", "arm64")).toBeNull();
  });
});

describe("the sha512 in latest*.yml", () => {
  const yml = [
    "version: 1.2.0",
    "files:",
    "  - url: Edunex-Plus-1.2.0-arm64-mac.zip",
    `    sha512: ${SHA}`,
    "    size: 100",
    "  - url: 'Edunex-Plus-1.2.0-x64-mac.zip'",
    `    sha512: '${OTHER_SHA}'`,
    "    size: 120",
    "path: Edunex-Plus-1.2.0-arm64-mac.zip",
    `sha512: ${OTHER_SHA}`,
    "releaseDate: '2026-10-01T00:00:00.000Z'",
  ].join("\n");

  it("is the one listed under the file's own url", () => {
    expect(sha512From(yml, "Edunex-Plus-1.2.0-arm64-mac.zip")).toBe(SHA);
    expect(sha512From(yml, "Edunex-Plus-1.2.0-x64-mac.zip")).toBe(OTHER_SHA);
  });

  it("is null for a file it doesn't list, or a value that isn't a sha512", () => {
    expect(sha512From(yml, "Edunex-Plus-1.2.0-arm64.dmg")).toBeNull();
    // The top-level path/sha512 pair isn't a file entry.
    expect(sha512From("path: x.zip\nsha512: abc\n", "x.zip")).toBeNull();
    expect(sha512From("files:\n  - url: x.zip\n    sha512: short\n", "x.zip")).toBeNull();
  });

  it("reads Windows line ends", () => {
    expect(sha512From(yml.replaceAll("\n", "\r\n"), "Edunex-Plus-1.2.0-arm64-mac.zip")).toBe(SHA);
  });
});

describe("where a download may come from", () => {
  it("is GitHub and the hosts it sends release downloads on to, over https", () => {
    expect(isDownloadUrl(`${RELEASE}/latest-mac.yml`)).toBe(true);
    expect(isDownloadUrl("https://objects.githubusercontent.com/github-production-release-asset/1?sig=pretend")).toBe(true);
    expect(isDownloadUrl("https://release-assets.githubusercontent.com/github-production-release-asset/1?sig=pretend")).toBe(true);
  });

  it("is nowhere else, and never plain http, a name and password, or another port", () => {
    for (const url of [
      "http://github.com/pablonification/edunex-plus/releases/download/v1/x.zip",
      "https://github.com.evil.example/x.zip",
      "https://evilgithub.com/x.zip",
      // Split, so the repo's privacy check doesn't take it for an email address.
      `https://user:pass${"@"}github.com/x.zip`,
      "https://github.com:8443/x.zip",
      "https://api.github.com/repos/x",
      "file:///etc/passwd",
      "not a url",
    ]) {
      expect(isDownloadUrl(url), url).toBe(false);
    }
  });

  it("starts at this app's own release files", () => {
    expect(isReleaseFileUrl(`${RELEASE}/Edunex-Plus-1.2.0-arm64-mac.zip`)).toBe(true);
    expect(isReleaseFileUrl("https://objects.githubusercontent.com/x.zip")).toBe(false);
    expect(isReleaseFileUrl("https://github.com/pablonification/edunex-plus-fork/releases/download/v1/x.zip")).toBe(false);
  });

  it("asks GitHub's API for the release the update check found", () => {
    const notice = { version: "1.2.0-beta.1", url: "https://github.com/pablonification/edunex-plus/releases/tag/v1.2.0-beta.1" };
    expect(releaseApiUrl(notice)).toBe("https://api.github.com/repos/pablonification/edunex-plus/releases/tags/v1.2.0-beta.1");
  });
});

describe("where a Mac app can be replaced", () => {
  it("finds the app around the running program", () => {
    expect(macBundleOf("/Applications/Edunex Plus.app/Contents/MacOS/Edunex Plus")).toBe("/Applications/Edunex Plus.app");
    expect(macBundleOf("/usr/local/bin/edunex")).toBeNull();
  });

  it("is in a folder the Student can change, not a temporary copy macOS made or the disk image", () => {
    expect(macPlaceProblem("/Applications/Edunex Plus.app", true)).toBeNull();
    expect(macPlaceProblem("/private/var/folders/x/AppTranslocation/ABC/d/Edunex Plus.app", true)).toBe("translocated");
    expect(macPlaceProblem("/Volumes/Edunex Plus 1.2.0/Edunex Plus.app", false)).toBe("diskImage");
    expect(macPlaceProblem("/Applications/Edunex Plus.app", false)).toBe("readOnly");
  });

  it("is swapped only once the app has quit, with the old one put back if the swap fails", () => {
    expect(MAC_SWAP_SCRIPT).toContain('while kill -0 "$pid"');
    expect(MAC_SWAP_SCRIPT).toContain('if mv "$new" "$app"; then rm -rf "$old"; else mv "$old" "$app"; fi');
    // Opened again only when restarting for it; as the app quits ("Perbarui otomatis") it stays closed.
    expect(MAC_SWAP_SCRIPT).toContain('if [ "$reopen" = "1" ]; then open "$app"; fi');
  });
});

describe("the update plan", () => {
  const notice: UpdateNotice = { version: "1.2.0", url: "https://github.com/pablonification/edunex-plus/releases/tag/v1.2.0" };
  const zip = file("Edunex-Plus-1.2.0-arm64-mac.zip", 100);
  const answer = { tag_name: "v1.2.0", assets: [zip, file("latest-mac.yml")].map((f) => ({ name: f.name, browser_download_url: f.url, size: f.size })) };
  const yml = `files:\n  - url: ${zip.name}\n    sha512: ${SHA}\n    size: 100\n`;

  function setUp(overrides: Partial<UpdaterDeps> = {}) {
    const sent: UpdateInstall[] = [];
    const opened: string[] = [];
    const installed: string[] = [];
    const reopened: boolean[] = [];
    const updater = createUpdater({
      way: async () => ({ kind: "mac", arch: "arm64" }),
      notice: () => notice,
      api: async () => answer,
      text: async () => yml,
      download: async (_file, progress) => {
        progress(0.5);
        return { path: "/tmp/x.zip", sha512: SHA, size: 100 };
      },
      unpack: async () => "/tmp/app/Edunex Plus.app",
      install: async (_kind, staged, reopen) => {
        installed.push(staged);
        reopened.push(reopen);
      },
      openPage: async (url) => void opened.push(url),
      send: (state) => void sent.push(state),
      ...overrides,
    });
    const settled = async () => {
      for (let i = 0; i < 20; i++) await new Promise((resolve) => setImmediate(resolve));
    };
    return { updater, sent, opened, installed, reopened, settled };
  }

  it("downloads, checks the file, and waits for the Student before installing", async () => {
    const { updater, sent, installed, settled } = setUp();
    expect((await updater.download()).step).toBe("downloading");
    await settled();
    expect(sent.map((s) => [s.step, s.progress])).toEqual([
      ["downloading", null],
      ["downloading", 0.5],
      ["ready", 1],
    ]);
    expect(installed).toEqual([]);
    await updater.install();
    expect(installed).toEqual(["/tmp/app/Edunex Plus.app"]);
  });

  it('by itself ("Perbarui otomatis"), downloads the same way and puts it in place as the app quits, without opening it', async () => {
    const { updater, sent, installed, reopened, settled } = setUp();
    expect(await updater.installOnQuit()).toBe(false);
    await updater.fetch();
    await settled();
    expect(sent.at(-1)).toMatchObject({ step: "ready", version: "1.2.0" });
    // Asked again while it's there: nothing starts over.
    await updater.fetch();
    expect(sent.at(-1)).toMatchObject({ step: "ready" });
    expect(await updater.installOnQuit()).toBe(true);
    expect([installed, reopened]).toEqual([["/tmp/app/Edunex Plus.app"], [false]]);
    // Once is enough, whichever way it went in.
    expect(await updater.installOnQuit()).toBe(false);
    await expect(updater.install()).resolves.toBeUndefined();
  });

  it("by itself, never opens a page, and doesn't try a failed download again until the Student does", async () => {
    const blocked = setUp({ way: async () => ({ blocked: "deb" }) });
    await blocked.updater.fetch();
    expect([blocked.opened, blocked.sent]).toEqual([[], []]);

    const noFile = setUp({ api: async () => ({ tag_name: "v1.2.0", assets: [] }) });
    await noFile.updater.fetch();
    await noFile.settled();
    expect(noFile.sent.at(-1)).toMatchObject({ blocked: "noFile" });
    expect(noFile.opened).toEqual([]);

    let tries = 0;
    const failing = setUp({
      api: async () => {
        tries++;
        throw new Error("net::ERR_INTERNET_DISCONNECTED");
      },
    });
    await failing.updater.fetch();
    await failing.settled();
    await failing.updater.fetch();
    await failing.settled();
    expect(tries).toBe(1);
    expect(failing.sent.at(-1)).toMatchObject({ step: "failed" });
    await failing.updater.download();
    await failing.settled();
    expect(tries).toBe(2);
  });

  it("restarting for it puts it in place once, opened again", async () => {
    const { updater, reopened, settled } = setUp();
    await updater.download();
    await settled();
    await updater.install();
    expect(await updater.installOnQuit()).toBe(false);
    expect(reopened).toEqual([true]);
  });

  it("never installs before a download is ready", async () => {
    const { updater, installed } = setUp();
    await expect(updater.install()).rejects.toThrow("No update is ready");
    expect(installed).toEqual([]);
  });

  it("refuses a file whose sha512 isn't the one the release lists", async () => {
    const { updater, sent, settled } = setUp({ download: async () => ({ path: "/tmp/x.zip", sha512: OTHER_SHA, size: 100 }) });
    await updater.download();
    await settled();
    expect(sent.at(-1)).toMatchObject({ step: "failed", problem: "mismatch" });
    await expect(updater.install()).rejects.toThrow();
  });

  it("says when there's no connection", async () => {
    const { updater, sent, settled } = setUp({
      api: async () => {
        throw new Error("net::ERR_INTERNET_DISCONNECTED");
      },
    });
    await updater.download();
    await settled();
    expect(sent.at(-1)).toMatchObject({ step: "failed", problem: "offline" });
  });

  it("opens the release page instead when this copy can't update itself", async () => {
    const { updater, opened, sent } = setUp({ way: async () => ({ blocked: "deb" }) });
    expect(await updater.download()).toMatchObject({ blocked: "deb", step: "idle" });
    expect(opened).toEqual([notice.url]);
    expect(sent).toEqual([]);
  });

  it("opens the release page when the release has no file for this computer", async () => {
    const { updater, opened, sent, settled } = setUp({ api: async () => ({ tag_name: "v1.2.0", assets: [] }) });
    await updater.download();
    await settled();
    expect(sent.at(-1)).toMatchObject({ blocked: "noFile", step: "idle" });
    expect(opened).toEqual([notice.url]);
  });
});

describe('"Perbarui otomatis"', () => {
  const fake = () => {
    const done: string[] = [];
    return {
      done,
      updater: {
        fetch: async () => void done.push("fetch"),
        installOnQuit: async () => {
          done.push("installOnQuit");
          return true;
        },
      },
    };
  };
  const found = { type: "dataset", dataset: { name: "app.update", value: {}, fetchedAt: 0, hash: "h" } } as const;

  it("downloads a newer release as soon as it's found, at start too, and puts it in place before the app quits", async () => {
    const { updater, done } = fake();
    const auto = followAutoUpdates(updater, () => true);
    auto.resume();
    auto.onEvent(found as never);
    auto.onEvent({ type: "dataset", dataset: { name: "edunex.tasks", value: [], fetchedAt: 0, hash: "h" } } as never);
    expect(await auto.beforeQuit()).toBe(true);
    expect(done).toEqual(["fetch", "fetch", "installOnQuit"]);
  });

  it("turned off, does nothing by itself; turned on, starts at once", async () => {
    const { updater, done } = fake();
    let on = false;
    const auto = followAutoUpdates(updater, () => on);
    auto.resume();
    auto.onEvent(found as never);
    expect(await auto.beforeQuit()).toBe(false);
    expect(done).toEqual([]);
    on = true;
    auto.onEvent({ type: "settings", settings: { autoUpdate: true } } as never);
    expect(done).toEqual(["fetch"]);
  });
});
