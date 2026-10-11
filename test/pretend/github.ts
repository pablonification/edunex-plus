// A pretend GitHub for the "new version available" check: the latest release
// of pablonification/edunex-plus, or none, or an error. Records each request.
import type { HttpRequest, HttpResponse } from "../../src/engine/http/transport";

export class PretendGithub {
  /** The latest release's tag; null = nothing published yet (GitHub answers 404). */
  latestTag: string | null = null;
  /** Every answer has this status instead (rate limit, outage). */
  failWith: number | null = null;
  /** Requests received, with the time and the User-Agent they carried. */
  readonly requests: { at: number; userAgent: string | undefined }[] = [];

  constructor(private readonly now: () => number) {}

  handle(request: HttpRequest, url: URL): HttpResponse {
    this.requests.push({ at: this.now(), userAgent: request.headers?.["user-agent"] });
    const answer = (status: number, body: unknown) => ({ status, headers: { "content-type": "application/json" }, body: JSON.stringify(body), url: url.toString() });
    if (url.pathname !== "/repos/pablonification/edunex-plus/releases/latest") return answer(404, { message: "Not Found" });
    if (this.failWith) return answer(this.failWith, { message: "API rate limit exceeded" });
    if (this.latestTag === null) return answer(404, { message: "Not Found" });
    return answer(200, {
      tag_name: this.latestTag,
      name: `Edunex Plus ${this.latestTag}`,
      html_url: `https://github.com/pablonification/edunex-plus/releases/tag/${this.latestTag}`,
      draft: false,
      prerelease: false,
      assets: [],
    });
  }
}
