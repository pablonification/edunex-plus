// Types for scripts/package-dmg.mjs, so the tests can import it.
export declare function convertArgs(from: string, to: string): string[];
export declare function artifactBuildCompleted(event: { file: string }): Promise<void>;
