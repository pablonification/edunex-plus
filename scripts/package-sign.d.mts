// Types for scripts/package-sign.mjs, so the tests can import it.
export declare function signingKeychain(env: Record<string, string | undefined>): string | null;
export declare function signingIdentity(listed: string, keychain: string): { hash: string; name: string };
export declare function signingOrder(app: string, code: string[]): string[];
export declare function codesignArgs(identity: string, keychain: string, file: string): string[];
export declare function namesCertificate(designated: string, identifier: string, sha1: string): boolean;
export declare function keychainList(listed: string): string[];
export declare function afterSign(context: unknown): Promise<void>;
