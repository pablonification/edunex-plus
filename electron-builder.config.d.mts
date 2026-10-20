// Types for electron-builder.config.mjs, so the tests can read it.
import type { Configuration } from "electron-builder";

declare const config: Configuration;
export default config;
export declare const WINDOWS_ARM_INSTALLER: string;
export declare const WINDOWS_ARM_UPDATE_INFO: string;
