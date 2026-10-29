// The app's version (the repository's, shared with the desktop) and whether this is a demo build.
import Constants from "expo-constants";

const extra = (Constants.expoConfig?.extra ?? {}) as { version?: string };

export const APP_VERSION: string = extra.version ?? "0.0.0";
/** A demo build: the pretend Edunex and SIX with a made-up student (app.config.ts). */
export const DEMO = process.env.EXPO_PUBLIC_DEMO === "1";
