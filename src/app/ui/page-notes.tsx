// The Student's notes in the file viewers ("Catatan halaman"), what the PDF
// viewer (./pdf-viewer.tsx) and the one for Word documents and text files
// (./file-viewer.tsx) share: "Catatanku" in the toolbar, which opens a panel
// beside the file with the note on the page being read (a PDF's; a Word
// document or text file has one note for the whole file), saved as the
// Student types, with Hapus (and Urungkan in its toast) and the file's notes
// on other pages, each a way to its page; and the mark on a PDF page that has
// one, which opens the panel there. Escape in the note gives the keyboard back
// to the file (the viewer does that). The caller saves them (../highlights.ts),
// kept with the file's highlights by its content.
import { NotePencilIcon } from "@phosphor-icons/react/dist/csr/NotePencil";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { noteOn } from "../../core/highlights";
import { MAX_NOTE, type PageNote } from "../../core/models";
import { useT } from "../i18n";
import { Button, IconButton } from "./controls";
import { cx } from "./cx";
import { Icons, icon } from "./icons";
import { Tooltip, toast } from "./overlays";

const NoteIcon = icon(NotePencilIcon);
const DeleteIcon = icon(TrashIcon);

/** One file's notes and the ways to change them; saved by the caller. `page` none: the note on the whole file. */
export interface PageNotes {
  items: readonly PageNote[];
  set(page: number | undefined, text: string): void;
  remove(page: number | undefined): void;
  restore(note: PageNote): void;
}

/** What a viewer's element carries when it's the notes panel: Escape there gives the keyboard back to the file. */
export const NOTES_AREA = "[data-page-notes]";

/** Whether the panel was open last: the next file opens with it the same way, for as long as the app runs. */
let wasOpen = false;

/**
 * The panel's state in a viewer: open or not (as it was left last), and a
 * count bumped to put the keyboard in the note when the Student opens it.
 */
export function useNotesPanel() {
  const [open, setOpen] = useState(wasOpen);
  const [focus, setFocus] = useState(0);
  const show = useCallback((next: boolean) => {
    wasOpen = next;
    setOpen(next);
    if (next) setFocus((n) => n + 1);
  }, []);
  return { open, focus, show };
}

/** "Catatanku" in a viewer's toolbar: pressed while the panel is open. */
export function NotesButton({ open, paged, onClick }: { open: boolean; paged: boolean; onClick: () => void }) {
  const t = useT();
  return (
    <Tooltip content={t(paged ? "pageNote.openHint" : "pageNote.openHintFile")}>
      <Button
        size="sm"
        variant="ghost"
        aria-pressed={open}
        className={cx(open && "bg-selected text-fg")}
        icon={<NoteIcon className="size-3.5" />}
        onClick={onClick}
      >
        {t("pageNote.open")}
      </Button>
    </Tooltip>
  );
}

/** A note's first line, as its other notes list it and a page's mark previews it. */
const firstLine = (text: string) => text.trim().split("\n")[0];

/**
 * The panel beside the file: the note on `page` (none: on the whole file),
 * saved a moment after the Student stops typing, when the box loses the
 * keyboard, when another page comes into view, and as it closes. Emptied, the
 * note goes; "Hapus catatan" says so in a toast with Urungkan.
 */
export function NotesPanel({
  notes,
  page,
  focus,
  onGoTo,
  onClose,
}: {
  notes: PageNotes;
  /** The page being read (from 1); none in a file read as one text. */
  page?: number;
  /** Bumped to put the keyboard in the note. */
  focus: number;
  onGoTo?: (page: number) => void;
  onClose: () => void;
}) {
  const t = useT();
  const title = useId();
  const othersTitle = useId();
  const box = useRef<HTMLTextAreaElement>(null);
  /** What's typed on a page and not saved yet. */
  const [draft, setDraft] = useState<{ page?: number; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef({ notes, draft });
  latest.current = { notes, draft };

  /** What's typed and waiting, saved now. */
  const flush = useCallback(() => {
    if (timer.current === undefined) return;
    clearTimeout(timer.current);
    timer.current = undefined;
    const { notes, draft } = latest.current;
    if (draft) notes.set(draft.page, draft.text);
  }, []);

  // Another page in view: what was typed on the one before is saved, and this one's note shows.
  // biome-ignore lint/correctness/useExhaustiveDependencies: on each new page
  useEffect(() => {
    flush();
    setDraft(null);
  }, [page, flush]);
  // Closing (or the viewer shutting) saves what's waiting.
  useEffect(() => flush, [flush]);
  useEffect(() => {
    if (focus) box.current?.focus();
  }, [focus]);

  const text = draft && draft.page === page ? draft.text : (noteOn(notes.items, page)?.text ?? "");
  const others = page ? notes.items.filter((note) => note.page !== undefined && note.page !== page) : [];

  const remove = () => {
    clearTimeout(timer.current);
    timer.current = undefined;
    // What's shown goes, and is what Urungkan puts back.
    const gone: PageNote = { ...(page ? { page } : {}), text, at: Date.now() };
    setDraft(null);
    notes.remove(page);
    box.current?.focus();
    toast(t("pageNote.removed"), "neutral", { label: t("action.undo"), onClick: () => notes.restore(gone) });
  };

  return (
    <aside aria-labelledby={title} data-page-notes className="flex w-80 shrink-0 flex-col border-l border-line bg-raised">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line pr-2 pl-4">
        <NoteIcon className="size-4 shrink-0 text-muted" />
        <h2 id={title} className="min-w-0 flex-1 truncate text-small font-semibold">
          {page ? t("pageNote.title", { page }) : t("pageNote.titleFile")}
        </h2>
        <Tooltip content={t("pageNote.close")}>
          <IconButton label={t("pageNote.close")} size="sm" onClick={onClose}>
            <Icons.X className="size-4" />
          </IconButton>
        </Tooltip>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4">
        <textarea
          ref={box}
          aria-labelledby={title}
          value={text}
          maxLength={MAX_NOTE}
          placeholder={t(page ? "pageNote.placeholder" : "pageNote.placeholderFile")}
          onChange={(event) => {
            const next = { page, text: event.target.value };
            latest.current.draft = next;
            setDraft(next);
            clearTimeout(timer.current);
            timer.current = setTimeout(flush, 600);
          }}
          onBlur={flush}
          className="min-h-44 w-full resize-y rounded-lg border border-field-edge bg-surface px-3 py-2 text-body text-fg placeholder:text-faint focus:border-focus focus:outline-none"
        />
        <div className="flex min-h-7 items-center gap-2">
          <p className="min-w-0 flex-1 text-caption text-muted">{t("pageNote.kept")}</p>
          {text.trim() && (
            <Tooltip content={t("pageNote.remove")}>
              <Button size="sm" variant="ghost" aria-label={t("pageNote.remove")} icon={<DeleteIcon className="size-3.5" />} onClick={remove} className="px-2">
                {t("pageNote.removeShort")}
              </Button>
            </Tooltip>
          )}
        </div>
        {others.length > 0 && (
          <section aria-labelledby={othersTitle} className="mt-2 border-t border-line pt-3">
            <h3 id={othersTitle} className="mb-1 px-2 text-caption font-medium text-muted">
              {t("pageNote.others")}
            </h3>
            <ul>
              {others.map((note) => (
                <li key={note.page}>
                  <button
                    type="button"
                    aria-label={t("pageNote.item", { page: note.page ?? 1, text: firstLine(note.text) })}
                    onClick={() => onGoTo?.(note.page ?? 1)}
                    className="focus-ring flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left hover:bg-hover"
                  >
                    <span className="shrink-0 text-caption text-muted tabular-nums">{t("pageNote.page", { page: note.page ?? 1 })}</span>
                    <span className="min-w-0 flex-1 truncate text-small">{firstLine(note.text)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </aside>
  );
}

/**
 * The mark on a PDF page that has a note: a small sticky note on its top edge,
 * in highlighter yellow (paper is white in both themes), its words in the
 * tooltip. A press opens the panel on that page.
 */
export function PageNoteMark({ page, note, onOpen }: { page: number; note: PageNote; onOpen: () => void }) {
  const t = useT();
  const preview = firstLine(note.text);
  return (
    <Tooltip content={preview.length > 80 ? `${preview.slice(0, 80)}…` : preview}>
      <button
        type="button"
        aria-label={t("pageNote.title", { page })}
        onClick={onOpen}
        className="focus-ring absolute -top-3 right-6 z-10 grid h-6 w-7 place-items-center rounded-md bg-(--highlight-yellow) text-black/75 shadow-card ring-1 ring-black/15 hover:text-black"
      >
        <NoteIcon className="size-3.5" />
      </button>
    </Tooltip>
  );
}
