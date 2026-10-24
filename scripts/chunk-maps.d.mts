// Types for scripts/chunk-maps.mjs, so the tests can import it.
import type { ChunkMap } from "../src/desktop/chunks";

export declare function fileMap(file: string): Promise<ChunkMap>;
export declare function appMap(app: string, pack: string): Promise<ChunkMap>;
export declare function withListedFile(yml: string, name: string, file: { sha512: string; size: number }): string;
export declare function chunkMapsIn(folder: string): Promise<void>;
