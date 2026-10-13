// Joins class names, letting a later class win over an earlier one of the same
// kind ("text-muted" over "text-fg"), so components can take a className.
// tailwind-merge only knows Tailwind's own scale: every token the app adds in
// styles.css (@theme) is listed here, or it would read "shadow-card" as a
// shadow color and keep both "animate-pop-in" and "animate-popover-in".
import { extendTailwindMerge } from "tailwind-merge";

const merge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["micro", "caption", "small", "body", "lead", "title", "heading", "figure", "display"],
      shadow: ["button", "thumb", "card", "raised", "lift", "pop", "dialog"],
      animate: ["fade-in", "fade-out", "pop-in", "pop-out", "popover-in", "popover-out", "slide-down", "toast-in", "shimmer"],
      ease: ["standard", "out"],
      radius: ["tag"],
    },
  },
});

export function cx(...parts: (string | false | null | undefined)[]): string {
  return merge(parts.filter(Boolean).join(" "));
}
