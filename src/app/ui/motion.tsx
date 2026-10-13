// Motion that explains a change: when a figure the Student is watching
// changes (the IPK after picking another grade, absences left after a new
// count), it glows for a moment so the eye finds what moved. The value
// itself changes at once; only the glow animates, and not with reduced motion.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "./cx";

/** Wraps a figure; glows briefly whenever `value` changes (not on first show). */
export function Flash({ value, className, children }: { value: unknown; className?: string; children: ReactNode }) {
  const first = useRef(true);
  const previous = useRef(value);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (Object.is(previous.current, value)) return;
    previous.current = value;
    setOn(true);
    const timer = setTimeout(() => setOn(false), 900);
    return () => clearTimeout(timer);
  }, [value]);
  return (
    <span
      className={cx(
        "-mx-1 rounded-md px-1 motion-safe:transition-colors motion-safe:duration-700",
        on ? "bg-[color-mix(in_oklab,var(--accent)_16%,transparent)]" : "bg-transparent",
        className,
      )}
    >
      {children}
    </span>
  );
}
