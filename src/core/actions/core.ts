// The app's own actions: start-up, sign-in and out, refresh, settings, links (#71).
import { z } from "zod";
import { Settings, SourceId } from "../models";
import { AppSnapshot } from "../snapshot";

export const coreActions = {
  /** Everything saved, for the first render. Never waits on the network. */
  "app.snapshot": { input: z.object({}), output: AppSnapshot },
  /** The first render is on screen: show the window. */
  "app.ready": { input: z.object({}), output: z.object({}) },
  "auth.signIn": { input: z.object({ source: SourceId }), output: z.object({ signedIn: z.boolean() }) },
  /** Without a source: sign out of everything and remove every trace. */
  "auth.signOut": { input: z.object({ source: SourceId.optional() }), output: z.object({}) },
  "sync.refresh": { input: z.object({ source: SourceId.optional() }), output: z.object({}) },
  "settings.update": { input: Settings.partial(), output: Settings },
  /** Opens an official page (Edunex, SIX, ITB, online-class links) in the system browser. Other hosts are refused. */
  "shell.openExternal": { input: z.object({ url: z.string().url() }), output: z.object({}) },
  /** Opens a link a lecturer wrote (a note, a Task, an announcement, a link material) in the system browser: any http or https page, as Edunex opens it. Settings' licences open each project's source page this way too. */
  "shell.openLink": { input: z.object({ url: z.string().url().max(4000) }), output: z.object({}) },
  /**
   * Downloads a file from Edunex (a material, a lecturer's file) through the browser's own download
   * manager, so the OS marks it as downloaded, into Downloads, and opens it.
   */
  "files.download": { input: z.object({ url: z.string().url(), name: z.string().min(1).max(200) }), output: z.object({ path: z.string() }) },
  /** Keeps something the Student entered (course weights, a study plan) on this computer, as a "local.*" dataset. */
  "local.set": { input: z.object({ name: z.string().startsWith("local."), value: z.unknown() }), output: z.object({}) },
} as const;
