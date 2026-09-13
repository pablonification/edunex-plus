/**
 * Feed contracts shared by the main process, preload bridge, and renderer.
 * The cache deliberately keeps `data` as the vendor's raw JSON shape: the
 * API has more than one response convention, and a snapshot is also the
 * future diff baseline.
 */

export const FEED_KEYS = ["todo", "courses", "exams", "agenda"] as const;

export type FeedKey = (typeof FEED_KEYS)[number];

export interface FeedSnapshot<T = unknown> {
  feed: FeedKey;
  accountId: string;
  fetchedAt: string;
  data: T;
}
export function isFeedKey(value: unknown): value is FeedKey {
  return typeof value === "string" && (FEED_KEYS as readonly string[]).includes(value);
}
