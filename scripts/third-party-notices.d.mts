// Types for scripts/third-party-notices.mjs, so the tests can import it.
export interface OpenSourceEntry {
  name: string;
  version: string | null;
  licence: string;
  source: string | null;
  /** The licence text; Chromium's entry has `file` instead, the page beside the app that holds its licences. */
  text?: string;
  file?: string;
}
export declare const PDFJS_DATA: string[];
export declare function openSourceList(root?: string): OpenSourceEntry[];
export declare function noticesText(list: OpenSourceEntry[]): string;
export declare function unlistedPackages(files: Iterable<string>, list: readonly OpenSourceEntry[]): string[];
