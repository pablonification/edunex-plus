// Types for scripts/package-mac-update.mjs, so the tests can import it.
export declare function updateName(zip: string): string;
export declare function packArgs(app: string, out: string): string[];
export declare function packMacUpdate(zip: string, out: string): Promise<{ sha512: string; size: number }>;
export declare function packMacUpdatesIn(folder: string): Promise<void>;
