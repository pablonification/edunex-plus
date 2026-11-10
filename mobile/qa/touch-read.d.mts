// Types for mobile/qa/touch-read.mjs, so the tests can import it.
import type { Dump, DumpNode } from "./dump-lib.mjs";

export declare function whereOn(node: DumpNode, width: number, height: number): string;
export declare function readTouch(
  dump: Dump,
  options?: { density?: number },
): { findings: { line: string; small: boolean; unnamed: boolean }[]; notes: string[]; taps: number };
