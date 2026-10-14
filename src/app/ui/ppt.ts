// An old PowerPoint presentation (.ppt or .pps, PowerPoint 97–2003) as the
// viewer shows it: each slide's text, its title first, in the order the
// slides are presented. Only the text, no pictures, layout or notes (those are
// in the file, downloaded). The file is a compound file
// (../../core/compound-file.ts): its Current User stream says where the last
// save's UserEditAtom is in the PowerPoint Document stream; following those
// back gives where each saved object is now (the persist directory), among
// them the document, whose slide list gives the slides' order and the text in
// their placeholders. Each slide's own drawing has the text of its other text
// boxes. When that route is broken, the slides are read in the order they're
// in the stream. Loaded on first use, its own chunk. Nothing in it runs, and
// every length is checked against the bytes: a broken or hostile file throws,
// and the viewer offers Download instead.
import { readCompoundFile } from "../../core/compound-file";

/** A slide as the viewer shows it: its title (empty when it has none) and the rest of its text, a paragraph each (line breaks in one as "\n"). */
export interface Slide {
  title: string;
  text: string[];
}

const DOCUMENT = 0x03e8;
const SLIDE = 0x03ee;
const SLIDE_LIST = 0x0ff0;
const SLIDE_PERSIST = 0x03f3;
const TEXT_HEADER = 0x0f9f;
const TEXT_CHARS = 0x0fa0;
const TEXT_BYTES = 0x0fa8;
const CLIENT_TEXTBOX = 0xf00d;
const USER_EDIT = 0x0ff5;
const PERSIST_DIRECTORY = 0x1772;
/** What a text box is, from its TextHeaderAtom: a title, or a centred title (a title slide's). */
const TITLES = new Set([0, 6]);
/** Text in a text box that isn't a placeholder. */
const OTHER = 4;
/** How deep a slide's drawing may nest groups of shapes, and the most slides shown; past that, the file is downloaded instead. */
const MAX_DEPTH = 32;
const MAX_SLIDES = 5000;

/** A record: its type, its instance, whether it holds other records, and where its data is. */
interface Rec {
  type: number;
  instance: number;
  container: boolean;
  start: number;
  end: number;
}

/** A text box's text, by what it is (TextHeaderAtom's type). */
type Text = { type: number; text: string };

class Locked extends Error {}

/**
 * The presentation's slides, in the order they're presented. Throws when it
 * isn't a PowerPoint 97–2003 file it can read: locked with a password, or
 * broken.
 */
export function readPpt(bytes: Uint8Array): Slide[] {
  const file = readCompoundFile(bytes);
  const stream = file.stream("PowerPoint Document");
  if (!stream) throw new Error("Not a PowerPoint presentation");
  if (file.has("EncryptedSummary")) throw new Error("A locked presentation");
  const records = new Records(stream);
  let slides: Text[][];
  try {
    slides = presentedOrder(records, file.stream("Current User"));
  } catch (error) {
    if (error instanceof Locked) throw error;
    slides = streamOrder(records);
  }
  if (!slides.length || slides.length > MAX_SLIDES) throw new Error("No slides to show, or too many");
  return slides.map(toSlide);
}

/** The slides through the persist directory: the document's slide list, each slide's placeholders' text, then its own text boxes'. */
function presentedOrder(records: Records, user: Uint8Array | null): Text[][] {
  // The CurrentUserAtom: a token that says whether the file is locked, then where the last save's UserEditAtom is.
  if (!user || user.length < 20) throw new Error("No current user");
  const current = new DataView(user.buffer, user.byteOffset, user.byteLength);
  if (current.getUint32(12, true) === 0xf3d1c4df) throw new Locked("A locked presentation");
  const offsets = new Map<number, number>();
  let documentRef = 0;
  // Each save's UserEditAtom points to the one before; the newest place of each object wins. Each is read once.
  const seen = new Set<number>();
  const directories = new Set<number>();
  for (let at = current.getUint32(16, true); !seen.has(at); ) {
    seen.add(at);
    const edit = records.at(at, USER_EDIT);
    if (edit.end - edit.start < 28) throw new Error("A broken UserEditAtom");
    if (edit.end - edit.start >= 32 && records.u32(edit.start + 28) !== 0) throw new Locked("A locked presentation");
    documentRef ||= records.u32(edit.start + 16);
    const directory = records.at(records.u32(edit.start + 12), PERSIST_DIRECTORY);
    for (let p = directories.has(directory.start) ? directory.end : directory.start; p + 4 <= directory.end; ) {
      // A run of objects from an id: its first id (20 bits) and how many (12 bits), then where each is.
      const head = records.u32(p);
      const count = head >>> 20;
      if (p + 4 + count * 4 > directory.end) throw new Error("A broken persist directory");
      for (let i = 0; i < count; i++) if (!offsets.has((head & 0xfffff) + i)) offsets.set((head & 0xfffff) + i, records.u32(p + 4 + i * 4));
      p += 4 + count * 4;
    }
    directories.add(directory.start);
    const previous = records.u32(edit.start + 8);
    if (previous === 0) break;
    at = previous;
  }
  const document = records.at(offsets.get(documentRef) ?? -1, DOCUMENT);
  return slideList(records, document).map(({ ref, texts }) => {
    const slide = offsets.has(ref) ? records.at(offsets.get(ref)!, SLIDE) : null;
    return slide ? [...texts, ...drawingTexts(records, slide, texts)] : texts;
  });
}

/** The slides in the order they're in the stream, when the persist route is broken: the document's slide list, with each slide's own text boxes when there are as many of those. */
function streamOrder(records: Records): Text[][] {
  let document: Rec | null = null;
  const slides: Rec[] = [];
  try {
    // One past the most shown is enough to know there are too many.
    for (let at = 0; at + 8 <= records.length && slides.length <= MAX_SLIDES; ) {
      const record = records.at(at);
      if (record.type === DOCUMENT) document = record;
      else if (record.type === SLIDE) slides.push(record);
      at = record.end;
    }
  } catch {
    // Whatever follows a broken record is left out.
  }
  const listed = document ? slideList(records, document).map(({ texts }) => texts) : [];
  if (!listed.length) return slides.map((slide) => drawingTexts(records, slide, []));
  if (listed.length !== slides.length) return listed;
  return listed.map((texts, i) => [...texts, ...drawingTexts(records, slides[i], texts)]);
}

/** The document's slide list (SlideListWithText, instance 0): each slide's persist id and the text of its placeholders, in the slides' order. */
function slideList(records: Records, document: Rec): { ref: number; texts: Text[] }[] {
  const list = records.children(document).find((child) => child.type === SLIDE_LIST && child.instance === 0);
  if (!list) return [];
  const slides: { ref: number; texts: Text[] }[] = [];
  let type = OTHER;
  for (const child of records.children(list)) {
    if (child.type === SLIDE_PERSIST && child.end - child.start >= 4) {
      if (slides.push({ ref: records.u32(child.start), texts: [] }) > MAX_SLIDES) throw new Error("Too many slides");
    } else if (child.type === TEXT_HEADER && child.end - child.start >= 4) type = records.u32(child.start);
    else if ((child.type === TEXT_CHARS || child.type === TEXT_BYTES) && slides.length)
      slides[slides.length - 1].texts.push({ type, text: records.text(child) });
  }
  return slides;
}

/** The text in a slide's own text boxes (OfficeArtClientTextbox), leaving out what its placeholders already said (`known`). */
function drawingTexts(records: Records, slide: Rec, known: Text[]): Text[] {
  const said = new Set(known.map((t) => t.text));
  return records.drawing(slide).filter((t) => !said.has(t.text) && said.add(t.text));
}

/** A slide's texts as its title (the first title among them) and its paragraphs. */
function toSlide(texts: Text[]): Slide {
  const title = texts.find((t) => TITLES.has(t.type));
  const text = texts
    .filter((t) => t !== title)
    .flatMap((t) => t.text.split("\r"))
    .map(clean)
    .filter((line) => line.trim() !== "");
  return { title: title ? clean(title.text.replace(/\r/g, " ")).trim() : "", text };
}

/** A line break in a paragraph (vertical tab) as "\n"; other control characters dropped. */
const clean = (text: string) => text.replace(/\v/g, "\n").replace(/[\u0000-\u0008\u000b-\u001f]/g, "");

/** The PowerPoint Document stream's records: each an 8-byte header (version and instance, type, length), then its data. */
class Records {
  private readonly view: DataView;
  private readonly drawings = new Map<number, Text[]>();
  readonly length: number;

  constructor(private readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.length = bytes.length;
  }

  u32(at: number): number {
    return this.view.getUint32(at, true);
  }

  /** The record at `at`, within `end`; of type `type` when given. Throws when it isn't there, isn't that, or runs past `end`. */
  at(at: number, type?: number, end = this.length): Rec {
    if (!Number.isInteger(at) || at < 0 || at + 8 > end) throw new Error("A record past the end");
    const head = this.view.getUint16(at, true);
    const record = {
      type: this.view.getUint16(at + 2, true),
      instance: head >> 4,
      container: (head & 0xf) === 0xf,
      start: at + 8,
      end: at + 8 + this.u32(at + 4),
    };
    if (record.end > end || (type !== undefined && record.type !== type)) throw new Error("A broken record");
    return record;
  }

  /** The records in a container, in order. */
  children(parent: Rec): Rec[] {
    const found: Rec[] = [];
    for (let at = parent.start; at + 8 <= parent.end; ) {
      const child = this.at(at, undefined, parent.end);
      found.push(child);
      at = child.end;
    }
    return found;
  }

  /** The text boxes in a slide's drawing, read once per slide however many times the slide list names it. */
  drawing(slide: Rec): Text[] {
    const cached = this.drawings.get(slide.start);
    if (cached) return cached;
    const found: Text[] = [];
    const visit = (record: Rec, depth: number) => {
      if (depth > MAX_DEPTH) throw new Error("A drawing nested too deep");
      let type = OTHER;
      for (const child of this.children(record)) {
        if (record.type === CLIENT_TEXTBOX && child.type === TEXT_HEADER && child.end - child.start >= 4) type = this.u32(child.start);
        else if (record.type === CLIENT_TEXTBOX && (child.type === TEXT_CHARS || child.type === TEXT_BYTES)) found.push({ type, text: this.text(child) });
        else if (child.container) visit(child, depth + 1);
      }
    };
    visit(slide, 0);
    this.drawings.set(slide.start, found);
    return found;
  }

  /** A TextCharsAtom's text (UTF-16) or a TextBytesAtom's (a byte per character, Latin-1). */
  text(record: Rec): string {
    let text = "";
    if (record.type === TEXT_BYTES) for (let at = record.start; at < record.end; at++) text += String.fromCharCode(this.bytes[at]);
    else for (let at = record.start; at + 1 < record.end; at += 2) text += String.fromCharCode(this.view.getUint16(at, true));
    return text;
  }
}
