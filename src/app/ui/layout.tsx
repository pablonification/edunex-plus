// The parts every screen is built from, so all screens read alike: the page
// frame, its header, sections, lists of rows, one-line facts, notices and
// figures. Screens compose these instead of styling their own.
import { Children, type CSSProperties, cloneElement, Fragment, isValidElement, type ReactNode } from "react";
import { cx } from "./cx";
import { Icons } from "./icons";

const WIDTH = {
  narrow: "max-w-[760px]",
  default: "max-w-[1040px]",
  wide: "max-w-[1200px]",
  full: "",
} as const;

/** A screen: its width and padding. (The shell gives every screen its soft entrance.) */
export function Page({ width = "default", className, children }: { width?: keyof typeof WIDTH; className?: string; children: ReactNode }) {
  return <div className={cx("mx-auto px-10 pt-8 pb-24", WIDTH[width], className)}>{children}</div>;
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
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
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
 * One thing in a list: what it is (title), when and where (meta, one line),
 * and at the end its state or its one action. A clickable row is one button:
 * the whole row is the target, and it says where it goes on hover.
 */
export function Row({
  leading,
  title,
  meta,
  trailing,
  onClick,
  label,
  current,
  index,
  className,
  children,
}: {
  /** An indicator in front: a status glyph, a time, an icon. */
  leading?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  /** Right-aligned: a date, a chip, a button (not inside a clickable row). */
  trailing?: ReactNode;
  onClick?: () => void;
  /** The row's accessible name when its text alone isn't clear. */
  label?: string;
  current?: boolean;
  /** The row's place, for the staggered arrival. */
  index?: number;
  className?: string;
  /** More under the meta line (signals, a note). */
  children?: ReactNode;
}) {
  const body = (
    <>
      {leading !== undefined && <span className="flex shrink-0 self-start pt-px">{leading}</span>}
      <span className="min-w-0 flex-1">
        {/* A long name wraps to a second line, then shows whole on hover: never cut with no way to read it. */}
        <span className="line-clamp-2 block text-body font-medium [overflow-wrap:anywhere]" title={typeof title === "string" ? title : undefined}>
          {title}
        </span>
        {meta && <span className="mt-0.5 block text-small text-muted">{meta}</span>}
        {children}
      </span>
      {trailing !== undefined && <span className="flex shrink-0 flex-col items-end gap-1 text-right">{trailing}</span>}
    </>
  );
  const style = index === undefined ? undefined : ({ "--i": index } as CSSProperties);
  return (
    <li className={cx(index !== undefined && "motion-safe:stagger")} style={style}>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          aria-current={current || undefined}
          className={cx(
            "focus-ring group flex w-full items-center gap-3.5 px-4 py-3 text-left transition-colors duration-150 hover:bg-hover active:bg-selected",
            current && "bg-selected",
            className,
          )}
        >
          {body}
          <Icons.ChevronRight className="-mr-1 size-4 shrink-0 text-faint opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100" />
        </button>
      ) : (
        <div className={cx("flex items-center gap-3.5 px-4 py-3", className)}>{body}</div>
      )}
    </li>
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
 * (an earlier fact that fills the line on its own ends in "…" there).
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
    <span className={cx("block min-w-0 overflow-x-clip", end ? "-mr-1 pr-1" : "-ml-1 pl-1", className)}>
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
  className,
  children,
}: {
  tone?: keyof typeof NOTICE;
  icon?: ReactNode;
  title: ReactNode;
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  const { box, Icon } = NOTICE[tone];
  return (
    <div className={cx("flex items-start gap-3 rounded-xl px-4 py-3", box, className)}>
      <span className="mt-0.5 shrink-0">{icon ?? <Icon className="size-4" weight="bold" />}</span>
      <div className="min-w-0 flex-1">
        <div className="text-body font-semibold">{title}</div>
        {children && <div className="mt-0.5 text-small opacity-90">{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

const STAT_TONE = { neutral: "", success: "text-success-fg", warning: "text-warning-fg", danger: "text-danger-fg" } as const;

/** A figure read at a glance: IPK, SKS, absences left. */
export function Stat({
  label,
  value,
  hint,
  tone = "neutral",
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: keyof typeof STAT_TONE;
  className?: string;
}) {
  return (
    <div className={cx("rounded-xl border border-edge bg-surface px-4 py-3.5 shadow-card", className)}>
      <div className="text-small font-medium text-muted">{label}</div>
      <div className={cx("mt-1 text-[26px] leading-8 font-semibold tracking-[-0.02em] tabular-nums", STAT_TONE[tone])}>{value}</div>
      {hint && <div className="mt-0.5 text-small text-muted">{hint}</div>}
    </div>
  );
}
