import type { KeyboardEvent, ReactNode } from "react";
import { cx } from "@/utils/cx";

export interface SegmentedControlOption {
  value: string;
  label: ReactNode;
  badge?: ReactNode;
}

export interface SegmentedControlProps {
  options: SegmentedControlOption[];
  value: string | null;
  onChange: (value: string) => void;
  ariaLabel: string;
}

/** BoardUI-style segmented control using the shared light/dark theme tokens. */
export function SegmentedControl({
  options,
  value,
  onChange,
  ariaLabel,
}: SegmentedControlProps) {
  return (
    <div
      className="app-scrollbar flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg bg-segmented-control-background p-1"
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected || (value === null && index === 0) ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => moveSelection(event, options, option.value, onChange)}
            className={cx(
              "inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-caption-1-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-border-focus-ring",
              selected
                ? "bg-segmented-control-selected-background text-text-primary shadow-xs"
                : "text-text-tertiary hover:bg-background-primary-hover hover:text-text-secondary",
            )}
          >
            <span>{option.label}</span>
            {option.badge !== undefined && (
              <span
                className={cx(
                  "rounded-sm px-1 py-px text-[10px] leading-4",
                  selected
                    ? "bg-accent-500/10 text-accent-600"
                    : "bg-background-tertiary-default text-text-tertiary",
                )}
              >
                {option.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function moveSelection(
  event: KeyboardEvent<HTMLButtonElement>,
  options: SegmentedControlOption[],
  currentValue: string,
  onChange: (value: string) => void,
) {
  if (options.length < 2) return;
  const currentIndex = options.findIndex((option) => option.value === currentValue);
  if (currentIndex < 0) return;

  let nextIndex: number | null = null;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    nextIndex = (currentIndex + 1) % options.length;
  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    nextIndex = (currentIndex - 1 + options.length) % options.length;
  } else if (event.key === "Home") {
    nextIndex = 0;
  } else if (event.key === "End") {
    nextIndex = options.length - 1;
  }
  if (nextIndex === null) return;

  event.preventDefault();
  const nextOption = options[nextIndex];
  onChange(nextOption.value);
  const tabs = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role='tab']");
  tabs?.[nextIndex]?.focus();
}
