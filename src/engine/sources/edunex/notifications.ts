// Edunex's notification feed (GET /notifications/{userId}), read every two to
// three minutes as the new-item signal: ASSIGNMENT (a new Task) and CONTENT
// (a new material). A new ASSIGNMENT also runs the Tasks feed at once, a new
// CONTENT the materials feed (material for today's class is told at once). The
// app only reads it: it never marks anything read and never sends Edunex
// "online", "viewed" or presence signals.
import type { EdunexNotification } from "../../../core/models";
import { EngineError } from "../../errors";
import type { FeedRead } from "../../report/kept-pages";
import type { SourceContext } from "../source";
import type { EdunexClient } from "./client";
import type { EdunexUser } from "./feeds";
import { LoginMe, NotificationFeed } from "./schemas";

const MINUTE = 60_000;
const TYPES = { ASSIGNMENT: "task", CONTENT: "material" } as const;
const COURSE_IN_MESSAGE = / has been added new \w+ in (.+)$/;

export function registerNotificationFeed(context: SourceContext, client: EdunexClient, user: EdunexUser = { id: null }): void {
  // Each run reads and stores through its own view of the two, so the report knows which run got what (FeedSpec.run).
  const noted = (read: FeedRead) => ({ context: context.for(read), client: client.for(read) });

  context.feed({
    name: "edunex.notifications",
    priority: "soon",
    every: 2.5 * MINUTE,
    jitter: 0.5 * MINUTE,
    async run(current, read) {
      const { context, client } = noted(read);
      // The feed is per user id, which only /login/me gives: the account feed's read of it, once per session.
      if (user.id === null) await context.runNow((feed) => feed === "edunex.account");
      user.id ??= (await client.get("/login/me", {}, LoginMe)).id;
      const feed = await client.get(`/notifications/${user.id}`, {}, NotificationFeed);
      if (!current()) return;
      const items = feed.data.notifications.flatMap(toNotification).sort((a, b) => b.at - a.at);
      const previous = context.get("edunex.notifications");
      await context.set("edunex.notifications", items);
      const known = new Set(previous?.map((item) => item.key));
      // A new Task's notification carries its id: one the Tasks already read (they ran just before, on a start) needs no read again.
      const tasks = new Set(context.get("edunex.tasks")?.map((task) => task.id));
      if (previous && items.some((item) => item.type === "task" && !known.has(item.key) && !tasks.has(item.objectId))) {
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
  if (!Number.isInteger(objectId) || Number.isNaN(at))
    throw new EngineError("VendorChanged", `/notifications: ${item.type} item with objectId ${item.objectId}, date ${item.date}`);
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
