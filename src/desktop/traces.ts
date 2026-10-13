// "Sign out of everything" leaves nothing behind on this computer: the app's
// own browser storage, the engine's network session, the files from Edunex
// the window showed, and what the first version of the app (v1) kept in the
// same folder, including its sign-in browser profile, which held the Edunex
// session in plain text.

import { promises as fs } from "node:fs";
import path from "node:path";
import { type Session, session } from "electron";
import { FILE_CACHE_FOLDER } from "./file-cache";

const V1_PARTITION = "persist:edunex-auth";
const V1_FILES = ["auth-session.enc", "feed-snapshots", "notifications", "seen-ledger", path.join("Partitions", "edunex-auth")];

export async function removeEveryTrace(options: { userData: string; engineSession: Session }): Promise<void> {
  const v1 = session.fromPartition(V1_PARTITION);
  await Promise.allSettled([
    session.defaultSession.clearStorageData(),
    session.defaultSession.clearCache(),
    options.engineSession.clearStorageData(),
    options.engineSession.clearCache(),
    options.engineSession.clearAuthCache(),
    v1.clearStorageData(),
    v1.clearCache(),
  ]);
  await Promise.allSettled([...V1_FILES, FILE_CACHE_FOLDER].map((name) => fs.rm(path.join(options.userData, name), { recursive: true, force: true })));
}
