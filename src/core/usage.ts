// Usage data (ADR 0016): what the app counts about how it's used, one day at a time, and sends the
// maintainer's relay once that day is over. Only counts, under names from the app's own code (a
// screen, an action, a feed, a log's area), never anything the app read from Edunex or SIX, never
// what the Student typed, never who they are. The relay checks every day it's sent against this
// same schema (relay/src/usage.ts).
import { z } from "zod";
import { Lang } from "./models/base";

/** A name the app counts under: one of its own (a screen, an action, a feed and how it read), never a value. */
export const USAGE_NAME = /^[a-z][a-zA-Z0-9.-]{0,63}$/;
/** One of the app's names, and never one every object already has ("constructor"), which a count would read wrong. */
export const isUsageName = (name: string): boolean => USAGE_NAME.test(name) && !(name in Object.prototype);
const Name = z.string().refine(isUsageName);

/** Names one day keeps for each kind, and the most one name counts: past them a count stops growing. */
export const USAGE_LIMITS = { names: 200, count: 100_000 } as const;

const Counts = z.record(Name, z.number().int().min(0).max(USAGE_LIMITS.count)).refine((counts) => Object.keys(counts).length <= USAGE_LIMITS.names);

export const UsageKind = z.enum(["screens", "actions", "reads", "errors"]);
export type UsageKind = z.infer<typeof UsageKind>;

export const UsagePlatform = z.enum(["windows", "mac", "linux", "android", "ios"]);
export type UsagePlatform = z.infer<typeof UsagePlatform>;

/** A calendar day as the app counts it: the computer's own day, "2026-11-16". */
export const UsageDayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * One app's one day. `install` is made at random on this computer the first time the app counts
 * anything, and made again when the Student signs out of everything or turns usage data off and on:
 * it says two days came from the same app, never whose it is.
 */
export const UsageDay = z.object({
  usage: z.literal(1),
  install: z.uuid(),
  day: UsageDayKey,
  version: z.string().min(1).max(40),
  platform: UsagePlatform,
  /** The system, as a report names it ("Windows 11 (x64)", "Android 15"). */
  os: z.string().max(80),
  lang: Lang,
  /** Signed in to each system at any time that day. */
  signedIn: z.object({ edunex: z.boolean(), six: z.boolean() }),
  /** Screens opened, by name ("home", "course"). */
  screens: Counts,
  /** What the window asked the engine to do, by action ("tasks.submit", "schedule.export"). */
  actions: Counts,
  /** Each feed's reads, by how they went ("six.bills.ok", "edunex.tasks.VendorChanged"). */
  reads: Counts,
  /** Errors the app logged, by area ("window", "update", "six.bills"). */
  errors: Counts,
});
export type UsageDay = z.infer<typeof UsageDay>;

/**
 * Actions not worth a count: the window asks them by itself, not the Student (its first snapshot,
 * the colors it remembers, its own errors, which go to `errors`), or they're how a screen is counted.
 */
export const UNCOUNTED_ACTIONS: ReadonlySet<string> = new Set(["app.snapshot", "app.ready", "local.set", "report.windowError", "usage.screen"]);

/** A name as the app counts it: its own name when it's one, "other" when it isn't (it never sends a value). */
export const usageName = (name: string): string => (isUsageName(name) ? name : "other");

/** The day `ms` falls on, on this computer's calendar. */
export function usageDayOf(ms: number): string {
  const date = new Date(ms);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}
