// Types for scripts/join-mac-update-info.mjs, so the tests can import it.
export declare const MAC_ARCHS: readonly ["x64", "arm64"];
export declare function listedItems(yml: string): Record<string, { sha512: string; size: number }>;
export declare function joinedUpdateInfo(ymls: Partial<Record<"x64" | "arm64", string>>): string;
export declare function joinMacUpdateInfoIn(folder: string): Promise<void>;
