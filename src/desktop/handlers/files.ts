// Bridge handler for reading a file from Edunex's storage into the window
// (pictures in lecturers' notes). The rules live in ../remote-files.ts.
import { readRemoteFile } from "../remote-files";
import type { HandlerGroup } from "./context";

export const filesHandlers: HandlerGroup<"files.read"> = (context) => ({
  "files.read": ({ url, as }) => readRemoteFile(context.fetchFile, url, as),
});
