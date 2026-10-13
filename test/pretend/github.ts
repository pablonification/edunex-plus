// A pretend GitHub for the "new version available" check: the latest release
// of pablonification/edunex-plus, or none, or an error; and the list of every
// release, pre-releases and drafts included. Records each request.
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
      assets: [],
    });
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
}
