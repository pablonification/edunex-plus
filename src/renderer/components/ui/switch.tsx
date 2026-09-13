import { cx } from "@/utils/cx";

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

/**
 * BoardUI Switch (free tier): a labeled toggle built on the shared accent
 * and tertiary tokens. A real button with role="switch" so it works with
 * keyboard and assistive tech — no checkbox styling hacks.
 */
export function Switch({ checked, onChange, label, description, disabled }: SwitchProps) {
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative mt-0.5 h-5 w-9 shrink-0 rounded-full outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-border-focus-ring",
          checked ? "bg-accent-500" : "bg-background-tertiary-default",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        )}
      >
        <span
          aria-hidden
          className={cx(
            "absolute top-0.5 size-4 rounded-full bg-white shadow-xs transition-[left] duration-150",
            checked ? "left-[18px]" : "left-0.5",
          )}
        />
      </button>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium leading-5 text-text-primary">{label}</span>
        {description && (
          <span className="mt-0.5 block text-[12px] leading-4 text-text-secondary">
            {description}
          </span>
        )}
      </span>
    </div>
  );
}
