// Interactive controls: buttons, the switch, the stepper, the segmented control. Every
// control has a visible keyboard focus and a name screen readers can read.
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { type ButtonHTMLAttributes, type KeyboardEvent, type ReactNode, type Ref, useRef } from "react";
import { cx } from "./cx";
import { Icons } from "./icons";
import { SlidingHighlight } from "./motion/sliding-highlight";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary: "bg-accent text-on-accent shadow-button hover:bg-accent-hover active:bg-accent-active",
  secondary: "border border-edge bg-surface text-fg hover:bg-hover",
  ghost: "text-muted hover:bg-hover hover:text-fg",
  danger: "border border-edge bg-surface text-danger-fg hover:bg-danger-bg",
};

const SIZE: Record<Size, string> = {
  sm: "h-7 gap-1 rounded-md px-2.5 text-small font-medium",
  md: "h-8 gap-1.5 rounded-lg px-3 text-small font-semibold",
  lg: "h-10 gap-2 rounded-lg px-5 text-body font-semibold",
};

/**
 * A button answers a press by sinking to 97%. Not a menu or popover trigger (Radix gives those
 * aria-haspopup; Tailwind has no variant for it), and not one that is aria-disabled.
 */
const PRESS =
  "transition-[color,background-color,border-color,box-shadow,scale] duration-150 [&:active:not([aria-haspopup]):not([aria-disabled=true])]:scale-[0.97]";

/**
 * Dimmed while it can't run (aria-disabled): unlike `disabled`, it keeps focus, so a keyboard user who
 * pressed it, or stepped to its limit, isn't dropped to the page. A click there does nothing.
 */
const LIMIT = "aria-disabled:pointer-events-none aria-disabled:opacity-50";
/** The same for an icon button, which keeps its tooltip at a limit (a zoom or stepper button). */
const ICON_LIMIT = "aria-disabled:opacity-50 aria-disabled:hover:bg-transparent aria-disabled:hover:text-muted";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner and takes no clicks while an action runs; focus stays on it. */
  busy?: boolean;
  icon?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  variant = "secondary",
  size = "md",
  busy = false,
  icon,
  className,
  children,
  disabled,
  type = "button",
  onClick,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      aria-disabled={busy || undefined}
      aria-busy={busy || undefined}
      onClick={(event) => {
        // A second press (Enter held, a double click) while it works does nothing, a form's submit included.
        if (busy) event.preventDefault();
        else onClick?.(event);
      }}
      className={cx(
        "focus-ring inline-flex shrink-0 items-center justify-center whitespace-nowrap select-none disabled:pointer-events-none disabled:opacity-50",
        LIMIT,
        PRESS,
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    >
      {busy ? <Icons.Loader className="size-3.5 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** What the button does, for screen readers and the tooltip. */
  label: string;
  size?: "sm" | "md";
  ref?: Ref<HTMLButtonElement>;
}

export function IconButton({ label, size = "md", className, children, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cx(
        "focus-ring grid shrink-0 place-items-center rounded-lg text-muted hover:bg-hover hover:text-fg disabled:pointer-events-none disabled:opacity-50",
        ICON_LIMIT,
        PRESS,
        size === "sm" ? "size-7" : "size-8",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={label}
      disabled={disabled}
      // Calm when on (ink, not accent): a settings list of ten switches must not shout.
      className="focus-ring relative inline-flex h-5 w-[34px] shrink-0 items-center rounded-full bg-field-edge transition-colors duration-150 disabled:opacity-50 data-[state=checked]:bg-fg"
    >
      <SwitchPrimitive.Thumb className="block size-4 translate-x-[2px] rounded-full bg-white shadow-thumb transition-transform duration-150 ease-standard data-[state=checked]:translate-x-4 data-[state=checked]:bg-surface" />
    </SwitchPrimitive.Root>
  );
}

/** "− 80% +": a number stepped between bounds; the value is read out when it changes. */
export function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  format = String,
  lowerLabel,
  raiseLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
  /** What − and + do, for screen readers ("Lower the target"). */
  lowerLabel: string;
  raiseLabel: string;
}) {
  const set = (next: number) => onChange(Math.max(min, Math.min(max, next)));
  return (
    <div className="inline-flex h-8 shrink-0 items-center rounded-lg border border-edge bg-surface">
      <IconButton size="sm" label={lowerLabel} aria-disabled={value <= min || undefined} onClick={() => set(value - step)} className="rounded-r-none">
        <Icons.Minus className="size-3.5" />
      </IconButton>
      <span className="min-w-12 px-1 text-center text-small font-semibold tabular-nums" aria-live="polite">
        {format(value)}
      </span>
      <IconButton size="sm" label={raiseLabel} aria-disabled={value >= max || undefined} onClick={() => set(value + step)} className="rounded-l-none">
        <Icons.Plus className="size-3.5" />
      </IconButton>
    </div>
  );
}

/**
 * A radio group of the screen's own buttons, as the keyboard expects one: only
 * the checked choice is a Tab stop (the first when none is, so the group stays
 * reachable), the arrow keys move the choice and the focus with it, and
 * clicking the checked choice keeps it. Spread `radio(index)` on each button.
 */
export function useRadioKeys<T>(values: readonly T[], value: T | null, onChange: (value: T) => void) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  // A null value is a choice where the group has one (the Tasks filter's "Semua"), else nothing picked.
  const checked = values.indexOf(value as T);
  const move = (from: number, step: number) => {
    const index = (from + step + values.length) % values.length;
    onChange(values[index]);
    buttons.current[index]?.focus();
  };
  return (index: number) => ({
    ref: (el: HTMLButtonElement | null) => {
      buttons.current[index] = el;
    },
    role: "radio" as const,
    "aria-checked": index === checked,
    tabIndex: index === Math.max(checked, 0) ? 0 : -1,
    onClick: () => onChange(values[index]),
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        move(index, 1);
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        move(index, -1);
      }
    },
  });
}

/**
 * A small set of mutually exclusive choices (theme, language, an IPK target).
 * Arrow keys move the choice; the highlight glides to it. `value` null: none
 * picked. An option's `name` is its button's name where the label alone is
 * too short ("3,50" read as "Target IPK 3,50").
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T | null;
  options: readonly { value: T; label: string; name?: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  const radio = useRadioKeys(
    options.map((option) => option.value),
    value,
    onChange,
  );
  return (
    <div role="radiogroup" aria-label={label} className="relative flex rounded-lg bg-fill p-0.5 ring-1 ring-black/[0.05] ring-inset dark:ring-white/[0.06]">
      {/* High contrast drops fills and shadows: an edge keeps the pick visible there. */}
      <SlidingHighlight active={value} className="rounded-md bg-segment shadow-thumb forced-colors:border-2" />
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          {...radio(index)}
          aria-label={option.name}
          data-highlight={option.value}
          className={cx(
            "focus-ring relative h-7 rounded-md px-3 text-small font-medium transition-colors duration-150",
            option.value === value ? "text-fg" : "text-muted hover:text-fg",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
