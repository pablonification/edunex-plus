// EduNex as a source: a Bearer-token session, /login/me as the liveness
// check, and each area's feeds and actions.
import type { Source } from "../source";
import { EdunexClient } from "./client";
import { registerCoursePageFeeds } from "./course-page";
import { registerCoreFeeds } from "./feeds";
import { registerNotificationFeed } from "./notifications";
import { EdunexSession } from "./session";
import { registerTaskFeeds, taskActions } from "./tasks";

export const edunex: Source<EdunexSession> = {
  id: "edunex",
  session: EdunexSession,
  liveness: "edunex.account",
  start(context, session) {
    const client = new EdunexClient(context.transport, session.token, context.userAgent);
    registerCoreFeeds(context, client);
    registerTaskFeeds(context, client);
    registerCoursePageFeeds(context, client);
    registerNotificationFeed(context, client);
  },
  actions: { ...taskActions },
};
