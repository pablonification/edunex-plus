// The open-source software the Android app is built on, each with its licence: the list
// scripts/third-party-notices.mjs writes into licences.json before a build (what Metro bundles,
// what the app carries natively). The phone's loadLicences (src/app/licences.ts reads a file next
// to the desktop's window): the list is in the app itself, read only when the Student opens it.
import { z } from "zod";
import { Licence } from "../../../../src/app/licences";

export async function loadLicences(): Promise<Licence[]> {
  // Required here, not at the top: the list is parsed only when the page opens, never with the app.
  return z.array(Licence).parse(require("../../../licences.json"));
}
