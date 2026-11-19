// Types for mobile/scripts/flows-from-inventory.mjs, so the tests can import it.

export declare function phoneText(token: string): string | null;
export declare function pattern(token: string): string;
/** The desktop's inventories, one JSON file per scenario. */
export declare const EXPECTED: string;
/** screens.json: how each phone screen is reached and read. */
export declare const SCREENS: string;
/** One scenario's flows, as each screen's YAML, for the screens it has entries on. */
export declare function flowsFor(inventory: unknown, config: unknown): Map<string, string>;
