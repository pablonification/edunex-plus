// The picker for a course's color: the sidebar (right-click, Shift+F10 or the
// context-menu key), the course page (its dot and code, or "Ganti warna" in
// "Lainnya") and Settings all open this one. Its title is the course's code,
// then a line saying what's on ("Otomatis: Biru muda"), then the choices:
// automatic, and the ten colors by hue, each with the code of a course that
// already has it. Moving through them redraws the course everywhere at once,
// so the screen behind is the preview; nothing is saved until it closes
// (Enter, a click outside, focus leaving), and Escape puts everything back.
// Two courses may share a color: it says so, once, in neutral words.
import { type ReactNode, type RefObject, useLayoutEffect, useMemo, useRef, useState } from "react";
import { applyChoice, courseTone, type PaletteId, PICKER_ORDER, pickedColor, resolveCourseColors } from "../core/course-colors";
import { endPreview, previewCourseColor, useCommittedCourseColors, useCourseColorPicks, withLegacy } from "./course-colors";
import { useTermCourses } from "./courses";
import { type Translate, useFormat, useT } from "./i18n";
import { useRadioKeys } from "./ui/controls";
import { cx } from "./ui/cx";
import { Icons } from "./ui/icons";
import { Popover } from "./ui/overlays";

/** A palette color's name, in the Student's language ("Biru muda"). */
export const colorName = (t: Translate, id: PaletteId) => t(`courseColor.name.${id}`);

const ROWS = [1, 5, 5];

export function CourseColorPicker({
  code,
  open,
  onOpenChange,
  trigger,
  anchor,
  side = "bottom",
  align = "start",
}: {
  code: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What opens it, when it's a button of its own (the course page's eyebrow, a Settings row). */
  trigger?: ReactNode;
  /** What it hangs from otherwise (a sidebar row, whose click opens the course). */
  anchor?: RefObject<HTMLElement | null>;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}) {
  const t = useT();
  const picks = useCourseColorPicks();
  const escaped = useRef(false);
  const change = (next: boolean) => {
    if (!next) {
      if (escaped.current) picks.cancel(code);
      else void picks.finish(code);
      escaped.current = false;
    }
    onOpenChange(next);
  };
  return (
    <Popover
      open={open}
      onOpenChange={change}
      trigger={trigger}
      anchor={anchor}
      side={side}
      align={align}
      label={t("courseColor.title", { code })}
      onEscapeKeyDown={() => {
        escaped.current = true;
      }}
      className="w-72 p-4"
    >
      <Choices code={code} onDone={() => change(false)} />
    </Popover>
  );
}

function Choices({ code, onDone }: { code: string; onDone: () => void }) {
  const t = useT();
  const f = useFormat();
  const courses = useTermCourses();
  const committed = useCommittedCourseColors();
  const codes = useMemo(() => {
    const term = courses?.map((course) => course.code) ?? [];
    return term.includes(code) ? term : [...term, code];
  }, [courses, code]);
  // Everything is worked out against how things were when it opened, so moving through the colors never shoves
  // the other courses around.
  const [base] = useState(() => withLegacy(codes, committed));
  const [choice, setChoice] = useState<PaletteId | null>(() => pickedColor(code, base) ?? null);
  useLayoutEffect(() => previewCourseColor({ code, codes, base, choice }), [code, codes, base, choice]);
  useLayoutEffect(() => () => endPreview(code), [code]);

  const name = courses?.find((course) => course.code === code)?.name;
  const outcome = (id: PaletteId | null) => resolveCourseColors(codes, applyChoice(base, code, id, 0));
  const automatic = outcome(null).colors.get(code)!.id;
  const now = outcome(choice);
  const shown = now.colors.get(code)!.id;
  // Who has each color as it opened: the code under each swatch.
  const before = resolveCourseColors(codes, base).colors;
  const holders = (id: PaletteId) => codes.filter((other) => other !== code && before.get(other)?.id === id);

  const values: (PaletteId | null)[] = [null, ...PICKER_ORDER];
  const radio = useRadioKeys(values, choice, setChoice, ROWS);
  const onKey = (event: React.KeyboardEvent) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    onDone();
  };

  const sharing = codes.filter((other) => other !== code && now.colors.get(other)?.id === shown);
  const moved = now.moved.filter((m) => m.code !== code);
  const note =
    choice !== null && moved.length
      ? t("courseColor.moved", { code: moved[0].code, color: colorName(t, moved[0].from), next: colorName(t, moved[0].to) })
      : sharing.length
        ? t("courseColor.shared", { codes: f.list(sharing), color: colorName(t, shown), count: sharing.length })
        : codes.length > PICKER_ORDER.length
          ? t("courseColor.full")
          : "";

  /** A swatch's whole name: its color, and who has it or would move. */
  const label = (id: PaletteId) => {
    const result = outcome(id);
    const users = codes.filter((other) => other !== code && result.colors.get(other)?.id === id);
    if (users.length)
      return users.some((other) => result.colors.get(other)?.picked)
        ? t("courseColor.swatch.alsoPicked", { color: colorName(t, id), codes: f.list(users) })
        : t("courseColor.swatch.used", { color: colorName(t, id), codes: f.list(users) });
    const leaving = result.moved.filter((m) => m.code !== code && m.from === id);
    if (leaving.length)
      return t("courseColor.swatch.usedAuto", { color: colorName(t, id), codes: f.list(leaving.map((m) => m.code)), next: colorName(t, leaving[0].to) });
    return colorName(t, id);
  };

  return (
    <div>
      <p id={`color-title-${code}`} className="text-body font-semibold tabular-nums">
        {t("courseColor.title", { code })}
      </p>
      {name && <p className="mt-0.5 truncate text-small text-muted">{name}</p>}
      <p id={`color-status-${code}`} className="mt-1 text-small text-muted">
        {choice === null
          ? t("courseColor.auto", { color: colorName(t, automatic) })
          : t("courseColor.picked", { color: colorName(t, choice), auto: colorName(t, automatic) })}
      </p>
      <div
        role="radiogroup"
        aria-labelledby={`color-title-${code}`}
        aria-describedby={`color-status-${code} color-note-${code}`}
        className="mt-3"
        onKeyDown={onKey}
      >
        <button
          type="button"
          {...radio(0)}
          className={cx(
            "focus-ring flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-small transition-colors duration-150 hover:bg-hover",
            choice === null ? "bg-selected font-semibold" : "font-medium",
          )}
        >
          <Swatch color={courseTone(automatic)} className="size-3 rounded-xs" />
          <span className="min-w-0 flex-1 truncate">{t("courseColor.autoChoice", { color: colorName(t, automatic) })}</span>
          {choice === null && <Icons.Check className="size-3.5 shrink-0" weight="bold" />}
        </button>
        <div className="mt-2 grid grid-cols-5 gap-x-1.5 gap-y-1">
          {PICKER_ORDER.map((id, index) => {
            const checked = choice === id;
            const held = holders(id);
            return (
              <div key={id} className="flex flex-col items-center gap-0.5">
                <button type="button" {...radio(index + 1)} aria-label={label(id)} className="focus-ring grid size-9 place-items-center rounded-lg">
                  <Swatch
                    color={courseTone(id)}
                    className={cx("grid size-7 place-items-center rounded-md", checked && "ring-2 ring-fg ring-offset-2 ring-offset-raised")}
                  >
                    {checked && <Icons.Check className="size-4 text-raised" weight="bold" />}
                  </Swatch>
                </button>
                <span aria-hidden className="h-3.5 max-w-full truncate text-micro text-faint tabular-nums">
                  {held.length ? `${held[0]}${held.length > 1 ? ` +${held.length - 1}` : ""}` : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      {/* Always there, so a screen reader hears each note as it comes. Neutral: sharing a color is fine. */}
      <p id={`color-note-${code}`} aria-live="polite" className="mt-2 flex gap-1.5 text-small text-muted empty:hidden">
        {note && (
          <>
            <Icons.Info className="mt-0.5 size-3.5 shrink-0" />
            <span>{note}</span>
          </>
        )}
      </p>
    </div>
  );
}

/** A color as a filled square; kept in high contrast, edged in the system's text color. */
function Swatch({ color, className, children }: { color: string; className?: string; children?: ReactNode }) {
  return (
    <span
      aria-hidden
      className={cx("shrink-0 forced-color-adjust-none forced-colors:outline forced-colors:outline-1 forced-colors:outline-[CanvasText]", className)}
      style={{ background: color }}
    >
      {children}
    </span>
  );
}
