// Types for scripts/package-fuses.mjs, so the tests can import it.
export declare const FUSES: Record<string, boolean>;
export declare function fuseProblems(wire: Record<number, number>): string[];
export declare function verifyFuses(binary: string): Promise<void>;
