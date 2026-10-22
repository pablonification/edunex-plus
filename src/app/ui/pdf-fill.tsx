// Filling a PDF in the viewer: what the Student filled in and added, with
// undo (⌘Z) and redo; a form's fields as real boxes over the page (Tab moves
// from one to the next); and text added anywhere on a page, which can be
// moved, made bigger or smaller and deleted. The pages stay paper: white, in
// the PDF's own black ink, whatever the app's theme. Loads with the viewer.

import { ArrowsOutCardinalIcon } from "@phosphor-icons/react/dist/csr/ArrowsOutCardinal";
import { ArrowUUpLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowUUpLeft";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { type CSSProperties, type KeyboardEvent, type PointerEvent, useCallback, useMemo, useRef, useState } from "react";
import { useT } from "../i18n";
import { Button, IconButton } from "./controls";
import { cx } from "./cx";
import { Icons, icon } from "./icons";
import { Tooltip } from "./overlays";
import { LINE_HEIGHT, OFF, type PdfField, type PdfFill, type PdfText } from "./pdf-engine";

const MoveIcon = icon(ArrowsOutCardinalIcon);
const DeleteIcon = icon(TrashIcon);
const UndoIcon = icon(ArrowUUpLeftIcon);

/** The sizes added text comes in, in points; 12 to start, like a typed form. */
export const TEXT_SIZES = [8, 10, 12, 14, 18, 24];
const START_SIZE = 12;

const EMPTY: PdfFill = { fields: {}, texts: [] };

/** A fill as it would be saved: fields in one order, and only text that has words in it. */
const shape = (fill: PdfFill) =>
  JSON.stringify([Object.entries(fill.fields).sort(([a], [b]) => a.localeCompare(b)), fill.texts.filter((text) => text.text.trim())]);

interface History {
  now: PdfFill;
  past: PdfFill[];
  future: PdfFill[];
  /** What the last change was to ("text:t1"): typing on in the same box is one step to undo, not one per letter. */
  key: string | null;
  /** The fill as it was last saved or attached. */
  saved: string;
}

const START: History = { now: EMPTY, past: [], future: [], key: null, saved: shape(EMPTY) };
let ids = 0;

export type FillState = ReturnType<typeof useFill>;

/** What the Student filled in on one PDF, its undo and redo, and whether it's saved. */
export function useFill() {
  const [history, setHistory] = useState<History>(START);

  /** A change; `key` null tidies up (an empty box going) without a step of its own to undo. */
  const change = useCallback((key: string | null, update: (fill: PdfFill) => PdfFill) => {
    setHistory((h) => {
      const now = update(h.now);
      if (key === null) {
        const before = h.past.at(-1);
        return { ...h, now, past: before && shape(before) === shape(now) ? h.past.slice(0, -1) : h.past, key: null };
      }
      if (key === h.key) return { ...h, now, future: [] };
      return { ...h, now, past: [...h.past, h.now].slice(-200), future: [], key };
    });
  }, []);

  const actions = useMemo(
    () => ({
      setField(name: string, value: string, original: string | undefined) {
        change(`field:${name}`, (fill) => {
          const { [name]: _, ...rest } = fill.fields;
          return { ...fill, fields: value === original ? rest : { ...rest, [name]: value } };
        });
      },
      /** A new, empty text box; its id, to put the cursor in it. */
      addText(page: number, left: number, top: number): string {
        const id = `text-${++ids}`;
        change(`text:${id}`, (fill) => ({ ...fill, texts: [...fill.texts, { id, page, left, top, size: START_SIZE, text: "" }] }));
        return id;
      },
      editText(id: string, patch: Partial<Omit<PdfText, "id">>, what: "text" | "move" | "size") {
        change(`${what}:${id}`, (fill) => ({ ...fill, texts: fill.texts.map((text) => (text.id === id ? { ...text, ...patch } : text)) }));
      },
      removeText(id: string, quietly = false) {
        change(quietly ? null : `remove:${id}`, (fill) => ({ ...fill, texts: fill.texts.filter((text) => text.id !== id) }));
      },
      undo: () => setHistory((h) => (h.past.length ? { ...h, now: h.past.at(-1)!, past: h.past.slice(0, -1), future: [h.now, ...h.future], key: null } : h)),
      redo: () => setHistory((h) => (h.future.length ? { ...h, now: h.future[0], past: [...h.past, h.now], future: h.future.slice(1), key: null } : h)),
      markSaved: () => setHistory((h) => ({ ...h, saved: shape(h.now), key: null })),
      reset: () => setHistory(START),
    }),
    [change],
  );

  const now = shape(history.now);
  return {
    ...actions,
    fill: history.now,
    /** Anything filled in or added at all (saved or not). */
    changed: now !== START.saved,
    /** Something filled in that isn't saved or attached (all of it taken out again leaves nothing to lose). */
    dirty: now !== START.saved && now !== history.saved,
    canUndo: history.past.length > 0,
  };
}

// ---------------------------------------------------------------- on the page

/** Inside these, keys belong to filling (Escape leaves the box, not the viewer). */
export const FILL_AREA = "[data-fill]";

/** A form field's box: a light blue tint, as PDF readers mark what can be filled in. */
const FIELD = "focus-ring absolute m-0 bg-accent/8 text-black hover:bg-accent/14 focus:bg-accent/4 disabled:pointer-events-none";

export function FieldBox({
  field,
  value,
  scale,
  group,
  onChange,
}: {
  field: PdfField;
  value: string;
  scale: number;
  /** Radio buttons of one field share this name, so arrows move between them. */
  group: string;
  onChange: (value: string) => void;
}) {
  const t = useT();
  const style: CSSProperties = {
    left: field.left * scale,
    top: field.top * scale,
    width: field.width * scale,
    height: field.height * scale,
    // The PDF's own size; "fit the box" reads as a typed form does, never bigger than its box.
    fontSize: (field.fontSize || Math.min(Math.max(field.height * 0.7, 8), 12)) * scale,
  };
  if (field.kind === "check" || field.kind === "radio") {
    return (
      <input
        data-fill
        type={field.kind === "check" ? "checkbox" : "radio"}
        name={field.kind === "radio" ? group : undefined}
        // Radio buttons share their question's name; each says which answer it is.
        aria-label={field.kind === "radio" && field.on ? t("pdf.radio", { field: field.label, option: field.on }) : field.label}
        checked={value === field.on}
        disabled={field.readOnly}
        onChange={(event) => onChange(event.target.checked ? field.on : OFF)}
        style={style}
        className={cx(FIELD, "cursor-pointer accent-(--accent)")}
      />
    );
  }
  if (field.kind === "choice") {
    const known = field.options.some((option) => option.value === value);
    return (
      <select
        data-fill
        aria-label={field.label}
        value={value}
        disabled={field.readOnly}
        onChange={(event) => onChange(event.target.value)}
        style={style}
        className={cx(FIELD, "cursor-pointer rounded-none border-0 px-0.5 font-[Helvetica,Arial,sans-serif]")}
      >
        {!known && <option value={value}>{value}</option>}
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  const Box = field.multiline ? "textarea" : "input";
  return (
    <Box
      data-fill
      aria-label={field.label}
      value={value}
      readOnly={field.readOnly}
      maxLength={field.maxLength ?? undefined}
      spellCheck={false}
      onChange={(event) => onChange(event.target.value)}
      style={style}
      className={cx(FIELD, "resize-none rounded-none border-0 px-0.5 py-0 leading-tight font-[Helvetica,Arial,sans-serif]")}
    />
  );
}

/** A size step from the set, or the same size at either end. */
const nextSize = (size: number, direction: 1 | -1) =>
  direction > 0 ? (TEXT_SIZES.find((s) => s > size) ?? size) : (TEXT_SIZES.findLast((s) => s < size) ?? size);

export function TextBox({
  text,
  scale,
  page,
  focus,
  onEdit,
  onRemove,
  onLeave,
}: {
  text: PdfText;
  scale: number;
  /** The page's size at scale 1: the text stays on it. */
  page: { width: number; height: number };
  /** Puts the cursor in it as it appears (it was just added). */
  focus: boolean;
  onEdit: (patch: Partial<Omit<PdfText, "id">>, what: "text" | "move" | "size") => void;
  /** Gone: deleted, or left empty. `quietly`: left empty, so nothing to undo. */
  onRemove: (quietly: boolean) => void;
  /** Hands the keyboard back to the pages (Delete, Escape). */
  onLeave: () => void;
}) {
  const t = useT();
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const place = (left: number, top: number) =>
    onEdit({ left: Math.min(Math.max(left, 0), page.width - 8), top: Math.min(Math.max(top, 0), page.height - text.size) }, "move");

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, left: text.left, top: text.top };
  };
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const from = drag.current;
    if (from) place(from.left + (event.clientX - from.x) / scale, from.top + (event.clientY - from.y) / scale);
  };
  const onMoveKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = event.shiftKey ? 10 : 2;
    const by = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
    if (!by) return;
    event.preventDefault();
    event.stopPropagation();
    place(text.left + by[0], text.top + by[1]);
  };
  const resize = (direction: 1 | -1) => onEdit({ size: nextSize(text.size, direction) }, "size");

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: it only notices the keyboard leaving the box and its tools, it takes no input itself
    <div
      data-fill
      data-added-text
      className="group/text absolute"
      style={{ left: text.left * scale, top: text.top * scale }}
      onBlur={(event) => {
        // Left empty (not just gone to its own buttons): it was never there.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null) && !text.text.trim()) onRemove(true);
      }}
    >
      <textarea
        aria-label={t("pdf.text")}
        value={text.text}
        rows={1}
        spellCheck={false}
        // biome-ignore lint/a11y/noAutofocus: a box the Student just put on the page is where they type next
        autoFocus={focus}
        onChange={(event) => onEdit({ text: event.target.value }, "text")}
        onKeyDown={(event) => {
          if (event.key === "Backspace" && !text.text) {
            event.preventDefault();
            onRemove(true);
            onLeave();
          }
        }}
        style={{ fontSize: text.size * scale, lineHeight: LINE_HEIGHT }}
        className="block min-w-8 resize-none overflow-hidden whitespace-pre bg-transparent p-0 font-[Helvetica,Arial,sans-serif] text-black outline-1 outline-transparent [field-sizing:content] group-hover/text:outline-dashed group-hover/text:outline-accent/60 focus:outline-2 focus:outline-solid focus:outline-focus"
      />
      {/* Its own small tools, above it while it's in use: move, size, delete. */}
      <div
        role="toolbar"
        aria-label={t("pdf.text")}
        className="pointer-events-none absolute bottom-full left-0 mb-1.5 flex items-center gap-0.5 rounded-lg bg-raised p-0.5 text-fg opacity-0 shadow-pop ring-1 ring-black/10 transition-opacity duration-150 group-focus-within/text:pointer-events-auto group-focus-within/text:opacity-100 group-hover/text:pointer-events-auto group-hover/text:opacity-100 dark:ring-white/10"
      >
        <Tooltip content={t("pdf.text.moveHint")} side="top">
          <IconButton
            label={t("pdf.text.move")}
            size="sm"
            className="cursor-grab touch-none active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => {
              drag.current = null;
            }}
            onKeyDown={onMoveKey}
          >
            <MoveIcon className="size-4" />
          </IconButton>
        </Tooltip>
        <Tooltip content={t("pdf.text.smaller")} side="top">
          <IconButton label={t("pdf.text.smaller")} size="sm" aria-disabled={text.size <= TEXT_SIZES[0]} onClick={() => resize(-1)}>
            <Icons.Minus className="size-4" />
          </IconButton>
        </Tooltip>
        <span aria-live="polite" className="w-6 text-center text-small text-muted tabular-nums">
          <span className="sr-only">{t("pdf.text.size")} </span>
          {text.size}
        </span>
        <Tooltip content={t("pdf.text.bigger")} side="top">
          <IconButton label={t("pdf.text.bigger")} size="sm" aria-disabled={text.size >= TEXT_SIZES.at(-1)!} onClick={() => resize(1)}>
            <Icons.Plus className="size-4" />
          </IconButton>
        </Tooltip>
        <Tooltip content={t("pdf.text.remove")} side="top">
          <IconButton
            label={t("pdf.text.remove")}
            size="sm"
            className="hover:text-(--danger-fg)"
            onClick={() => {
              onRemove(false);
              onLeave();
            }}
          >
            <DeleteIcon className="size-4" />
          </IconButton>
        </Tooltip>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- saving

/**
 * Under the pages once something is filled in: whether it's saved, undo, and
 * the ways to keep it (a copy on this computer; into the Task's answer).
 */
export function SaveBar({
  dirty,
  canUndo,
  onUndo,
  mac,
  busy,
  onSaveCopy,
  onAttach,
}: {
  dirty: boolean;
  canUndo: boolean;
  onUndo: () => void;
  mac: boolean;
  busy: "copy" | "attach" | null;
  onSaveCopy?: () => void;
  /** Only from a Task whose answer can still change. */
  onAttach?: () => void;
}) {
  const t = useT();
  const undo = `${t("pdf.undo")} (${mac ? "⌘Z" : "Ctrl+Z"})`;
  return (
    <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-t border-line py-2 pr-2 pl-4">
      <p role="status" className="min-w-0 flex-1 text-small text-muted">
        {dirty ? t("pdf.unsaved") : t("pdf.copySaved")}
      </p>
      <Tooltip content={undo}>
        <IconButton label={t("pdf.undo")} size="sm" aria-disabled={!canUndo} onClick={onUndo}>
          <UndoIcon className="size-4" />
        </IconButton>
      </Tooltip>
      {onSaveCopy && (
        <Tooltip content={t("pdf.saveCopyHint")}>
          <Button size="sm" busy={busy === "copy"} disabled={busy !== null && busy !== "copy"} onClick={onSaveCopy}>
            {t("pdf.saveCopy")}
          </Button>
        </Tooltip>
      )}
      {onAttach && (
        <Tooltip content={t("pdf.attachHint")}>
          <Button
            size="sm"
            variant="primary"
            busy={busy === "attach"}
            disabled={busy !== null && busy !== "attach"}
            icon={<Icons.Paperclip className="size-3.5" />}
            onClick={onAttach}
          >
            {t("pdf.attach")}
          </Button>
        </Tooltip>
      )}
    </div>
  );
}
