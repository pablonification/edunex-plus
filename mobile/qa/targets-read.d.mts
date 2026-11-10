// Types for mobile/qa/targets-read.mjs, so the tests can import it.
import type { Dump, DumpNode } from "./dump-lib.mjs";

export declare const TARGET_DP: number;
export interface Target {
  node: DumpNode;
  px: [number, number];
  dp: [number, number];
  cut: boolean;
}
export declare function readTargets(dump: Dump, options?: { density?: number; all?: boolean }): { small: Target[]; unnamed: Target[]; taps: number };
