// Edunex as a source: a Bearer-token session, /login/me as the liveness
// check, and each area's feeds and actions.
import type { Source } from "../source";
import { EdunexClient, edunexLine } from "./client";
import { registerCoursePageFeeds } from "./course-page";
import { type EdunexUser, registerCoreFeeds } from "./feeds";
import { registerNotificationFeed } from "./notifications";
import { EdunexSession } from "./session";
import { registerThreadFeed } from "./task-threads";
import { registerTaskFeeds, taskActions } from "./tasks";

export const edunex: Source<EdunexSession> = {
  id: "edunex",
  session: EdunexSession,
  liveness: "edunex.account",
  start(context, session) {
    // Every read of Edunex's API waits in one line, two at a time.
    const client = new EdunexClient(context.transport, session.token, context.userAgent, edunexLine(context));
    // Who is signed in, read once by the account feed for the notification feed too.
    const user: EdunexUser = { id: null };
    registerCoreFeeds(context, client, user);
    registerTaskFeeds(context, client);
    registerThreadFeed(context, client);
    registerCoursePageFeeds(context, client);
    registerNotificationFeed(context, client, user);
  },
  actions: { ...taskActions },
};
