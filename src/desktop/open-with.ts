// Opening a file the app keeps on this computer in an app the Student picks,
// like an editor's "Open in" menu: the system's own app for that kind of file,
// or another one that says it opens it. macOS lists them through Launch
// Services (a short JavaScript for Automation script: Node has no way in);
// Windows through the shell's own "Open with" list (a short C# helper run by
// Windows PowerShell), which also has its window to choose any other app.
// Linux only has the system's own app. An app is named by its place on this
// computer (on Windows, the name the shell gives it), and only one from the
// list for that very file is ever started.
import { execFile, spawn } from "node:child_process";
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

/**
 * Windows: the apps Explorer's "Open with" menu lists for the file's kind
 * (SHAssocEnumHandlers), the one a double-click uses, starting one of them
 * on the file the way that menu does, and the system's "Open with" window.
 * C# 5, as Windows PowerShell 5.1 compiles it. The file, the app and the
 * window come in through the environment, never inside the script. Prints
 * JSON in plain ASCII, whatever the console's code page.
 */
const WINDOWS_HELPER = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

namespace EdunexPlus {
  [ComImport, Guid("F04061AC-1659-4a3f-A954-775AA57FC083"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface IAssocHandler {
    [PreserveSig] int GetName([MarshalAs(UnmanagedType.LPWStr)] out string name);
    [PreserveSig] int GetUIName([MarshalAs(UnmanagedType.LPWStr)] out string name);
    [PreserveSig] int GetIconLocation([MarshalAs(UnmanagedType.LPWStr)] out string place, out int index);
    [PreserveSig] int IsRecommended();
    [PreserveSig] int MakeDefault([MarshalAs(UnmanagedType.LPWStr)] string description);
    [PreserveSig] int Invoke(IntPtr data);
  }

  [ComImport, Guid("973810ae-9599-4b88-9e4d-6ee98c9552da"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface IEnumAssocHandlers {
    [PreserveSig] int Next(int count, [Out, MarshalAs(UnmanagedType.LPArray, SizeParamIndex = 0)] IAssocHandler[] handlers, out int fetched);
  }

  [ComImport, Guid("43826d1e-e718-42ee-bc55-a1e261c37bfe"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface IShellItem {
    [PreserveSig] int BindToHandler(IntPtr context, ref Guid handler, ref Guid id, out IntPtr result);
  }

  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct OpenAsInfo {
    public string File;
    public string Class;
    public int Flags;
  }

  public static class OpenWith {
    [DllImport("shell32.dll", CharSet = CharSet.Unicode)] static extern int SHAssocEnumHandlers(string kind, int filter, out IEnumAssocHandlers handlers);
    [DllImport("shell32.dll", CharSet = CharSet.Unicode)] static extern int SHCreateItemFromParsingName(string file, IntPtr context, ref Guid id, out IShellItem item);
    [DllImport("shell32.dll", CharSet = CharSet.Unicode)] static extern int SHOpenWithDialog(IntPtr owner, ref OpenAsInfo info);
    [DllImport("shell32.dll", CharSet = CharSet.Unicode)] static extern int ExtractIconEx(string file, int index, IntPtr[] large, IntPtr[] small, int count);
    [DllImport("user32.dll")] static extern bool DestroyIcon(IntPtr icon);
    [DllImport("shlwapi.dll", CharSet = CharSet.Unicode)] static extern int AssocQueryString(int flags, int what, string kind, string verb, StringBuilder result, ref int size);
    [DllImport("shlwapi.dll", CharSet = CharSet.Unicode)] static extern int SHLoadIndirectString(string source, StringBuilder result, int size, IntPtr reserved);

    // The recommended apps (ASSOC_FILTER_RECOMMENDED), by the name the shell gives each.
    static List<KeyValuePair<string, IAssocHandler>> Handlers(string kind) {
      var found = new List<KeyValuePair<string, IAssocHandler>>();
      IEnumAssocHandlers all;
      if (string.IsNullOrEmpty(kind) || SHAssocEnumHandlers(kind, 1, out all) != 0 || all == null) return found;
      var one = new IAssocHandler[1];
      // Not HashSet: it's in System.Core, which Add-Type doesn't reference.
      var seen = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);
      int fetched;
      for (int i = 0; i < 64 && all.Next(1, one, out fetched) == 0 && fetched == 1; i++) {
        string id;
        if (one[0].GetName(out id) != 0 || string.IsNullOrEmpty(id) || seen.ContainsKey(id)) continue;
        seen[id] = true;
        found.Add(new KeyValuePair<string, IAssocHandler>(id, one[0]));
      }
      return found;
    }

    public static string List(string file) {
      string kind = Path.GetExtension(file);
      // What a double-click uses: its program (ASSOCSTR_EXECUTABLE), else its name (ASSOCSTR_FRIENDLYAPPNAME) for an app from the Store.
      string program = Query(2, kind), friendly = Query(4, kind);
      string own = null, ownByName = null;
      var json = new StringBuilder("{\"apps\":[");
      int count = 0;
      foreach (var found in Handlers(kind)) {
        string name;
        if (found.Value.GetUIName(out name) != 0 || string.IsNullOrEmpty(name)) continue;
        if (program != null && Same(found.Key, program)) own = found.Key;
        if (ownByName == null && string.Equals(name, friendly, StringComparison.OrdinalIgnoreCase)) ownByName = found.Key;
        if (count++ > 0) json.Append(',');
        json.Append("{\"id\":").Append(Text(found.Key)).Append(",\"name\":").Append(Text(name)).Append(",\"png\":").Append(Text(Picture(found.Value))).Append('}');
      }
      return json.Append("],\"own\":").Append(Text(own ?? ownByName)).Append('}').ToString();
    }

    public static void Open(string file, string id) {
      IAssocHandler handler = null;
      foreach (var found in Handlers(Path.GetExtension(file))) if (found.Key == id) handler = found.Value;
      if (handler == null) throw new ArgumentException("That app doesn't open this file");
      Guid item = typeof(IShellItem).GUID, bind = new Guid("B8C0BD9F-ED24-455c-83E6-D5390C4FE8C4"), data = new Guid("0000010e-0000-0000-C000-000000000046");
      IShellItem shellItem;
      IntPtr dataObject;
      Check(SHCreateItemFromParsingName(file, IntPtr.Zero, ref item, out shellItem));
      Check(shellItem.BindToHandler(IntPtr.Zero, ref bind, ref data, out dataObject));
      try {
        Check(handler.Invoke(dataObject));
      } finally {
        Marshal.Release(dataObject);
      }
      // The shell may finish starting the app after Invoke returns: this process stays a moment so it can.
      Thread.Sleep(1000);
    }

    // OAIF_ALLOW_REGISTRATION | OAIF_EXEC: opens the file in the app chosen. Closed without one (ERROR_CANCELLED) isn't a failure.
    public static void Choose(string file, long owner) {
      var info = new OpenAsInfo { File = file, Flags = 0x5 };
      int result = SHOpenWithDialog(new IntPtr(owner), ref info);
      if (result != unchecked((int)0x800704C7)) Check(result);
    }

    static string Query(int what, string kind) {
      int size = 1024;
      var result = new StringBuilder(size);
      // ASSOCF_INIT_IGNOREUNKNOWN: nothing for a kind no app claims.
      return AssocQueryString(0x400, what, kind, null, result, ref size) == 0 ? result.ToString() : null;
    }

    static bool Same(string a, string b) {
      return string.Equals(Environment.ExpandEnvironmentVariables(a.Trim('"')), Environment.ExpandEnvironmentVariables(b.Trim('"')), StringComparison.OrdinalIgnoreCase);
    }

    // The app's icon as a 32 px PNG, in base64; null where it has none to give.
    static string Picture(IAssocHandler handler) {
      try {
        string place;
        int index;
        if (handler.GetIconLocation(out place, out index) != 0 || string.IsNullOrEmpty(place)) return null;
        Bitmap picture;
        if (place.StartsWith("@")) {
          // An app from the Store names a picture in its package: "@{Package?ms-resource://...}".
          var resolved = new StringBuilder(1024);
          if (SHLoadIndirectString(place, resolved, resolved.Capacity, IntPtr.Zero) != 0) return null;
          using (var image = Image.FromFile(resolved.ToString())) picture = new Bitmap(image, 32, 32);
        } else {
          var large = new IntPtr[1];
          if (ExtractIconEx(Environment.ExpandEnvironmentVariables(place.Trim('"')), index, large, null, 1) < 1 || large[0] == IntPtr.Zero) return null;
          try {
            using (var icon = Icon.FromHandle(large[0])) picture = icon.ToBitmap();
          } finally {
            DestroyIcon(large[0]);
          }
        }
        using (picture)
        using (var png = new MemoryStream()) {
          picture.Save(png, ImageFormat.Png);
          return Convert.ToBase64String(png.ToArray());
        }
      } catch {
        return null;
      }
    }

    static string Text(string value) {
      if (value == null) return "null";
      var json = new StringBuilder("\"");
      foreach (char c in value) {
        if (c == '"' || c == '\\') json.Append('\\').Append(c);
        else if (c < ' ' || c > '~') json.Append("\\u").Append(((int)c).ToString("x4"));
        else json.Append(c);
      }
      return json.Append('"').ToString();
    }

    static void Check(int result) {
      if (result < 0) Marshal.ThrowExceptionForHR(result);
    }
  }
}
'@
switch ($env:EDUNEX_OPEN_WITH) {
  'list' { [Console]::Out.Write([EdunexPlus.OpenWith]::List($env:EDUNEX_OPEN_FILE)) }
  'open' { [EdunexPlus.OpenWith]::Open($env:EDUNEX_OPEN_FILE, $env:EDUNEX_OPEN_APP) }
  'choose' { [EdunexPlus.OpenWith]::Choose($env:EDUNEX_OPEN_FILE, [long]$env:EDUNEX_OPEN_OWNER) }
}
`;

/** Windows PowerShell 5.1, which every Windows 10 and 11 has, by its own place: never one a PATH could put first. */
const powershellPath = () =>
  path.win32.join(process.env.SystemRoot || process.env.windir || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");

/** The helper as PowerShell's -EncodedCommand takes it: UTF-16LE, in base64, without its indents (a Windows command line holds 32,767 characters). */
export const WINDOWS_HELPER_COMMAND = Buffer.from(WINDOWS_HELPER.replace(/^ +/gm, ""), "utf16le").toString("base64");

/** Runs the Windows helper: what to do, and on which file, through its environment. */
function windowsHelper(what: "list" | "open" | "choose", file: string, extra: Record<string, string> = {}) {
  // Apps it starts inherit this: Electron's own switch would start an Electron app as plain Node.
  const { ELECTRON_RUN_AS_NODE: _runAsNode, ...env } = process.env;
  return {
    command: powershellPath(),
    args: ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", WINDOWS_HELPER_COMMAND],
    options: { env: { ...env, EDUNEX_OPEN_WITH: what, EDUNEX_OPEN_FILE: file, ...extra }, windowsHide: true },
  };
}

/**
 * Starts the helper to open the file and waits for it to finish, without
 * holding on to its output: an app it starts could keep that open for as long
 * as it runs.
 */
function startOnWindows(what: "open" | "choose", file: string, extra: Record<string, string> = {}): Promise<void> {
  const helper = windowsHelper(what, file, extra);
  return new Promise((resolve, reject) => {
    const child = spawn(helper.command, helper.args, { ...helper.options, stdio: "ignore" });
    child.once("error", reject);
    child.once("exit", (code) => (code === 0 ? resolve() : reject(new Error(`Couldn't open the file (${code})`))));
  });
}

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

interface Listed {
  own: string | null;
  apps: { id: string; name: string; png: string | null }[];
}

async function listApps(file: string): Promise<AppsForFile> {
  if (process.platform !== "darwin" && process.platform !== "win32") return { apps: [], own: null, chooser: false };
  // Windows always has its "Open with" window, even when the list can't be had.
  const chooser = process.platform === "win32";
  try {
    return { ...appsFrom(await listed(file)), chooser };
  } catch {
    return { apps: [], own: null, chooser };
  }
}

async function listed(file: string): Promise<Listed> {
  if (process.platform === "darwin") {
    const { stdout } = await run("/usr/bin/osascript", ["-l", "JavaScript", "-e", LIST_APPS, file], { timeout: 10_000 });
    return JSON.parse(stdout);
  }
  const helper = windowsHelper("list", file);
  // PowerShell compiles the helper first: a second or two on a slow laptop.
  const { stdout } = await run(helper.command, helper.args, { ...helper.options, timeout: 20_000, maxBuffer: 4 * 1024 * 1024 });
  return JSON.parse(stdout);
}

/** The system's own app first, then the others by name; the same app installed twice (an update in another folder) shows once. */
function appsFrom(listed: Listed): Pick<AppsForFile, "apps" | "own"> {
  const seen = new Set<string>();
  const apps = listed.apps
    .map((found) => ({ id: found.id, name: found.name.replace(/\.app$/i, ""), icon: found.png ? `data:image/png;base64,${found.png}` : null }))
    .sort((a, b) => Number(b.id === listed.own) - Number(a.id === listed.own) || a.name.localeCompare(b.name))
    .filter((found) => !seen.has(found.name) && seen.add(found.name))
    .slice(0, MOST);
  return { apps, own: listed.own };
}

/** A window's handle as the helper reads it: the number in `getNativeWindowHandle()`. */
const handleOf = (owner: Buffer | undefined) => (!owner ? "0" : owner.length >= 8 ? owner.readBigUInt64LE(0).toString() : owner.readUInt32LE(0).toString());

/**
 * Opens `file`: in `appId` when it's one of the apps listed for it, in the
 * system's own app without one. `choose`: the system's "Open with" window
 * instead (Windows), over `owner`, the app's window.
 */
export async function openFile(file: string, options: { appId?: string; choose?: boolean; owner?: Buffer } = {}): Promise<void> {
  if (options.choose && process.platform === "win32") {
    await startOnWindows("choose", file, { EDUNEX_OPEN_OWNER: handleOf(options.owner) }).catch(() =>
      // Without PowerShell (a school laptop can block it): the older way to the same window. The path goes
      // as it is, unquoted: OpenAs_RunDLL takes the rest of the line as the file and doesn't strip quotes.
      run(path.win32.join(process.env.SystemRoot || "C:\\Windows", "System32", "rundll32.exe"), [`shell32.dll,OpenAs_RunDLL ${path.normalize(file)}`], {
        windowsVerbatimArguments: true,
      }),
    );
    return;
  }
  if (options.appId) {
    const { apps, own } = await appsFor(file);
    if (!apps.some((found) => found.id === options.appId)) throw new Error("That app doesn't open this file");
    if (process.platform === "darwin") {
      await run("/usr/bin/open", ["-a", options.appId, file]);
      return;
    }
    // Windows: the system's own app opens it as a double-click does, at once; another as Explorer's "Open with" menu starts it.
    if (process.platform === "win32" && options.appId !== own) {
      await startOnWindows("open", file, { EDUNEX_OPEN_APP: options.appId });
      return;
    }
  }
  const problem = await shell.openPath(file);
  if (problem) throw new Error(problem);
}
