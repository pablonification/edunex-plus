// The marks people already know: Edunex's and SIX's own logos wherever the
// app stands for one of them (connecting, its status, its account), and
// Edunex Plus's own icon (assets/icon.png) for the app itself. The ITB
// calendar has no logo of its own here: a calendar stands for it. LINE's and
// GitHub's marks where a problem report goes to them (Simple Icons, CC0: the
// marks are LY Corporation's and GitHub's, used as their guidelines allow).
import type { SourceId } from "../../core/models";
import edunexLogo from "../assets/edunex.png";
import appIcon from "../assets/edunex-plus.png";
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
      {source === "edunex" ? (
        <img src={edunexLogo} alt="" draggable={false} className="size-[84%] object-contain" />
      ) : (
        <Icons.Calendar className="size-[55%]" weight="bold" />
      )}
    </span>
  );
}

/** Edunex Plus's own icon. */
export function AppMark({ className }: { className?: string }) {
  return <img src={appIcon} alt="" aria-hidden draggable={false} className={cx("shrink-0", className)} />;
}

/** LINE's mark from Simple Icons: its speech bubble, with "LINE" cut out of it. */
const LINE_BUBBLE =
  "M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314";
/** GitHub's mark from Simple Icons. */
const GITHUB_MARK =
  "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12";

/**
 * LINE's app icon as LINE draws it: the white bubble on a LINE-green rounded square, in full colour
 * in both themes, unaltered (line.me/en/logo). Size it with `className` (at least 20 px).
 */
export function LineLogo({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 32 32" className={cx("shrink-0", className)}>
      <rect width="32" height="32" rx="7.5" fill="#06C755" />
      <path d={LINE_BUBBLE} fill="#fff" transform="translate(5 5.5) scale(0.9167)" />
    </svg>
  );
}

/** GitHub's mark, in the text's colour (GitHub allows it in black or white). */
export function GitHubMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={cx("shrink-0", className)}>
      <path d={GITHUB_MARK} fill="currentColor" />
    </svg>
  );
}
