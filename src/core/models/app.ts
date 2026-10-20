// The app's own news (#82): a newer release on GitHub.
import { z } from "zod";

export const UpdateNotice = z.object({
  /** The release's version, without a leading "v". */
  version: z.string(),
  /** Its GitHub release page. */
  url: z.string().url(),
});
export type UpdateNotice = z.infer<typeof UpdateNotice>;

/**
 * What asking GitHub right away found ("Periksa pembaruan"): a newer release (its notice is out
 * as "app.update"), this version is the latest, no answer to go by (offline, a refusal, an odd
 * answer), or a copy that never asks (development, the demo).
 */
export const UpdateCheckResult = z.enum(["newer", "latest", "unknown", "off"]);
export type UpdateCheckResult = z.infer<typeof UpdateCheckResult>;

export const appDatasets = {
  /** Present only while a newer release exists. */
  "app.update": UpdateNotice,
} as const;

/**
 * Why this copy can't put a new version in place by itself, so "Unduh" opens the release page
 * instead: a development or demo build, a .deb (apt installs it), an app opened from the disk
 * image or from where macOS moved it to check it ("translocated"), a folder the app can't write
 * to, or a release with no file for this computer.
 */
export const UpdateBlock = z.enum(["notPackaged", "deb", "diskImage", "translocated", "readOnly", "noFile"]);
export type UpdateBlock = z.infer<typeof UpdateBlock>;

/** What went wrong with the last download: no connection, a file that isn't the one the release lists, anything else. */
export const UpdateProblem = z.enum(["offline", "mismatch", "failed"]);
export type UpdateProblem = z.infer<typeof UpdateProblem>;

/** Updating from inside the app: whether it can, and how far it got. Lives in main; the window shows it. */
export const UpdateInstall = z.object({
  /** null: this copy can download and install a new version itself. */
  blocked: UpdateBlock.nullable(),
  /** idle: nothing started; ready: downloaded and checked, waiting for the Student to restart. */
  step: z.enum(["idle", "downloading", "ready", "failed"]),
  /** The version being downloaded or downloaded. */
  version: z.string().nullable(),
  /** While downloading: how far, 0–1; null until the size is known. */
  progress: z.number().min(0).max(1).nullable(),
  problem: UpdateProblem.nullable(),
});
export type UpdateInstall = z.infer<typeof UpdateInstall>;
