// docx-preview (Apache-2.0) behind the Word viewer: a .docx drawn as HTML
// pages, loaded only when one is first opened, as its own chunk. It builds
// elements, never parses the document as HTML, and here leaves out the one
// part that would (an "alt chunk", a web page inside the document, shown in a
// frame). Pictures and fonts come as data: addresses, which the window's
// content policy allows; the viewer (./file-viewer.tsx) puts it all in a
// shadow root, so the document's styles never reach the app.
import { parseAsync, renderDocument } from "docx-preview";

const OPTIONS = {
  // A web page inside the document would be shown in a frame: it's left out.
  renderAltChunks: false,
  // Pictures and fonts as data: addresses (blob: ones would need freeing, and fonts may only come as data:).
  useBase64URL: true,
  // Tracked changes and comments aren't what a Student reads the file for.
  renderChanges: false,
  renderComments: false,
  ignoreLastRenderedPageBreak: true,
  experimental: false,
};

/** The document's pages and styles, ready to be put in the viewer. Throws when it isn't a Word document it can read. */
export async function drawDocx(bytes: Uint8Array): Promise<Node[]> {
  return renderDocument(await parseAsync(bytes, OPTIONS), OPTIONS);
}
