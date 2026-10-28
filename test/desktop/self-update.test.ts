// Updating from inside the app: which file of a release is this computer's (on
// a Mac, the smaller .tar.xz when the release lists it), the sha512 the
// release's latest*.yml gives for it, the only hosts a download may come from
// or be sent on to, where a Mac app can be replaced, and the plan main follows
// (download, check, wait for the Student, install).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { UpdateInstall, UpdateNotice } from "../../src/core/models";
import {
  createUpdater,
  downloadOf,
  filesListedIn,
  followAutoUpdates,
  isDownloadUrl,
  isPlainFileName,
  isReleaseFileUrl,
  MAC_SWAP_SCRIPT,
  MismatchError,
  macBundleOf,
  macPlaceProblem,
  type Patch,
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
  file("Edunex-Plus-1.2.0-arm64-mac.tar.xz"),
  file("Edunex-Plus-1.2.0-x64-mac.tar.xz"),
];

describe("this computer's file in a release", () => {
  it("is the zip for this kind of Mac, and the same app packed smaller beside it, with latest-mac.yml", () => {
    expect(pickReleaseFile(release, "mac", "arm64")).toEqual({ file: release[2], smaller: release[14], info: release[8] });
    expect(pickReleaseFile(release, "mac", "x64")).toEqual({ file: release[3], smaller: release[15], info: release[8] });
  });

  it("is never a name that points at a folder, since the download is saved under it", () => {
    const sneaky = [file("../Edunex-Plus-1.2.0-arm64-mac.zip"), file("a/Edunex-Plus-1.2.0-arm64-mac.zip"), file(".Edunex-Plus-1.2.0-arm64-mac.zip")];
    expect(pickReleaseFile(sneaky, "mac", "arm64")).toBeNull();
    for (const name of ["..", ".", "", "a\\b.zip", "a/b.zip"]) expect(isPlainFileName(name)).toBe(false);
    expect(isPlainFileName("Edunex-Plus-1.2.0-arm64-mac.zip")).toBe(true);
  });

  it("is the installer for this kind of Windows PC: Setup with latest.yml, or the ARM one with its own", () => {
    expect(pickReleaseFile(release, "windows", "x64")).toEqual({ file: release[4], smaller: null, info: release[9] });
    expect(pickReleaseFile(release, "windows", "arm64")).toEqual({ file: release[12], smaller: null, info: release[13] });
  });

  it("is the AppImage for this kind of PC, with its own latest-linux*.yml", () => {
    expect(pickReleaseFile(release, "appImage", "x64")).toEqual({ file: release[5], smaller: null, info: release[10] });
    expect(pickReleaseFile(release, "appImage", "arm64")).toEqual({ file: release[6], smaller: null, info: release[11] });
  });

  it("is there without an update info file (an older release), and missing when the release has none for this computer", () => {
    expect(pickReleaseFile(release.slice(0, 8), "mac", "arm64")).toEqual({ file: release[2], smaller: null, info: null });
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

describe("the file a Mac downloads", () => {
  const zip = file("Edunex-Plus-1.2.0-arm64-mac.zip", 118);
  const tarXz = file("Edunex-Plus-1.2.0-arm64-mac.tar.xz", 80);
  const listing = (...listed: [ReleaseFile, string][]) => `files:\n${listed.map(([f, sha]) => `  - url: ${f.name}\n    sha512: ${sha}\n`).join("")}`;

  it("is the smaller .tar.xz when latest-mac.yml lists it, checked against its own sha512", () => {
    const yml = listing([zip, SHA], [tarXz, OTHER_SHA]);
    expect(downloadOf({ file: zip, smaller: tarXz, info: null }, yml)).toEqual({ file: tarXz, sha512: OTHER_SHA });
  });

  it("is the zip when the release has no .tar.xz, or latest-mac.yml doesn't list it", () => {
    const yml = listing([zip, SHA]);
    expect(downloadOf({ file: zip, smaller: null, info: null }, yml)).toEqual({ file: zip, sha512: SHA });
    expect(downloadOf({ file: zip, smaller: tarXz, info: null }, yml)).toEqual({ file: zip, sha512: SHA });
  });

  it("is the zip, checked by its size only, in a release without latest-mac.yml (an older one), and none when the yml lists neither", () => {
    expect(downloadOf({ file: zip, smaller: tarXz, info: null }, null)).toEqual({ file: zip, sha512: null });
    expect(downloadOf({ file: zip, smaller: tarXz, info: null }, listing())).toBeNull();
  });
});

describe("the files latest*.yml lists", () => {
  const notice: UpdateNotice = { version: "1.2.0", url: "https://github.com/pablonification/edunex-plus/releases/tag/v1.2.0" };

  it("are each listed file with its size, at the release's download address", () => {
    const yml = [
      "version: 1.2.0",
      "files:",
      "  - url: Edunex-Plus-1.2.0-arm64-mac.zip",
      `    sha512: ${SHA}`,
      "    size: 100",
      "  - url: 'Edunex-Plus-1.2.0-arm64-mac.tar.xz'",
      `    sha512: ${OTHER_SHA}`,
      "    size: 80",
      "  - url: ../elsewhere.zip",
      "    size: 5",
      "path: Edunex-Plus-1.2.0-arm64-mac.zip",
      "size: 999",
    ].join("\n");
    expect(filesListedIn(yml, notice)).toEqual([file("Edunex-Plus-1.2.0-arm64-mac.zip", 100), file("Edunex-Plus-1.2.0-arm64-mac.tar.xz", 80)]);
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
    const unpacked: string[] = [];
    const updater = createUpdater({
      way: async () => ({ kind: "mac", arch: "arm64" }),
      notice: () => notice,
      api: async () => answer,
      text: async () => yml,
      patch: async () => null,
      download: async (_file, progress) => {
        progress(0.5);
        return { path: "/tmp/x.zip", sha512: SHA, size: 100 };
      },
      unpack: async (_archive, kind) => {
        unpacked.push(kind);
        return "/tmp/app/Edunex Plus.app";
      },
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
    return { updater, sent, opened, installed, reopened, unpacked, settled };
  }

  it("downloads, checks the file, and waits for the Student before installing", async () => {
    const { updater, sent, installed, unpacked, settled } = setUp();
    expect((await updater.download()).step).toBe("downloading");
    await settled();
    expect(sent.map((s) => [s.step, s.progress])).toEqual([
      ["downloading", null],
      ["downloading", 0.5],
      ["ready", 1],
    ]);
    expect([installed, unpacked]).toEqual([[], ["zip"]]);
    await updater.install();
    expect(installed).toEqual(["/tmp/app/Edunex Plus.app"]);
  });

  it("on a Mac, downloads the smaller .tar.xz when the release lists it, and unpacks it as one", async () => {
    const tarXz = file("Edunex-Plus-1.2.0-arm64-mac.tar.xz", 80);
    const downloaded: string[] = [];
    const { updater, sent, unpacked, settled } = setUp({
      api: async () => ({ ...answer, assets: [...answer.assets, { name: tarXz.name, browser_download_url: tarXz.url, size: tarXz.size }] }),
      text: async () => `${yml}  - url: ${tarXz.name}\n    sha512: ${OTHER_SHA}\n    size: 80\n`,
      download: async (picked) => {
        downloaded.push(picked.name);
        return { path: `/tmp/${picked.name}`, sha512: OTHER_SHA, size: 80 };
      },
    });
    await updater.download();
    await settled();
    expect([downloaded, unpacked]).toEqual([[tarXz.name], ["tarXz"]]);
    expect(sent.at(-1)).toMatchObject({ step: "ready" });
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

  it("by itself, tries a failed download again once the connection is back, but never a file that didn't match", async () => {
    let tries = 0;
    let online = false;
    const { updater, sent, settled } = setUp({
      api: async () => {
        tries++;
        if (!online) throw new Error("net::ERR_NETWORK_ACCESS_DENIED");
        return answer;
      },
      text: async () => {
        if (!online) throw new Error("net::ERR_NETWORK_ACCESS_DENIED");
        return yml;
      },
    });
    await updater.fetch();
    await settled();
    expect(sent.at(-1)).toMatchObject({ step: "failed", problem: "failed" });
    online = true;
    await updater.fetch(true);
    await settled();
    expect(tries).toBe(2);
    expect(sent.at(-1)).toMatchObject({ step: "ready", version: "1.2.0" });

    const wrong = setUp({ download: async () => ({ path: "/tmp/x.zip", sha512: OTHER_SHA, size: 100 }) });
    await wrong.updater.fetch();
    await wrong.settled();
    expect(wrong.sent.at(-1)).toMatchObject({ step: "failed", problem: "mismatch" });
    const before = wrong.sent.length;
    await wrong.updater.fetch(true);
    await wrong.settled();
    expect(wrong.sent.length).toBe(before);
  });

  it("follows the newest release found: an older download still finishing never says how it went over the newer one", async () => {
    const newer: UpdateNotice = { version: "1.3.0", url: "https://github.com/pablonification/edunex-plus/releases/tag/v1.3.0" };
    let found = notice;
    let finishOlder: () => void = () => undefined;
    const { updater, sent, installed, settled } = setUp({
      notice: () => found,
      unpack: async (_archive, _kind, version) => {
        if (version === "1.2.0") await new Promise<void>((resolve) => (finishOlder = resolve));
        return `/tmp/app/${version}.app`;
      },
    });
    await updater.fetch();
    await settled();
    found = newer;
    await updater.fetch();
    await settled();
    expect(sent.at(-1)).toMatchObject({ step: "ready", version: "1.3.0" });
    finishOlder();
    await settled();
    expect(sent.at(-1)).toMatchObject({ step: "ready", version: "1.3.0" });
    await updater.install();
    expect(installed).toEqual(["/tmp/app/1.3.0.app"]);
  });

  it("downloads once when asked twice at the same moment (at start, and the release just found), so its bar only goes forward", async () => {
    let downloads = 0;
    const { updater, sent, settled } = setUp({
      download: async (_file, progress) => {
        downloads++;
        progress(0.5);
        await new Promise((resolve) => setImmediate(resolve));
        progress(0.9);
        return { path: "/tmp/x.zip", sha512: SHA, size: 100 };
      },
    });
    // The window asks how far it got while both are still working out how this copy updates.
    await Promise.all([updater.fetch(), updater.fetch(), updater.state(), updater.download()]);
    await settled();
    expect(downloads).toBe(1);
    expect(sent.map((s) => [s.step, s.progress])).toEqual([
      ["downloading", null],
      ["downloading", 0.5],
      ["downloading", 0.9],
      ["ready", 1],
    ]);
  });

  it("asks again how this copy updates when the first answer failed, everyone waiting on it told so", async () => {
    let asked = 0;
    const { updater, settled, sent } = setUp({
      way: async () => {
        asked++;
        if (asked === 1) throw new Error("EACCES");
        return { kind: "mac", arch: "arm64" };
      },
    });
    const first = await Promise.allSettled([updater.state(), updater.fetch()]);
    expect(first.map((result) => result.status)).toEqual(["rejected", "rejected"]);
    expect(asked).toBe(1);
    await updater.fetch();
    await settled();
    expect(asked).toBe(2);
    expect(sent.at(-1)).toMatchObject({ step: "ready", version: "1.2.0" });
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

  it("downloads only what changed when the release maps it, and puts that in place", async () => {
    const asked: Patch[] = [];
    let downloads = 0;
    const { updater, sent, installed, settled } = setUp({
      patch: async (update, progress) => {
        asked.push(update);
        progress(0.4);
        return "/tmp/app/Edunex Plus.app";
      },
      download: async () => {
        downloads++;
        return { path: "/tmp/x.zip", sha512: SHA, size: 100 };
      },
    });
    await updater.download();
    await settled();
    expect(asked).toEqual([{ kind: "mac", arch: "arm64", version: "1.2.0", release: [zip, file("latest-mac.yml")], file: zip, yml, sha512: SHA }]);
    expect(downloads).toBe(0);
    expect(sent.map((s) => [s.step, s.progress])).toEqual([
      ["downloading", null],
      ["downloading", 0.4],
      ["ready", 1],
    ]);
    await updater.install();
    expect(installed).toEqual(["/tmp/app/Edunex Plus.app"]);
  });

  it("downloads the whole file when only what changed doesn't line up, its bar starting again", async () => {
    const { updater, sent, installed, settled } = setUp({
      patch: async (_update, progress) => {
        progress(0.3);
        throw new MismatchError("Chunk 3 isn't the one the map lists");
      },
    });
    await updater.download();
    await settled();
    expect(sent.map((s) => [s.step, s.progress])).toEqual([
      ["downloading", null],
      ["downloading", 0.3],
      ["downloading", null],
      ["downloading", 0.5],
      ["ready", 1],
    ]);
    await updater.install();
    expect(installed).toEqual(["/tmp/app/Edunex Plus.app"]);
  });

  it("doesn't try the whole file without a connection, nor only what changed for a release without update info", async () => {
    let downloads = 0;
    const offline = setUp({
      patch: async () => {
        throw new Error("net::ERR_INTERNET_DISCONNECTED");
      },
      download: async () => {
        downloads++;
        return { path: "/tmp/x.zip", sha512: SHA, size: 100 };
      },
    });
    await offline.updater.download();
    await offline.settled();
    expect(offline.sent.at(-1)).toMatchObject({ step: "failed", problem: "offline" });
    expect(downloads).toBe(0);

    let patched = 0;
    const older = setUp({
      api: async () => ({ ...answer, assets: answer.assets.slice(0, 1) }),
      patch: async () => {
        patched++;
        return null;
      },
    });
    await older.updater.download();
    await older.settled();
    expect(older.sent.at(-1)).toMatchObject({ step: "ready" });
    expect(patched).toBe(0);
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

  it("reads the release's files from its update info when GitHub's API refuses (too many questions from a shared address)", async () => {
    const asked: string[] = [];
    const downloaded: string[] = [];
    const { updater, sent, settled } = setUp({
      api: async () => {
        throw new Error("GitHub answered 403");
      },
      text: async (url) => {
        asked.push(url);
        return yml;
      },
      download: async (picked) => {
        downloaded.push(picked.url);
        return { path: "/tmp/x.zip", sha512: SHA, size: 100 };
      },
    });
    await updater.fetch();
    await settled();
    expect(asked.every((url) => url === `${RELEASE}/latest-mac.yml`)).toBe(true);
    expect(downloaded).toEqual([zip.url]);
    expect(sent.at(-1)).toMatchObject({ step: "ready", version: "1.2.0" });
  });

  it("without a connection, doesn't try the update info instead of the API", async () => {
    let read = 0;
    const { updater, sent, settled } = setUp({
      api: async () => {
        throw new Error("net::ERR_INTERNET_DISCONNECTED");
      },
      text: async () => {
        read++;
        return yml;
      },
    });
    await updater.fetch();
    await settled();
    expect(read).toBe(0);
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
        fetch: async (again?: boolean) => void done.push(again ? "fetch again" : "fetch"),
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

  it("tries a failed download again when the connection comes back, once each time", () => {
    const { updater, done } = fake();
    const auto = followAutoUpdates(updater, () => true);
    const status = (state: string) => ({ type: "status", status: { source: "edunex", state } }) as never;
    auto.onEvent(status("live"));
    auto.onEvent(status("offline"));
    auto.onEvent(status("offline"));
    auto.onEvent(status("live"));
    auto.onEvent(status("live"));
    expect(done).toEqual(["fetch again"]);
  });
});

describe("the update's files on disk", () => {
  it("go through original-fs: Electron's own fs takes an app.asar for a folder, and can't remove a downloaded app", () => {
    for (const file of ["src/desktop/updater.ts", "src/desktop/partial-update.ts"]) {
      const source = readFileSync(file, "utf8");
      // Types alone are fine: nothing is read through them.
      expect(source, file).not.toMatch(/^import (?!type )[^;]*from "(node:)?fs(\/promises)?";/m);
      expect(source, file).toContain('from "original-fs"');
    }
  });
});
