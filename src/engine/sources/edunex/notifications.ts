// Edunex's notification feed (GET /notifications/{userId}), read every two to
// three minutes as the new-item signal: ASSIGNMENT (a new Task) and CONTENT
// (a new material). A new ASSIGNMENT also runs the Tasks feed at once, a new
// CONTENT the materials feed (material for today's class is told at once). The
// app only reads it: it never marks anything read and never sends Edunex
// "online", "viewed" or presence signals.
import type { EdunexNotification } from "../../../core/models";
import { EngineError } from "../../errors";
import type { SourceContext } from "../source";
import type { EdunexClient } from "./client";
import { LoginMe, NotificationFeed } from "./schemas";

const MINUTE = 60_000;
const TYPES = { ASSIGNMENT: "task", CONTENT: "material" } as const;
const COURSE_IN_MESSAGE = / has been added new \w+ in (.+)$/;

export function registerNotificationFeed(context: SourceContext, client: EdunexClient): void {
  // The feed is per user id, which only /login/me gives; asked once per session.
  let userId: number | null = null;
  context.feed({
    name: "edunex.notifications",
    every: 2.5 * MINUTE,
    jitter: 0.5 * MINUTE,
    async run(current) {
      userId ??= (await client.get("/login/me", {}, LoginMe)).id;
      const feed = await client.get(`/notifications/${userId}`, {}, NotificationFeed);
      if (!current()) return;
      const items = feed.data.notifications.flatMap(toNotification).sort((a, b) => b.at - a.at);
      const previous = context.get("edunex.notifications");
      await context.set("edunex.notifications", items);
      const known = new Set(previous?.map((item) => item.key));
      if (previous && items.some((item) => item.type === "task" && !known.has(item.key))) {
        await context.runNow((feed) => feed.startsWith("edunex.tasks"));
      }
      if (previous && items.some((item) => item.type === "material" && !known.has(item.key))) {
        await context.runNow((feed) => feed === "edunex.materials");
      }
    },
  });
}

/** Types the app doesn't use (MESSAGE, COMMON, …) are skipped; a known type with a broken field is a vendor change. */
function toNotification(item: { type: string; title: string; objectId: string | number; date: string; message?: string | null }): EdunexNotification[] {
  const type = TYPES[item.type as keyof typeof TYPES];
  if (!type) return [];
  const objectId = Number(item.objectId);
  // Notification dates are real UTC ("2026-09-15T03:54:44.000Z").
  const at = Date.parse(item.date);
  if (!Number.isInteger(objectId) || Number.isNaN(at)) throw new EngineError("VendorChanged", `/notifications: ${item.type} item with objectId ${item.objectId}, date ${item.date}`);
  return [
    {
      key: `${item.type}:${objectId}:${item.date}`,
      type,
      objectId,
      title: item.title.trim(),
      courseName: COURSE_IN_MESSAGE.exec(item.message ?? "")?.[1]?.trim() ?? null,
      at,
    },
  ];
}
