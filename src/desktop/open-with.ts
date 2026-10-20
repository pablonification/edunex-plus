// Opening a file the app keeps on this computer in an app the Student picks,
// like an editor's "Open in" menu: the system's own app for that kind of file,
// or another one that says it opens it. macOS lists them through Launch
// Services (a short JavaScript for Automation script: Node has no way in).
// Windows has no such list, so there the system's "Open with" window chooses;
// Linux only has the system's own app. An app is named by its place on this
// computer, and only one from the list for that very file is ever started.
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { shell } from "electron";
import type { OpenApp } from "../core/actions/files";

const run = promisify(execFile);

/** At most this many apps in the menu: the system lists every app that claims the kind, and some claim everything. */
const MOST = 12;

// argv[0]: the file. Prints the system's own app and every app that opens it, with its icon (a small PNG), as JSON.
const LIST_APPS = `
ObjC.import("AppKit");
function icon(workspace, place) {
  const image = workspace.iconForFile(place);
  image.size = $.NSMakeSize(32, 32);
  const rep = $.NSBitmapImageRep.alloc.initWithCGImage(image.CGImageForProposedRectContextHints(null, $(), $()));
  return rep.representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $()).base64EncodedStringWithOptions(0).js;
}
function run(argv) {
  const workspace = $.NSWorkspace.sharedWorkspace;
  const files = $.NSFileManager.defaultManager;
  const url = $.NSURL.fileURLWithPath(argv[0]);
  const own = workspace.URLForApplicationToOpenURL(url);
  const all = workspace.URLsForApplicationsToOpenURL(url);
  const apps = [];
  for (let i = 0; i < all.count; i++) {
    const place = all.objectAtIndex(i).path.js;
    let png = null;
    try {
      png = icon(workspace, place);
    } catch (error) {}
    apps.push({ id: place, name: files.displayNameAtPath(place).js, png });
  }
  return JSON.stringify({ own: own.isNil() ? null : own.path.js, apps });
}`;

export interface AppsForFile {
  /** The system's own app first, then the others by name. */
  apps: OpenApp[];
  /** The system's own app, when known. */
  own: string | null;
  /** The system has its own window to choose another app (Windows). */
  chooser: boolean;
}

/** Asked again after this long: an app installed meanwhile shows up. */
const KEPT_FOR = 60_000;
/** By file extension: every PDF opens in the same apps. */
const asked = new Map<string, { at: number; answer: Promise<AppsForFile> }>();

/** The apps that open `file`; none where the system can't say (an error, Linux). */
export function appsFor(file: string): Promise<AppsForFile> {
  const kind = path.extname(file).toLowerCase();
  const kept = asked.get(kind);
  if (kept && Date.now() - kept.at < KEPT_FOR) return kept.answer;
  const answer = listApps(file);
  asked.set(kind, { at: Date.now(), answer });
  return answer;
}

async function listApps(file: string): Promise<AppsForFile> {
  if (process.platform === "win32") return { apps: [], own: null, chooser: true };
  if (process.platform !== "darwin") return { apps: [], own: null, chooser: false };
  try {
    const { stdout } = await run("/usr/bin/osascript", ["-l", "JavaScript", "-e", LIST_APPS, file], { timeout: 10_000 });
    const listed = JSON.parse(stdout) as { own: string | null; apps: { id: string; name: string; png: string | null }[] };
    // The same app installed twice (an update in another folder) shows once, the system's own copy first.
    const seen = new Set<string>();
    const apps = listed.apps
      .map((found) => ({ id: found.id, name: found.name.replace(/\.app$/i, ""), icon: found.png ? `data:image/png;base64,${found.png}` : null }))
      .sort((a, b) => Number(b.id === listed.own) - Number(a.id === listed.own) || a.name.localeCompare(b.name))
      .filter((found) => !seen.has(found.name) && seen.add(found.name))
      .slice(0, MOST);
    return { apps, own: listed.own, chooser: false };
  } catch {
    return { apps: [], own: null, chooser: false };
  }
}

/**
 * Opens `file`: in `appId` when it's one of the apps listed for it, in the
 * system's own app without one. `choose`: the system's "Open with" window
 * instead (Windows).
 */
export async function openFile(file: string, options: { appId?: string; choose?: boolean } = {}): Promise<void> {
  if (options.choose && process.platform === "win32") {
    await run("rundll32.exe", ["shell32.dll,OpenAs_RunDLL", path.normalize(file)]);
    return;
  }
  if (options.appId && process.platform === "darwin") {
    const { apps } = await appsFor(file);
    if (!apps.some((found) => found.id === options.appId)) throw new Error("That app doesn't open this file");
    await run("/usr/bin/open", ["-a", options.appId, file]);
    return;
  }
  const problem = await shell.openPath(file);
  if (problem) throw new Error(problem);
}
