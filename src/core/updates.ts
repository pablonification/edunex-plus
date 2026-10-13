// "New version available": the app's releases on GitHub and how a release's
// tag compares with the running version (semantic versioning, so 1.10.0 is
// newer than 1.9.0 and 2.0.0-beta.1 is older than 2.0.0).

export const RELEASES_REPO = "pablonification/edunex-plus";
export const LATEST_RELEASE_API = `https://api.github.com/repos/${RELEASES_REPO}/releases/latest`;
/** Every release, pre-releases (alphas, betas) included, newest first. */
export const RELEASES_API = `https://api.github.com/repos/${RELEASES_REPO}/releases?per_page=30`;

/** The release page for a tag; the app opens only pages it built itself. */
export function releasePageUrl(tag: string): string {
  return `https://github.com/${RELEASES_REPO}/releases/tag/${encodeURIComponent(tag)}`;
}

interface Version {
  core: [number, number, number];
  pre: string[];
}

/** "v1.2.3", "1.2.3-beta.1+build" → its parts; anything else → null. */
export function parseVersion(text: string): Version | null {
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z.-]+)?$/.exec(text.trim());
  if (!match) return null;
  return { core: [Number(match[1]), Number(match[2]), Number(match[3])], pre: match[4] ? match[4].split(".") : [] };
}

/** Negative when a is older than b, positive when newer, 0 when the same. */
export function compareVersions(a: Version, b: Version): number {
  for (let i = 0; i < 3; i++) if (a.core[i] !== b.core[i]) return a.core[i] - b.core[i];
  // A pre-release comes before its release.
  if (!a.pre.length || !b.pre.length) return b.pre.length - a.pre.length;
  for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i++) {
    const x = a.pre[i];
    const y = b.pre[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x === y) continue;
    const xn = /^\d+$/.test(x);
    const yn = /^\d+$/.test(y);
    if (xn && yn) return Number(x) - Number(y);
    if (xn !== yn) return xn ? -1 : 1;
    return x < y ? -1 : 1;
  }
  return 0;
}

/** "0.1.0-alpha.1" is a pre-release: such a copy also hears about newer alphas and betas. */
export function isPrerelease(version: string): boolean {
  return (parseVersion(version)?.pre.length ?? 0) > 0;
}

/** The newest tag of the ones given; tags that aren't versions are skipped. */
export function newestTag(tags: string[]): string | null {
  let newest: { tag: string; version: Version } | null = null;
  for (const tag of tags) {
    const version = parseVersion(tag);
    if (version && (!newest || compareVersions(version, newest.version) > 0)) newest = { tag, version };
  }
  return newest?.tag ?? null;
}

/** Whether a release tag is newer than the running version. Tags that aren't versions never are. */
export function isNewerRelease(tag: string, current: string): boolean {
  const release = parseVersion(tag);
  const running = parseVersion(current);
  return !!release && !!running && compareVersions(release, running) > 0;
}
