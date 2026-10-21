// Types for scripts/build-keychain-helper.mjs, so the tests can import it.
export declare const HELPER_SOURCE: string;
export declare const CLANG_ARGS: string[];
export declare function helperCodesignArgs(identity: string, keychain: string, file: string): string[];
export declare function sha256(bytes: Uint8Array | string): string;
