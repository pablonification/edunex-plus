// The guide ("Panduan"): a short tour of the window for a new Student. After
// their first sign-in, once the app has opened, it offers itself from the
// app's mark ("Mulai panduan" or "Lewati panduan"). Each step then points at
// one part of the window (the sidebar's places, the course list, search, the
// bell, Settings) with a ring, says in a sentence what it's for, and opens
// that place, so the Student reads about it while seeing it. It's a quiet
// card with no scrim, under any dialog, and the window stays usable around
// it: only its own buttons and Escape end it. "Lewati panduan" and Escape
// leave at any step. Settings › Tentang starts it again, at its first step.
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { type ReactNode, type RefObject, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { StringKey } from "../../core/strings";
import { useTermCourses } from "../courses";
import { useT } from "../i18n";
import { type Route, useNav } from "../nav";
import { useStore } from "../store";
import { AppMark } from "../ui/brand";
import { Button } from "../ui/controls";
import { cx } from "../ui/cx";
import { ignoreClosingClick } from "../ui/overlays";
import { isBuilt } from "./built";

/** A part of the window the guide points at: its element carries `data-guide` with this name (shell.tsx). */
type Part = "intro" | "tasks" | "presence" | "courses" | "home" | "search" | "alerts" | "settings";

interface Step {
  part: Exclude<Part, "intro">;
  title: StringKey;
  body: StringKey;
  /** Where the card hangs from its part. */
  side: "right" | "bottom";
  align: "start" | "end";
  /** The place the window opens meanwhile (a course: the term's first), or null to leave it as it is. */
  shows: (course: string | null) => Route | null;
}

/** The places first, each opened as it's told, ending on Beranda, which gathers them; then the tools around them. */
const STEPS: readonly Step[] = [
  { part: "tasks", title: "nav.tasks", body: "guide.tasks.body", side: "right", align: "start", shows: () => ({ screen: "tasks" }) },
  { part: "presence", title: "nav.presence", body: "guide.presence.body", side: "right", align: "start", shows: () => ({ screen: "presence" }) },
  {
    part: "courses",
    title: "nav.courses",
    body: "guide.courses.body",
    side: "right",
    align: "start",
    shows: (code) => (code ? { screen: "course", code } : null),
  },
  { part: "home", title: "nav.home", body: "guide.home.body", side: "right", align: "start", shows: () => ({ screen: "home" }) },
  { part: "search", title: "guide.search.title", body: "guide.search.body", side: "bottom", align: "end", shows: () => null },
  { part: "alerts", title: "alerts.title", body: "guide.alerts.body", side: "bottom", align: "end", shows: () => null },
  { part: "settings", title: "nav.settings", body: "guide.settings.body", side: "right", align: "end", shows: () => null },
];

/**
 * `start`: "offer" asks first, from the app's mark (after a first sign-in); "tour" goes straight to the first step
 * (Settings). `hidden`: a dialog is open over the window, so the card steps aside until it closes, where it was.
 * `onEnd`: the Student finished it, or left it (`finished` false).
 */
export function Guide({ start, hidden, onEnd }: { start: "offer" | "tour"; hidden: boolean; onEnd: (finished: boolean) => void }) {
  const t = useT();
  const mac = useStore().platform === "darwin";
  const { go } = useNav();
  const courses = useTermCourses();
  const course = isBuilt({ screen: "course", code: "" }) ? (courses?.[0]?.code ?? null) : null;
  // Without a course this term, there's no list to point at.
  const steps = STEPS.filter((step) => step.part !== "courses" || course);
  const [at, setAt] = useState<Part>(start === "offer" ? "intro" : steps[0].part);
  // A step whose part has gone meanwhile (the term's courses) gives way to the first.
  const step = at === "intro" ? null : (steps.find((step) => step.part === at) ?? steps[0]);
  const index = step ? steps.indexOf(step) : -1;

  const show = useCallback(
    (part: Exclude<Part, "intro">) => {
      setAt(part);
      const route = STEPS.find((step) => step.part === part)?.shows(course);
      if (route) go(route, { keep: true });
    },
    [go, course],
  );
  // Started from Settings: the first step's place opens with it.
  const began = useRef(false);
  useEffect(() => {
    if (began.current) return;
    began.current = true;
    if (start === "tour") show(steps[0].part);
  }, [start, show, steps]);

  const anchor = usePart(step?.part ?? "intro", hidden);
  const end = (finished: boolean) => {
    // The keyboard carries on from the top of the screen it ends on, never from the window's start.
    const title = document.querySelector<HTMLElement>("main h1");
    if (title) {
      title.tabIndex = -1;
      title.focus({ preventScroll: true });
    }
    onEnd(finished);
  };

  if (!step)
    return (
      <Card part="intro" anchor={hidden ? null : anchor} side="right" align="start" onSkip={() => end(false)}>
        {({ titleId, bodyId, primary }) => (
          <>
            <h2 id={titleId} className="flex items-center gap-2 text-body font-semibold text-pretty">
              <AppMark className="size-5" />
              {t("guide.intro.title")}
            </h2>
            <p id={bodyId} className="mt-1.5 text-small text-pretty text-muted">
              {t("guide.intro.body", { count: steps.length })}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => end(false)}>
                {t("guide.skip")}
              </Button>
              <Button ref={primary} size="sm" variant="primary" onClick={() => show(steps[0].part)}>
                {t("guide.start")}
              </Button>
            </div>
          </>
        )}
      </Card>
    );

  const last = index === steps.length - 1;
  return (
    <Card part={step.part} anchor={hidden ? null : anchor} side={step.side} align={step.align} onSkip={() => end(false)} counted>
      {({ titleId, bodyId, counterId, primary }) => (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <h2 id={titleId} className="text-body font-semibold text-pretty">
              {t(step.title)}
            </h2>
            <span id={counterId} className="shrink-0 text-caption text-faint tabular-nums">
              {t("guide.step", { step: index + 1, count: steps.length })}
            </span>
          </div>
          <p id={bodyId} className="mt-1 text-small text-pretty text-muted">
            {t(step.body, { keys: mac ? "⌘K" : "Ctrl+K" })}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="ghost" className="mr-auto -ml-2" onClick={() => end(false)}>
              {t("guide.skip")}
            </Button>
            {index > 0 && (
              <Button size="sm" onClick={() => show(steps[index - 1].part)}>
                {t("action.back")}
              </Button>
            )}
            <Button ref={primary} size="sm" variant="primary" onClick={() => (last ? end(true) : show(steps[index + 1].part))}>
              {t(last ? "guide.done" : "guide.next")}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

/**
 * The element of `part` (shell.tsx marks it with `data-guide`), brought into view (the sidebar scrolls, zoomed in),
 * and ringed while a step points at it. Not the intro's: it hangs from the app's mark, which isn't a control.
 */
function usePart(part: Part, hidden: boolean): HTMLElement | null {
  // Found for its own part only: a new step's card never opens, even for a frame, at the last step's part.
  const [found, setFound] = useState<{ part: Part; element: HTMLElement | null } | null>(null);
  useLayoutEffect(() => {
    const found = document.querySelector<HTMLElement>(`[data-guide="${part}"]`);
    setFound({ part, element: found });
    if (!found || hidden) return;
    found.scrollIntoView?.({ block: "nearest" });
    if (part === "intro") return;
    found.dataset.guideOn = "";
    return () => {
      delete found.dataset.guideOn;
    };
  }, [part, hidden]);
  return found?.part === part ? found.element : null;
}

/**
 * The guide's card, hanging from its part: a dialog that doesn't hold the window. A click or focus elsewhere leaves it
 * open, Escape leaves the guide. Each step is a card of its own, growing from its part, with focus on its main button.
 */
function Card({
  part,
  anchor,
  side,
  align,
  counted = false,
  onSkip,
  children,
}: {
  part: Part;
  /** Null while it steps aside (a dialog is open) or before its part is found. */
  anchor: HTMLElement | null;
  side: "right" | "bottom";
  align: "start" | "end";
  /** It says which step it is ("2 dari 7"), read out after its title. */
  counted?: boolean;
  onSkip: () => void;
  children: (ids: { titleId: string; bodyId: string; counterId: string; primary: RefObject<HTMLButtonElement | null> }) => ReactNode;
}) {
  const id = useId();
  const ids = { titleId: `${id}-title`, bodyId: `${id}-body`, counterId: `${id}-step` };
  const primary = useRef<HTMLButtonElement>(null);
  const keep = (event: Event) => event.preventDefault();
  return (
    <PopoverPrimitive.Root key={part} open={anchor !== null}>
      {anchor && <PopoverPrimitive.Anchor virtualRef={{ current: anchor }} />}
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          data-guide-card={part}
          aria-labelledby={ids.titleId}
          aria-describedby={counted ? `${ids.counterId} ${ids.bodyId}` : ids.bodyId}
          side={side}
          align={align}
          sideOffset={10}
          collisionPadding={12}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            primary.current?.focus();
          }}
          // Focus goes where the guide sends it (its next card, or the screen's title as it ends), never back and forth.
          onCloseAutoFocus={keep}
          onInteractOutside={keep}
          onEscapeKeyDown={onSkip}
          onClickCapture={ignoreClosingClick}
          // Under any dialog (Settings, search, the first-run scan), as the window's other quiet card is.
          className={cx(
            "no-drag z-(--z-float) w-80 max-w-(--radix-popover-content-available-width) origin-(--radix-popover-content-transform-origin) rounded-xl border border-edge bg-raised p-4 text-fg shadow-pop focus:outline-none",
            "motion-safe:data-[state=open]:animate-popover-in motion-safe:data-[state=closed]:animate-popover-out",
          )}
        >
          {children({ ...ids, primary })}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
