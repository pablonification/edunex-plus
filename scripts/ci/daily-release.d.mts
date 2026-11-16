// Types for scripts/ci/daily-release.mjs, so the tests can import it.
export interface Commit {
  sha: string;
  subject: string;
}

export interface DailyFacts {
  event: string;
  paused?: boolean;
  latest: string;
  version: string;
  commits: Commit[];
  ci?: { status: string; conclusion: string | null; html_url: string } | null;
}

export interface DailyRelease {
  go: boolean;
  bump: boolean;
  version: string;
  tag: string;
  reason: string;
}

export declare class DailyRefused extends Error {}
export declare function forStudents(subject: string): boolean;
export declare function numbering(subject: string): boolean;
export declare function dailyRelease(facts: DailyFacts): DailyRelease;
export declare function commitMessage(facts: { latest: string; version: string; commits: Commit[] }): string;
