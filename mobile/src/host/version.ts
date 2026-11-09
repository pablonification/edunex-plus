// The app's version (the repository's, shared with the desktop) and whether this is a demo build.
import Constants from "expo-constants";

const extra = (Constants.expoConfig?.extra ?? {}) as { version?: string; shapes?: string };

export const APP_VERSION: string = extra.version ?? "0.0.0";
/**
 * The stamp of the datasets' schemas this build saves under (scripts/shapes-stamp.js): a dataset saved with it loads
 * without being checked again. None in a dev build, whose code changes under the same stamp: every start checks.
 */
export const SHAPES: string | undefined = __DEV__ ? undefined : extra.shapes;
/** A demo build: the pretend Edunex and SIX with a made-up student (app.config.ts). */
export const DEMO = process.env.EXPO_PUBLIC_DEMO === "1";
/**
 * A QA build for a real Student's account (EXPO_PUBLIC_R3_GUARD=1 when bundling): reads only, never a write to Edunex,
 * SIX or Microsoft (./guard.ts), and the "[session]" lines on Android's log. Unset in the release Students get.
 */
export const R3_GUARD = process.env.EXPO_PUBLIC_R3_GUARD === "1";
