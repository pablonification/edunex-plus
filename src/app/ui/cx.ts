// Joins class names, letting a later class win over an earlier one of the same
// kind ("text-muted" over "text-fg"), so components can take a className.
import { extendTailwindMerge } from "tailwind-merge";

const merge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["micro", "caption", "small", "body", "lead", "title", "heading", "display"],
      shadow: ["button", "thumb", "lift", "pop", "dialog"],
      animate: ["fade-in", "pop-in", "shimmer"],
      ease: ["standard"],
    },
  },
});

export function cx(...parts: (string | false | null | undefined)[]): string {
  return merge(parts.filter(Boolean).join(" "));
}
