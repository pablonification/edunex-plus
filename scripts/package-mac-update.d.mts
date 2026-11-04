// Types for scripts/package-mac-update.mjs, so the tests can import it.
export declare function updateName(zip: string): string;
/** xz's compression level: 9 for releases, 1 for builds that publish nothing (--quick). */
export interface PackOptions {
  level?: number;
}
export declare function packArgs(app: string, out: string, options?: PackOptions): string[];
export declare function packMacUpdate(zip: string, out: string, options?: PackOptions): Promise<{ sha512: string; size: number }>;
export declare function packMacUpdatesIn(folder: string, options?: PackOptions): Promise<void>;
