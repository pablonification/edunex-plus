// Types for mobile/qa/layout-read.mjs, so the tests can import it.
import type { Dump } from "./dump-lib.mjs";

export declare const TABS: string[];
export declare const BLOCKS: string[];
export declare const MIN_TAPS: number;
export declare const MAX_WORDS: number;
export declare const MAX_TILES: number;
export interface LayoutRow {
  key: string;
  ok: boolean;
  value: string;
  detail: string[];
}
export interface Layout {
  ok: boolean;
  screen: [number, number];
  tabbarTop: number;
  format: "xml" | "maestro";
  tabs: string[];
  avatar: string[];
  blocks: Record<string, { bounds: [number, number, number, number] } | null>;
  taps: { id: string; name: string }[];
  tapsNested: string[];
  words: number;
  wordList: { text: string; words: number }[];
  grid: { id: string; label: string }[];
  stripZeros: number;
  rows: LayoutRow[];
}
export declare function readLayout(dump: Dump, options?: { screen?: [number, number]; tabbarTop?: number; countNested?: boolean }): Layout;
