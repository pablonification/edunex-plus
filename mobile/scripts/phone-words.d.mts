// Types for mobile/scripts/phone-words.mjs, so the tests can import it.
import type { Entry } from "../../src/core/strings/entry";

export interface PhoneWordPair {
  key: string;
  desktop: string;
  phone: string;
}

export declare const PHONE_WORDS: string;
export declare function phoneWordPairs(strings: Record<string, Entry>, phoneWording: Partial<Record<string, Entry>>): PhoneWordPair[];
