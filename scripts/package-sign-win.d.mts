// Types for scripts/package-sign-win.mjs, so the tests can import it.
export type UninstallerStep = { step: "keep" | "swap"; folder: string; list: string };
export declare const PROGRAMS_TO_SIGN: { arm64: string; x64: string };
export declare function isUninstaller(file: string): boolean;
export declare function uninstallerNames(artifactNames: string[], version: string): string[];
export declare function uninstallerStep(env: Record<string, string | undefined>): UninstallerStep | null;
export declare function signatureSize(pe: Buffer): number;
export declare function keepUninstaller(file: string, folder: string, list: string): Promise<void>;
export declare function mustBeSigned(file: string): Promise<void>;
export declare function swapUninstaller(file: string, folder: string, list: string): Promise<void>;
export declare function uninstallerHook(step: UninstallerStep): (configuration: { path: string }) => Promise<void>;
