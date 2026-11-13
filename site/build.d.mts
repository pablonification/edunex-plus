/** The newest release, as the pages use it. */
export interface Release {
  version: string;
  assets: { name: string; url: string; size?: number }[];
}

/** The site's languages: English at the root, Indonesian under /id. */
export const LANGS: string[];
/** Every page, by its address without the language. */
export const ROUTES: { path: string }[];
/** What the pages need from GitHub's answer for a release, or null when it isn't one. */
export function releaseFrom(json: unknown): Release | null;
/** Every file of the site as text: its path in the output folder, and what it holds. */
export function render(options?: { release?: Release | null; cards?: boolean }): Map<string, string>;
/** Writes the whole site into `out` and returns the pages' paths. */
export function build(options?: { out?: string; release?: Release | null; cards?: boolean }): string[];
