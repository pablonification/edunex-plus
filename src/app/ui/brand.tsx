// The marks people already know: Edunex's and SIX's own logos wherever the
// app stands for one of them (connecting, its status, its account), and
// Edunex Plus's own icon (assets/icon.png) for the app itself. The ITB
// calendar has no logo of its own here: a calendar stands for it.
import type { SourceId } from "../../core/models";
import appIcon from "../assets/edunex-plus.png";
import edunexLogo from "../assets/edunex.png";
import sixLogo from "../assets/six.png";
import { cx } from "./cx";
import { Icons } from "./icons";

/** A source's logo as a small rounded tile; size it with `className` ("size-9"). */
export function SourceLogo({ source, className }: { source: SourceId; className?: string }) {
  if (source === "six") return <img src={sixLogo} alt="" aria-hidden draggable={false} className={cx("shrink-0 rounded-[22%]", className)} />;
  return (
    <span
      aria-hidden
      className={cx(
        "grid shrink-0 place-items-center overflow-hidden rounded-[24%]",
        // Edunex's elephant sits on white in both themes, like its own site.
        source === "edunex" ? "bg-white ring-1 ring-black/10 ring-inset" : "bg-(--source-itb-bg) text-(--source-itb-fg)",
        className,
      )}
    >
      {source === "edunex" ? <img src={edunexLogo} alt="" draggable={false} className="size-[84%] object-contain" /> : <Icons.Calendar className="size-[55%]" weight="bold" />}
    </span>
  );
}

/** Edunex Plus's own icon. */
export function AppMark({ className }: { className?: string }) {
  return <img src={appIcon} alt="" aria-hidden draggable={false} className={cx("shrink-0", className)} />;
}
