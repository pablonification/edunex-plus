// Types for scripts/update-info.mjs, so the tests can import it.
export declare function listedFiles(yml: string): string[];
export declare function withSignedFiles(yml: string, signed: Record<string, { sha512: string; size?: number }>): string;
export declare function sha512Of(file: string): Promise<string>;
export declare function updateInfoIn(folder: string): Promise<void>;
