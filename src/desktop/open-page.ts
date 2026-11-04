// Where an official page the app links to opens: Edunex's and SIX's in the
// app's own window for each, signed in with the session the app keeps
// (./edunex-window.ts, ./six-window.ts), so the Student lands on the page
// without signing in again. Everything else official (ITB's calendar, an
// online class, a problem report) opens in the system browser. The demo opens
// every page in the browser: its sessions are pretend, and the real sites
// aren't the demo's to sign in to.
import { shell } from "electron";
import { translate } from "../core/strings";
import type { Engine } from "../engine/engine";
import { EdunexSession } from "../engine/sources/edunex/session";
import { type Away, siteOf } from "./away";
import { demo } from "./demo";
import { openEdunexWindow } from "./edunex-window";
import type { DesktopContext } from "./handlers/context";
import { sixWindowOptions } from "./handlers/six";
import { openSixWindow } from "./six-window";

export interface OpenPageContext extends Pick<DesktopContext, "lang" | "packaged"> {
  engine: Pick<Engine, "snapshot" | "session" | "act" | "recheckAttendance">;
  /** Edunex or SIX opened in the browser (the demo): back in the window, their attendance is read again. */
  away: Away | null;
}

/** Opens an official page (the caller checked it is one): Edunex and SIX in their window, the rest in the browser. */
export async function openOfficialPage(context: OpenPageContext, url: string): Promise<void> {
  const site = demo ? null : siteOf(url);
  if (site === "six") return openSixWindow({ url, ...sixWindowOptions(context, "source.six") });
  if (site === "edunex") {
    const saved = EdunexSession.safeParse(context.engine.session("edunex"));
    return openEdunexWindow({
      url,
      token: saved.success ? saved.data.token : null,
      now: Date.now(),
      title: translate(context.lang(), "source.edunex"),
      devTools: !context.packaged,
      onClosed: () => void context.engine.recheckAttendance("edunex").catch(() => undefined),
    });
  }
  await shell.openExternal(url);
  context.away?.opened(url);
}
