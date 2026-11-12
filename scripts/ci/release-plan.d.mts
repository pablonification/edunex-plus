// Types for scripts/ci/release-plan.mjs, so the tests can import it.
export interface ReleaseFacts {
  event: string;
  ref: string;
  sha: string;
  version: string;
  versionBefore?: string | null;
  releaseInput?: boolean;
  published?: boolean;
  tagCommit?: string | null;
}

export interface ReleasePlan {
  build: boolean;
  release: boolean;
  tag: string;
  version: string;
  reason: string;
}

export declare class PlanRefused extends Error {}
export declare function releasePlan(facts: ReleaseFacts): ReleasePlan;
export declare function releaseFacts(
  run: { event: string; ref: string; sha: string; before?: string; releaseInput: boolean; version: string; repo: string },
  get: (path: string) => Promise<{ status: number; body: unknown }>,
): Promise<Required<ReleaseFacts>>;
