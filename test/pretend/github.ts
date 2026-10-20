// A pretend GitHub for the "new version available" check: the latest release
// of pablonification/edunex-plus, or none, or an error; and the list of every
// release, pre-releases and drafts included. Records each request. For
// updating from inside the app: each release's files (the Mac zips and the
// latest-mac.yml listing their sha512), and their downloads.
import { createHash } from "node:crypto";
import type { HttpRequest, HttpResponse } from "../../src/engine/http/transport";

const REPO = "/repos/pablonification/edunex-plus";

export class PretendGithub {
  /** The latest full release's tag; null = nothing published yet (GitHub answers 404). */
  latestTag: string | null = null;
  /** Published pre-releases (alphas, betas): only in the list of every release. */
  preReleaseTags: string[] = [];
  /** Drafts: in the list too, as GitHub shows them to the repository's own token (never to the app, but stay safe). */
  draftTags: string[] = [];
  /** Every answer has this status instead (rate limit, outage). */
  failWith: number | null = null;
  /** No latest-mac.yml in the releases (as before the app could update itself). */
  noUpdateInfo = false;
  /** Files whose download isn't the file latest-mac.yml lists. */
  readonly tampered = new Set<string>();
  /** Requests received, with the time, the path asked and the User-Agent they carried. */
  readonly requests: { at: number; path: string; userAgent: string | undefined }[] = [];

  constructor(private readonly now: () => number) {}

  handle(request: HttpRequest, url: URL): HttpResponse {
    this.requests.push({ at: this.now(), path: url.pathname, userAgent: request.headers?.["user-agent"] });
    const answer = (status: number, body: unknown) => ({
      status,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      url: url.toString(),
    });
    const release = (tag: string, kind: "full" | "pre" | "draft") => ({
      tag_name: tag,
      name: `Edunex Plus ${tag}`,
      html_url: `https://github.com/pablonification/edunex-plus/releases/tag/${tag}`,
      draft: kind === "draft",
      prerelease: kind === "pre",
      assets: this.files(tag).map(({ name, content }) => ({ name, browser_download_url: this.fileUrl(tag, name), size: content.byteLength })),
    });
    const tagged = /^\/repos\/pablonification\/edunex-plus\/releases\/tags\/([^/]+)$/.exec(url.pathname);
    if (tagged) {
      const tag = decodeURIComponent(tagged[1]);
      if (this.failWith) return answer(this.failWith, { message: "API rate limit exceeded" });
      if (this.latestTag === tag) return answer(200, release(tag, "full"));
      if (this.preReleaseTags.includes(tag)) return answer(200, release(tag, "pre"));
      return answer(404, { message: "Not Found" });
    }
    if (url.pathname !== `${REPO}/releases/latest` && url.pathname !== `${REPO}/releases`) return answer(404, { message: "Not Found" });
    if (this.failWith) return answer(this.failWith, { message: "API rate limit exceeded" });
    if (url.pathname === `${REPO}/releases`) {
      return answer(200, [
        ...this.draftTags.map((tag) => release(tag, "draft")),
        ...this.preReleaseTags.map((tag) => release(tag, "pre")),
        ...(this.latestTag === null ? [] : [release(this.latestTag, "full")]),
      ]);
    }
    if (this.latestTag === null) return answer(404, { message: "Not Found" });
    return answer(200, release(this.latestTag, "full"));
  }

  /** Where a release's file downloads from, as GitHub's API gives it. */
  fileUrl(tag: string, name: string): string {
    return `https://github.com/pablonification/edunex-plus/releases/download/${tag}/${encodeURIComponent(name)}`;
  }

  /** A release's files: a zip for each kind of Mac, and the latest-mac.yml electron-builder writes for them. */
  files(tag: string): { name: string; content: Buffer }[] {
    const version = tag.replace(/^v/, "");
    const zips = ["arm64", "x64"].map((arch) => {
      const name = `Edunex-Plus-${version}-${arch}-mac.zip`;
      return { name, content: Buffer.from(`the ${arch} app, ${version}`) };
    });
    if (this.noUpdateInfo) return zips;
    const sha512 = (content: Buffer) => createHash("sha512").update(content).digest("base64");
    const yml = [
      `version: ${version}`,
      "files:",
      ...zips.flatMap(({ name, content }) => [`  - url: ${name}`, `    sha512: ${sha512(content)}`, `    size: ${content.byteLength}`]),
      `path: ${zips[0].name}`,
      `sha512: ${sha512(zips[0].content)}`,
      "releaseDate: '2026-10-01T00:00:00.000Z'",
    ].join("\n");
    return [...zips, { name: "latest-mac.yml", content: Buffer.from(yml) }];
  }

  /** A release file's download (from its address), or null; a tampered file comes back changed. */
  download(url: string): Buffer | null {
    const match = /^https:\/\/github\.com\/pablonification\/edunex-plus\/releases\/download\/([^/]+)\/([^/]+)$/.exec(url);
    if (!match) return null;
    const name = decodeURIComponent(match[2]);
    const file = this.files(match[1]).find((entry) => entry.name === name);
    if (!file) return null;
    return this.tampered.has(name) ? Buffer.concat([file.content.subarray(1), Buffer.from("!")]) : file.content;
  }
}
