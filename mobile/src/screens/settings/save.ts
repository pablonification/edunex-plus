// How Settings' parts save and say a failure: a setting goes through the engine (settings.update), and what couldn't
// be done is said on the page, under the top bar (ErrorBanner), never in a snackbar.

import type { Settings } from "../../../../src/core/models";
import type { StringKey } from "../../../../src/core/strings";

/** Says a failure on the page: the error's own words, else `fallback`'s. */
export type Report = (error: unknown, fallback?: StringKey) => void;

/** Saves a change to the settings; a failure goes to the page's banner. */
export type Update = (patch: Partial<Settings>) => void;
