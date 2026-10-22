// The parts every screen is built from, so all screens read alike: the page
// frame, its header, sections, lists of rows, one-line facts, notices and
// figures. Screens compose these instead of styling their own.
import { Children, cloneElement, Fragment, isValidElement, type ReactNode } from "react";
import { cx } from "./cx";
import { Icons } from "./icons";
import { PresenceItem } from "./motion/presence-list";

const WIDTH = {
  narrow: "max-w-[760px]",
  default: "max-w-[1040px]",
  wide: "max-w-[1200px]",
  full: "",
} as const;

/**
 * A screen: its width and padding. (The shell gives every screen its soft entrance.) Zoomed in far
 * enough that the sidebar folds to its icons (`max-[52rem]`, never at 100%), the sides narrow too.
 */
export function Page({ width = "default", className, children }: { width?: keyof typeof WIDTH; className?: string; children: ReactNode }) {
  return <div className={cx("mx-auto px-10 pt-8 pb-24 max-[52rem]:px-5", WIDTH[width], className)}>{children}</div>;
}

/** The top of a screen: what it is, the one line that matters most, and its actions. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  /** A short line above the title (the date on Beranda, the course code on a course). */
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cx("mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-4", className)}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-small font-medium text-muted">{eyebrow}</div>}
        <h1 className="text-display font-semibold tracking-[-0.02em] text-balance">{title}</h1>
        {description && <div className="mt-1.5 text-lead text-muted">{description}</div>}
      </div>
      {/* Under the title when it doesn't fit beside it; on a line of its own, its actions wrap instead of running past the window. */}
      {actions && <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** A part of a screen under its own title; the count says how many before the Student reads them. */
export function Section({
  id,
  title,
  count,
  description,
  action,
  className,
  children,
}: {
  /** The heading's id; the section is labelled by it. */
  id?: string;
  title?: ReactNode;
  count?: number;
  description?: ReactNode;
  /** A link-like action at the heading's end ("Lihat semua"). */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={cx("mt-10 first:mt-0", className)}>
      {title !== undefined && (
        <div className="mb-3 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 id={id} className="text-title font-semibold tracking-[-0.01em]">
              {title}
              {/* The space keeps the count its own word for a screen reader: "Nanti 3", not "Nanti3". */}
              {count !== undefined && <span className="ml-1.5 font-medium text-faint tabular-nums">{` ${count}`}</span>}
            </h2>
            {description && <div className="mt-0.5 text-small text-muted">{description}</div>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Rows that belong together, on one card, divided by hairlines. */
export function List({ label, className, children }: { label?: string; className?: string; children: ReactNode }) {
  return (
    <ul
      aria-label={label}
      className={cx("overflow-hidden rounded-xl border border-edge bg-surface shadow-card [&>li+li]:border-t [&>li+li]:border-line", className)}
    >
      {children}
    </ul>
  );
}

/**
 * A name that may wrap after each "/" as well as between words: browsers never
 * break after a slash, so "Penciptaan/Pengembangan" in a narrow column would be
 * cut mid-word ("Pengembang an") instead of after the slash.
 */
export function breakAfterSlashes(text: string): ReactNode {
  if (!text.includes("/")) return text;
  return text.split("/").map((part, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: the pieces of one text, in their order; they have nothing else to be told apart by
    <Fragment key={i}>
      {i > 0 && (
        <>
          /<wbr />
        </>
      )}
      {part}
    </Fragment>
  ));
}

/**
 * One thing in a list: what it is (title), when and where (meta, one line),
 * and at the end its state or its one action. A clickable row is one button:
 * the whole row is the target, and it says where it goes on hover. `actions`
 * sit beside that button, never inside it.
 */
export function Row({
  leading,
  title,
  meta,
  trailing,
  actions,
  onClick,
  label,
  id,
  current,
  className,
  children,
}: {
  /** An indicator in front: a status glyph, a time, an icon. */
  leading?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  /** Right-aligned: a date, a chip, a button (not inside a clickable row). */
  trailing?: ReactNode;
  /**
   * A quiet control of the row's own ("Ingatkan nanti"), beside a clickable row
   * where its chevron would be: always there, so the Student can find it, in a
   * faint grey until the row is hovered or focused.
   */
  actions?: ReactNode;
  onClick?: () => void;
  /** The row's accessible name when its text alone isn't clear. */
  label?: string;
  /** On the row's button (or body), so focus can be sent to it. */
  id?: string;
  current?: boolean;
  className?: string;
  /** More under the meta line (signals, a note). */
  children?: ReactNode;
}) {
  const body = (
    <>
      {leading !== undefined && <span className="flex shrink-0 self-start pt-px">{leading}</span>}
      <span className="min-w-0 flex-1">
        {/* A long name wraps to a second line, then shows whole on hover: never cut with no way to read it. */}
        <span className="line-clamp-2 block text-body font-medium break-words" title={typeof title === "string" ? title : undefined}>
          {typeof title === "string" ? breakAfterSlashes(title) : title}
        </span>
        {meta && <span className="mt-0.5 block text-small text-muted">{meta}</span>}
        {children}
      </span>
      {trailing !== undefined && <span className="flex shrink-0 flex-col items-end gap-1 text-right">{trailing}</span>}
    </>
  );
  const aside = actions !== undefined && actions !== null && actions !== false;
  return (
    // A plain <li> outside a PresenceList; inside one, a row the Student removes fades out of it.
    <PresenceItem
      className={cx(
        // With actions the row's hover belongs to the whole line, the control beside the button included,
        // and so does the button's focus ring: drawn inside the line, around both, never cut by the list's edges.
        aside && "group/row flex items-center hover:bg-hover has-[>button:active]:bg-selected",
        aside &&
          "has-[>button:focus-visible]:outline-2 has-[>button:focus-visible]:outline-offset-[-2px] has-[>button:focus-visible]:outline-focus has-[>button:focus-visible]:outline-solid",
        aside && current && "bg-selected",
      )}
    >
      {onClick ? (
        <button
          type="button"
          id={id}
          onClick={onClick}
          aria-label={label}
          aria-current={current || undefined}
          className={cx(
            "group flex w-full items-center gap-3.5 px-4 py-3 text-left",
            aside ? "min-w-0 flex-1 pr-1 focus-visible:outline-none" : "focus-ring hover:bg-hover focus-visible:-outline-offset-2 active:bg-selected",
            current && !aside && "bg-selected",
            className,
          )}
        >
          {body}
          {!aside && (
            <Icons.ChevronRight className="-mr-1 size-4 shrink-0 text-faint opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100" />
          )}
        </button>
      ) : (
        <div id={id} className={cx("flex items-center gap-3.5 px-4 py-3", aside && "min-w-0 flex-1 pr-1", className)}>
          {body}
        </div>
      )}
      {aside && (
        // Never hidden until hover: a control nobody sees is one nobody finds. Faint at rest, its full color while the row
        // is hovered or focused, or its menu is open (the button's own hover still wins).
        <div className="flex shrink-0 items-center pr-2.5 [&_button]:text-faint group-focus-within/row:[&_button]:text-fg has-[[aria-expanded=true]]:[&_button]:text-fg [@media(hover:hover)]:group-hover/row:[&_button]:text-fg">
          {actions}
        </div>
      )}
    </PresenceItem>
  );
}

/**
 * Facts on one line, quietly separated: "11:00–12:59 · TVST C". Empty parts
 * drop out, and text holding " · " (a catalog string like "Dihitung di SIX ·
 * tutup 09:30") becomes separate facts. No line can start or end with "·":
 * each fact carries its own dot, so a fact that wraps takes its dot along, and
 * the dot of a fact that starts a line sits outside the box, clipped away.
 * `align="end"` is the mirror image for a right-aligned column (the dot after
 * each fact, clipped on the right); centered text can't be made safe this way.
 * `truncate` keeps the facts on one line and cuts the last one short instead
 * (an earlier fact that fills the line on its own ends in "…" there); the
 * line then shows whole on hover, never cut with no way to read it.
 */
export function Meta({
  className,
  truncate = false,
  align = "start",
  children,
}: {
  className?: string;
  truncate?: boolean;
  align?: "start" | "end";
  children: ReactNode;
}) {
  const parts = factParts(children);
  const end = align === "end";
  return (
    // The 4px of padding pulled out keeps a focus ring whole; the dot sits further out than that.
    <span
      className={cx("block min-w-0 overflow-x-clip", end ? "-mr-1 pr-1" : "-ml-1 pl-1", className)}
      title={truncate ? factsLabel(...parts.map(factText)) || undefined : undefined}
    >
      <span className={cx("flex items-center gap-y-0.5", end ? "-mr-4 justify-end" : "-ml-4", truncate ? "flex-nowrap" : "flex-wrap")}>
        {parts.map((part, i) => {
          // Before every fact but the first; at the end, after every fact but the last.
          const dot = end ? i < parts.length - 1 : i > 0;
          const sep = (
            // The spaces keep the text readable when copied ("PL3002 · 08:00"); a screen reader skips the dot.
            <span data-sep="" className="w-4 shrink-0 text-center text-faint">
              {dot && (
                <>
                  {" "}
                  <span aria-hidden>·</span>{" "}
                </>
              )}
            </span>
          );
          return (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: the parts are positional children; text has no key of its own
              key={i}
              data-fact=""
              // Short facts keep their width; one wider than the line stops at its edge, so its text can end in "…".
              className={cx("inline-flex min-w-0 items-center", truncate && i < parts.length - 1 && "max-w-full shrink-0")}
            >
              {!end && sep}
              <span className={cx("min-w-0", truncate ? "truncate" : "break-words")}>{part}</span>
              {end && sep}
            </span>
          );
        })}
      </span>
    </span>
  );
}

/** Splits a Meta's children into its facts: blanks dropped, text with "·" in it (or a plain element holding such text) split up. */
function factParts(children: ReactNode): ReactNode[] {
  const parts: ReactNode[] = [];
  for (const child of Children.toArray(children)) {
    if (typeof child === "string") parts.push(...splitFacts(child));
    else if (isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment) parts.push(...factParts(child.props.children));
    else if (isValidElement<{ children?: ReactNode }>(child) && typeof child.type === "string" && typeof child.props.children === "string")
      parts.push(
        // biome-ignore lint/suspicious/noArrayIndexKey: the pieces of one text, in their order; they have nothing else to be told apart by
        ...splitFacts(child.props.children).map((text, i) => cloneElement(child, { key: `${child.key}:${i}` }, text)),
      );
    else parts.push(child);
  }
  return parts;
}

/** A fact's words: its text, or the text inside an element (an icon beside it has none), spaced as on screen. */
function factText(part: ReactNode): string {
  return rawText(part).replace(/\s+/g, " ").trim();
}

/** The text under a node as it is, spaces between nested elements kept ("<b>Modul </b>5" stays "Modul 5"). */
function rawText(part: ReactNode): string {
  if (typeof part === "string" || typeof part === "number") return String(part);
  if (isValidElement<{ children?: unknown }>(part) && typeof part.props.children !== "function")
    return Children.toArray(part.props.children as ReactNode)
      .map(rawText)
      .join("");
  return "";
}

const splitFacts = (text: string) =>
  text
    .split("·")
    .map((piece) => piece.trim())
    .filter(Boolean);

/**
 * The same facts as one plain string, for an accessible name or a tooltip:
 * "PL3002 · 08:00–10:00 · R.SG PWK LT.6". Blanks drop out. On the screen it
 * goes only through `Meta` (which splits it up again), never as plain text,
 * where a line could end in "·".
 */
export function factsLabel(...parts: (string | number | null | undefined | false)[]): string {
  return parts.filter((part): part is string | number => part !== null && part !== undefined && part !== false && String(part).trim() !== "").join(" · ");
}

const NOTICE = {
  info: { box: "bg-info-bg text-info-fg", Icon: Icons.Info },
  warning: { box: "bg-warning-bg text-warning-fg", Icon: Icons.AlertTriangle },
  danger: { box: "bg-danger-bg text-danger-fg", Icon: Icons.AlertTriangle },
  success: { box: "bg-success-bg text-success-fg", Icon: Icons.CheckCircle },
  neutral: { box: "bg-fill text-fg", Icon: Icons.Info },
} as const;

/** Something to know right here, said once, with the one thing to do about it. */
export function Notice({
  tone = "info",
  icon,
  title,
  action,
  snooze,
  className,
  children,
}: {
  tone?: keyof typeof NOTICE;
  icon?: ReactNode;
  title: ReactNode;
  action?: ReactNode;
  /** A quiet "Ingatkan nanti" after the action: put this notice off for a while. */
  snooze?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  const { box, Icon } = NOTICE[tone];
  return (
    <div className={cx("flex items-start gap-3 rounded-xl px-4 py-3", box, className)}>
      <span className="mt-0.5 shrink-0">{icon ?? <Icon className="size-4" weight="bold" />}</span>
      {/* The action sits beside the words while they keep a readable width (16rem), and goes under them after that,
          never squeezing them to a word per line (a narrow column, a zoomed-in window). */}
      <div className="flex min-w-0 flex-1 flex-wrap items-start gap-x-3 gap-y-2.5">
        <div className="min-w-0 flex-1 basis-64">
          <div className="text-body font-semibold">{title}</div>
          {children && <div className="mt-0.5 text-small opacity-90">{children}</div>}
        </div>
        {(action || snooze) && (
          <div className="flex flex-wrap items-center justify-end gap-1.5 self-center">
            {action}
            {snooze}
          </div>
        )}
      </div>
    </div>
  );
}

const STAT_TONE = { neutral: "", success: "text-success-fg", warning: "text-warning-fg", danger: "text-danger-fg" } as const;
const STAT_SIZE = { figure: "text-figure", heading: "text-heading" } as const;

/**
 * Figures read at a glance, side by side on the page with no box, split by
 * hairlines. Labels, figures and hints each share a line across the row, so a
 * label that wraps never pushes its figure lower than the others'. They stack
 * only in a container narrower than 320 px, so three short counts still sit in
 * one row in a narrow column (the first run's, about 380 px).
 */
export function StatRow({ label, className, children }: { label?: string; className?: string; children: ReactNode }) {
  return (
    <div className={cx("@container", className)}>
      <dl
        aria-label={label}
        className="grid grid-cols-1 gap-y-1 divide-y divide-line @xs:auto-cols-fr @xs:grid-flow-col @xs:grid-cols-none @xs:grid-rows-[repeat(3,auto)] @xs:divide-x @xs:divide-y-0"
      >
        {children}
      </dl>
    </div>
  );
}

/** One figure in a `StatRow`: IPK, SKS, absences left. */
export function Stat({
  label,
  value,
  hint,
  tone = "neutral",
  size = "figure",
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: keyof typeof STAT_TONE;
  /** `heading`: smaller, for a few counts beside other content (the first run's courses, tasks, meetings). */
  size?: keyof typeof STAT_SIZE;
  className?: string;
}) {
  return (
    <div className={cx("row-span-3 grid grid-rows-subgrid py-3 first:pt-0 last:pb-0 @xs:px-6 @xs:py-0 @xs:first:pl-0 @xs:last:pr-0", className)}>
      <dt className="self-end text-small font-medium text-muted">{label}</dt>
      <dd className={cx("font-semibold tabular-nums", STAT_SIZE[size], STAT_TONE[tone])}>{value}</dd>
      <dd className="text-small text-muted">{hint}</dd>
    </div>
  );
}
