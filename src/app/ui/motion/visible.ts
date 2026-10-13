// Loops (loading placeholders, live dots) rest where no one can see them, as
// T3 Code's do: one shared IntersectionObserver marks a loop that is
// off-screen (data-offscreen), and one visibilitychange listener marks a
// hidden window (html[data-hidden]); styles.css pauses their animations.
// Where there is no IntersectionObserver (jsdom), a loop is never marked
// off-screen.

let observer: IntersectionObserver | undefined;
let watchingWindow = false;

function offScreenObserver(): IntersectionObserver | undefined {
  observer ??=
    typeof IntersectionObserver === "function"
      ? new IntersectionObserver((entries) => {
          for (const entry of entries) entry.target.toggleAttribute("data-offscreen", !entry.isIntersecting);
        })
      : undefined;
  return observer;
}

function watchWindow() {
  if (watchingWindow) return;
  watchingWindow = true;
  const mark = () => document.documentElement.toggleAttribute("data-hidden", document.hidden);
  document.addEventListener("visibilitychange", mark);
  mark();
}

/** A ref for an element with `data-loop`: its animation pauses while it is off-screen or the window is hidden. */
export function pauseUnseen(element: HTMLElement | null): (() => void) | undefined {
  if (!element) return;
  watchWindow();
  const watcher = offScreenObserver();
  watcher?.observe(element);
  return () => watcher?.unobserve(element);
}
