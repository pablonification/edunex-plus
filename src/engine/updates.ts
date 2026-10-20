// The "new version available" check (#82): asks GitHub for the latest release
// at most once a day and publishes it when it is newer than the running
// version. A pre-release copy (an alpha) looks at every published release, so
// it hears about the next alpha too; a full release only ever offers a full
// release. Quiet by design: offline, a refusal or an odd answer just means
// no notice. Never downloads or installs anything itself: the window links to
// the release page, and main downloads and installs only when the Student
// asks (src/desktop/self-update.ts).
import { z } from "zod";
import type { UpdateNotice } from "../core/models";
import { isNewerRelease, isPrerelease, LATEST_RELEASE_API, newestTag, RELEASES_API, releasePageUrl } from "../core/updates";
import type { Clock, TimerHandle } from "./clock";
import type { Transport } from "./http/transport";
import type { Storage } from "./store/storage";

const DAY = 24 * 60 * 60_000;
/** After a start, give the Student's own syncing the first minute. */
const FIRST_CHECK_AFTER = 60_000;
/** No answer at all (offline): try again sooner than tomorrow; it still counts as no check. */
const RETRY_OFFLINE_AFTER = 60 * 60_000;
const STATE_KEY = "updates.json";

const LatestRelease = z.object({ tag_name: z.string(), draft: z.boolean().optional(), prerelease: z.boolean().optional() });
const Releases = z.array(LatestRelease);

export interface UpdateCheckDeps {
  transport: Transport;
  clock: Clock;
  storage: Storage;
  version: string;
  userAgent: string;
  /** A newer release, or null when the running version is the latest. */
  publish(notice: UpdateNotice | null): Promise<void>;
}

export interface UpdateCheck {
  start(): void;
  stop(): void;
}

export function createUpdateCheck(deps: UpdateCheckDeps): UpdateCheck {
  const { clock, storage } = deps;
  let timer: TimerHandle | null = null;
  let running = false;

  const schedule = (ms: number) => {
    if (!running) return;
    if (timer) clock.clearTimeout(timer);
    timer = clock.setTimeout(() => void check(), ms);
  };

  async function lastChecked(): Promise<number | null> {
    try {
      const saved = JSON.parse((await storage.read(STATE_KEY)) ?? "null");
      return typeof saved?.checkedAt === "number" ? saved.checkedAt : null;
    } catch {
      return null;
    }
  }

  /** The tag to compare with, from GitHub's answer; undefined when the answer is odd. */
  function offered(body: string, everyRelease: boolean): string | null | undefined {
    if (everyRelease) {
      const releases = Releases.safeParse(JSON.parse(body));
      if (!releases.success) return undefined;
      return newestTag(releases.data.filter((release) => !release.draft).map((release) => release.tag_name));
    }
    const release = LatestRelease.safeParse(JSON.parse(body));
    if (!release.success || release.data.draft || release.data.prerelease) return undefined;
    return release.data.tag_name;
  }

  async function check(): Promise<void> {
    let answered = false;
    const everyRelease = isPrerelease(deps.version);
    try {
      const response = await deps.transport.request({
        method: "GET",
        url: everyRelease ? RELEASES_API : LATEST_RELEASE_API,
        headers: { "user-agent": deps.userAgent, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" },
        timeoutMs: 15_000,
      });
      answered = true;
      await storage.write(STATE_KEY, JSON.stringify({ checkedAt: clock.now() }));
      // 404: no release published yet.
      if (response.status === 404) return await deps.publish(null);
      if (response.status !== 200) return;
      const tag = offered(response.body, everyRelease);
      if (tag === undefined) return;
      await deps.publish(tag && isNewerRelease(tag, deps.version) ? { version: tag.replace(/^v/, ""), url: releasePageUrl(tag) } : null);
    } catch {
      // Offline, timed out, or an answer that isn't JSON: no notice this time.
    } finally {
      schedule(answered ? DAY : RETRY_OFFLINE_AFTER);
    }
  }

  return {
    start() {
      if (running) return;
      running = true;
      void lastChecked().then((at) => schedule(Math.max(FIRST_CHECK_AFTER, at === null ? 0 : at + DAY - clock.now())));
    },
    stop() {
      running = false;
      if (timer) clock.clearTimeout(timer);
      timer = null;
    },
  };
}
