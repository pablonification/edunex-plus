// Interactive controls: buttons, the switch, the stepper, the segmented control. Every
// control has a visible keyboard focus and a name screen readers can read.
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { type ButtonHTMLAttributes, type ReactNode, type Ref, useRef } from "react";
import { cx } from "./cx";
import { Icons } from "./icons";

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

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner and blocks clicks while an action runs. */
  busy?: boolean;
  icon?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({ variant = "secondary", size = "md", busy = false, icon, className, children, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cx(
        "focus-ring inline-flex shrink-0 items-center justify-center whitespace-nowrap select-none disabled:pointer-events-none disabled:opacity-50",
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
      className="focus-ring relative inline-flex h-5 w-[34px] shrink-0 items-center rounded-full bg-track transition-colors duration-150 disabled:opacity-50 data-[state=checked]:bg-fg"
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
      <IconButton size="sm" label={lowerLabel} disabled={value <= min} onClick={() => set(value - step)} className="rounded-r-none">
        <Icons.Minus className="size-3.5" />
      </IconButton>
      <span className="min-w-12 px-1 text-center text-small font-semibold tabular-nums" aria-live="polite">
        {format(value)}
      </span>
      <IconButton size="sm" label={raiseLabel} disabled={value >= max} onClick={() => set(value + step)} className="rounded-l-none">
        <Icons.Plus className="size-3.5" />
      </IconButton>
    </div>
  );
}

/** A small set of mutually exclusive choices (theme, language). Arrow keys move the choice. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (from: number, step: number) => {
    const index = (from + step + options.length) % options.length;
    onChange(options[index].value);
    buttons.current[index]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-lg bg-fill p-0.5 ring-1 ring-black/[0.05] ring-inset dark:ring-white/[0.06]">
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          // biome-ignore lint/a11y/useSemanticElements: a segmented control of styled buttons; the radio role and arrow keys are handled here
          <button
            key={option.value}
            ref={(el) => {
              buttons.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                event.preventDefault();
                move(index, 1);
              } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                event.preventDefault();
                move(index, -1);
              }
            }}
            className={cx(
              "focus-ring h-7 rounded-md px-3 text-small font-medium transition-colors duration-150",
              selected ? "bg-segment text-fg shadow-thumb" : "text-muted hover:text-fg",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
