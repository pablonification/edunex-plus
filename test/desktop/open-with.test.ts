// Opening a downloaded file in the app the Student picks, on Windows: the
// apps come from the shell's own "Open with" list through Windows PowerShell,
// the system's own app opens the file at once, another starts through the
// shell, and "Pilih aplikasi lain…" opens the system's window over the app's.
// The file and the app reach PowerShell through its environment, never inside
// the script. PowerShell and Electron are stood in for here; on a Windows
// machine the last test runs the real helper.
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const system = vi.hoisted(() => ({
  opened: [] as string[],
  ran: [] as { command: string; args: string[]; options: { env?: Record<string, string>; windowsVerbatimArguments?: boolean } }[],
  listed: "",
  started: [] as { command: string; args: string[]; env: Record<string, string> }[],
  exitCode: 0 as number | null,
  failToStart: false,
}));
vi.mock("electron", () => ({
  shell: {
    openPath: async (file: string) => {
      system.opened.push(file);
      return "";
    },
  },
}));
vi.mock("node:child_process", async (original) => ({
  ...(await original<typeof import("node:child_process")>()),
  execFile: (
    command: string,
    args: string[],
    options: (typeof system.ran)[number]["options"],
    done: (error: Error | null, out?: { stdout: string; stderr: string }) => void,
  ) => {
    system.ran.push({ command, args, options });
    done(null, { stdout: system.listed, stderr: "" });
  },
  spawn: (command: string, args: string[], options: { env: Record<string, string> }) => {
    system.started.push({ command, args, env: options.env });
    const child = new EventEmitter();
    setTimeout(() => (system.failToStart ? child.emit("error", new Error("ENOENT")) : child.emit("exit", system.exitCode)));
    return child;
  },
}));

const real = process.platform;
const FILE = String.raw`C:\Users\Dimas\Downloads\K1. SAP Ekonomi’s Infrastruktur.pdf`;
const EDGE = String.raw`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`;
const ACROBAT = String.raw`C:\Program Files\Adobe\Acrobat DC\Acrobat\Acrobat.exe`;

const load = async () => {
  vi.resetModules();
  return import("../../src/desktop/open-with");
};

beforeEach(() => {
  Object.defineProperty(process, "platform", { value: "win32" });
  Object.assign(system, { opened: [], ran: [], started: [], exitCode: 0, failToStart: false });
  system.listed = JSON.stringify({
    own: EDGE,
    apps: [
      { id: ACROBAT, name: "Adobe Acrobat", png: "iVBOR" },
      { id: EDGE, name: "Microsoft Edge", png: null },
      { id: "AppXd4nrz8ff68srnhf9t5a8sbjyar1cr723", name: "Microsoft Edge", png: null },
    ],
  });
});
afterEach(() => {
  Object.defineProperty(process, "platform", { value: real });
});

describe("the apps that open a file, on Windows", () => {
  it("lists the shell's own, the system's app first, once each, with the system's window to choose another", async () => {
    const { appsFor } = await load();
    expect(await appsFor(FILE)).toEqual({
      own: EDGE,
      apps: [
        { id: EDGE, name: "Microsoft Edge", icon: null },
        { id: ACROBAT, name: "Adobe Acrobat", icon: "data:image/png;base64,iVBOR" },
      ],
      chooser: true,
    });
    const [{ command, args, options }] = system.ran;
    expect(command).toMatch(/\\System32\\WindowsPowerShell\\v1\.0\\powershell\.exe$/);
    expect(args.slice(0, -1)).toEqual(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand"]);
    expect(options.env).toMatchObject({ EDUNEX_OPEN_WITH: "list", EDUNEX_OPEN_FILE: FILE });
    // Asked once for every PDF a while.
    await appsFor(String.raw`C:\Users\Dimas\Documents\Edunex Plus\PL3032\Modul 1.PDF`);
    expect(system.ran).toHaveLength(1);
  });

  it("where Windows can't say, still offers the system's window", async () => {
    system.listed = "Add-Type : Cannot add type.";
    const { appsFor } = await load();
    expect(await appsFor(FILE)).toEqual({ apps: [], own: null, chooser: true });
  });

  it("the helper is the same for every file, and fits a Windows command line", async () => {
    const { WINDOWS_HELPER_COMMAND } = await load();
    const script = Buffer.from(WINDOWS_HELPER_COMMAND, "base64").toString("utf16le");
    expect(script).toContain("SHAssocEnumHandlers");
    expect(script).not.toContain("Dimas");
    // The here-string's end has to start its line, and PowerShell reads the script as ASCII.
    expect(script).toMatch(/\n'@\n/);
    expect(script).toMatch(/^[\t\n\x20-\x7e]*$/);
    const powershell = String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand `;
    expect(powershell.length + WINDOWS_HELPER_COMMAND.length).toBeLessThan(32_767);
  });
});

describe("opening it, on Windows", () => {
  it("in the system's own app, at once, as a double-click does", async () => {
    const { openFile } = await load();
    await openFile(FILE, { appId: EDGE });
    expect(system.opened).toEqual([FILE]);
    expect(system.started).toEqual([]);
  });

  it("in another app from the list, through the shell", async () => {
    const { openFile } = await load();
    await openFile(FILE, { appId: ACROBAT });
    expect(system.opened).toEqual([]);
    expect(system.started).toHaveLength(1);
    expect(system.started[0].env).toMatchObject({ EDUNEX_OPEN_WITH: "open", EDUNEX_OPEN_FILE: FILE, EDUNEX_OPEN_APP: ACROBAT });
  });

  it("never in an app that isn't in the list for it", async () => {
    const { openFile } = await load();
    await expect(openFile(FILE, { appId: String.raw`C:\Users\Dimas\Downloads\setup.exe` })).rejects.toThrow();
    expect(system.opened).toEqual([]);
    expect(system.started).toEqual([]);
  });

  it("says so when the app couldn't be started", async () => {
    system.exitCode = 1;
    const { openFile } = await load();
    await expect(openFile(FILE, { appId: ACROBAT })).rejects.toThrow();
  });

  it("in the app chosen in the system's window, over the app's own", async () => {
    const { openFile } = await load();
    const owner = Buffer.alloc(8);
    owner.writeBigUInt64LE(0x1a2b3cn);
    await openFile(FILE, { choose: true, owner });
    expect(system.started[0].env).toMatchObject({ EDUNEX_OPEN_WITH: "choose", EDUNEX_OPEN_FILE: FILE, EDUNEX_OPEN_OWNER: String(0x1a2b3c) });
    expect(system.ran).toEqual([]);
  });

  it("without PowerShell, the system's window the older way, the path unquoted as it wants it", async () => {
    system.failToStart = true;
    const { openFile } = await load();
    await openFile(FILE, { choose: true });
    expect(system.ran).toEqual([
      {
        command: String.raw`C:\Windows\System32\rundll32.exe`,
        args: [`shell32.dll,OpenAs_RunDLL ${FILE}`],
        options: { windowsVerbatimArguments: true },
      },
    ]);
  });
});

// The real helper, on a Windows machine: Notepad opens text files on every one.
describe.runIf(real === "win32")("the helper on this Windows machine", () => {
  it("lists Notepad for a text file", async () => {
    vi.doUnmock("node:child_process");
    const { appsFor } = await load();
    const { apps } = await appsFor("C:\\Windows\\win.ini");
    expect(apps.map((app) => app.name)).toContain("Notepad");
  });
});
