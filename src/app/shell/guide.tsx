// The guide ("Panduan"): a tour of the window for a new Student, page by page
// and part by part. After their first sign-in, once the app has opened, it
// offers itself from the app's mark ("Mulai panduan" or "Lewati panduan").
// Then, in the sidebar's order, it opens each place (Beranda, Tugas & Ujian,
// Jadwal, Presensi, Nilai, Rencana studi, a course) and points at its parts
// one at a time, ending on the menus and tools around them, back on Beranda.
// Each step dims the window except its part, and its card says what the part
// is for and how to use it. The window waits while it runs. A part its page
// doesn't show right now (no class today, no course this term) is passed
// over. "Lewati panduan" and Escape leave at any step, a dialog opened over it
// (⌘K, ⌘,) puts it aside until it closes, and Settings › Tentang starts it again.
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { type ReactNode, type RefObject, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { StringKey } from "../../core/strings";
import { useTermCourses } from "../courses";
import { useT } from "../i18n";
import { type Route, useNav } from "../nav";
import { useStore } from "../store";
import { AppMark } from "../ui/brand";
import { Button } from "../ui/controls";
import { cx } from "../ui/cx";
import { ProgressBar } from "../ui/display";
import { ignoreClosingClick } from "../ui/overlays";
import { isBuilt } from "./built";

type Chapter = "home" | "tasks" | "schedule" | "presence" | "grades" | "plan" | "course" | "tools";
type Side = "top" | "right" | "bottom" | "left";
/** What a card can hang from: an element, or a point worked out from one. */
type Measurable = { getBoundingClientRect(): DOMRect };

/** Each chapter's name over its cards, and the place it opens (a course: the term's first, or none, and it's passed over). */
const CHAPTERS: Record<Chapter, { name: StringKey; shows: (course: string | null) => Route | null }> = {
  home: { name: "nav.home", shows: () => ({ screen: "home" }) },
  tasks: { name: "nav.tasks", shows: () => ({ screen: "tasks" }) },
  schedule: { name: "nav.schedule", shows: () => ({ screen: "schedule" }) },
  presence: { name: "nav.presence", shows: () => ({ screen: "presence" }) },
  grades: { name: "nav.grades", shows: () => ({ screen: "grades" }) },
  plan: { name: "nav.plan", shows: () => ({ screen: "plan" }) },
  course: { name: "nav.courses", shows: (code) => (code ? { screen: "course", code } : null) },
  tools: { name: "guide.tools", shows: () => ({ screen: "home" }) },
};

interface Step {
  chapter: Chapter;
  /** Its words are guide.<chapter>.<part>.title and .body. */
  part: string;
  /** What it points at, once its chapter's place is on screen: a part the screen marks with `data-guide`, or a section by its title. */
  target: string;
  /** Where its card goes: beside the part where there's room (in the dimmed part of the window), else over or under it. */
  side: Side;
  align: "start" | "end";
}

const section = (id: string) => `main section[aria-labelledby${id.endsWith("-") ? "^" : ""}="${id}"]`;

const STEPS: readonly Step[] = [
  { chapter: "home", part: "now", target: section("home-now"), side: "bottom", align: "start" },
  { chapter: "home", part: "today", target: section("home-today"), side: "right", align: "start" },
  { chapter: "home", part: "needs", target: section("home-needs"), side: "left", align: "start" },
  { chapter: "home", part: "changes", target: section("home-changes"), side: "left", align: "start" },
  { chapter: "home", part: "courses", target: section("home-courses"), side: "top", align: "start" },
  { chapter: "tasks", part: "show", target: '[data-guide="tasks-show"]', side: "bottom", align: "end" },
  { chapter: "tasks", part: "row", target: section("tasks-"), side: "bottom", align: "start" },
  { chapter: "schedule", part: "view", target: '[data-guide="schedule-view"]', side: "bottom", align: "end" },
  { chapter: "schedule", part: "grid", target: '[data-guide="schedule-grid"]', side: "bottom", align: "end" },
  { chapter: "presence", part: "targets", target: "[data-targets-trigger]", side: "bottom", align: "end" },
  { chapter: "presence", part: "now", target: '[data-guide="presence-now"]', side: "bottom", align: "start" },
  { chapter: "presence", part: "row", target: `${section("presence-")} li`, side: "bottom", align: "start" },
  { chapter: "grades", part: "standing", target: '[data-guide="grades-standing"]', side: "bottom", align: "start" },
  { chapter: "grades", part: "term", target: section("this-term"), side: "top", align: "start" },
  { chapter: "plan", part: "tabs", target: "main [role=tablist]", side: "bottom", align: "start" },
  { chapter: "course", part: "list", target: '[data-guide="courses"]', side: "right", align: "start" },
  { chapter: "course", part: "tabs", target: "main [role=tablist]", side: "bottom", align: "start" },
  { chapter: "course", part: "modules", target: "main [role=tabpanel][data-state=active]", side: "top", align: "start" },
  { chapter: "tools", part: "nav", target: '[data-guide="nav"]', side: "right", align: "start" },
  { chapter: "tools", part: "search", target: '[data-guide="search"]', side: "bottom", align: "end" },
  { chapter: "tools", part: "alerts", target: '[data-guide="alerts"]', side: "bottom", align: "end" },
  { chapter: "tools", part: "status", target: '[data-guide="status"]', side: "bottom", align: "end" },
  { chapter: "tools", part: "settings", target: '[data-guide="settings"]', side: "right", align: "end" },
];

/** The offer hangs from the app's mark. */
const MARK = '[data-guide="intro"]';
/** How long a part its page hasn't drawn yet is waited for, before the step is passed over. */
const WAIT = 400;
/** The room the lit part gets around it, in px. */
const ROOM = 6;
/** The height the card needs above or below its part, in px: a part taller than the window less this has it inside. */
const CARD_ROOM = 260;

/** The place `route` names is on screen (a course in any tab). */
const showing = (on: Route, route: Route) => on.screen === route.screen && (route.screen !== "course" || (on.screen === "course" && on.code === route.code));

/**
 * `start`: "offer" asks first, from the app's mark (after a first sign-in); "tour" goes straight to the first step
 * (Settings). `hidden`: a dialog is open over the window, so the guide steps aside until it closes, where it was.
 * `onEnd`: the Student finished it, or left it (`finished` false).
 */
export function Guide({ start, hidden, onEnd }: { start: "offer" | "tour"; hidden: boolean; onEnd: (finished: boolean) => void }) {
  const t = useT();
  const mac = useStore().platform === "darwin";
  const nav = useNav();
  const courses = useTermCourses();
  const course = isBuilt({ screen: "course", code: "" }) ? (courses?.[0]?.code ?? null) : null;
  // -1: the offer.
  const [at, setAt] = useState(start === "offer" ? -1 : 0);
  /** Which way the Student is going, to pass over a part that isn't there. */
  const [way, setWay] = useState<1 | -1>(1);
  const step = at < 0 ? null : STEPS[at];
  const route = useMemo(() => (step ? CHAPTERS[step.chapter].shows(course) : null), [step, course]);
  const there = route !== null && showing(nav.route, route);

  const go = (to: number, toward: 1 | -1) => {
    if (to >= STEPS.length) return onEnd(true);
    // Back from the first part there is: it stays.
    if (to < 0) return;
    setWay(toward);
    setAt(to);
  };
  const passOver = useLatest(() => go(at + way < 0 ? at + 1 : at + way, at + way < 0 ? 1 : way));

  // Its chapter's place opens with it, as the sidebar opens it (a place already shown stays as it is).
  const { go: open } = nav;
  useEffect(() => {
    if (!step) return;
    if (route) open(route, { keep: true });
    else passOver();
  }, [step, route, open, passOver]);

  const target = useTarget(step ? (there ? step.target : null) : MARK, at, passOver);
  const rect = useRect(hidden ? null : target);
  // A part too tall for the card above or below it (the week's grid) has it just inside its bottom corner, in view.
  const crowded = step !== null && rect !== null && (step.side === "top" || step.side === "bottom") && rect.height > window.innerHeight - CARD_ROOM;
  const hang = useMemo(() => (target && crowded ? insideCorner(target) : target), [target, crowded]);
  useLayoutEffect(() => {
    if (!target || hidden) return;
    bringIntoView(target);
    // Marks the part the step is about.
    target.dataset.guideOn = "";
    return () => {
      delete target.dataset.guideOn;
    };
  }, [target, hidden]);

  if (hidden) return null;
  const skip = () => onEnd(false);
  const keys = { search: mac ? "⌘K" : "Ctrl+K", places: mac ? "⌘1–⌘6" : "Ctrl+1–6" };
  return (
    <>
      <Scrim rect={rect} />
      {target && !step && (
        <Card key="offer" anchor={target} side="right" align="start" onSkip={skip}>
          {({ titleId, bodyId, primary }) => (
            <>
              <h2 id={titleId} className="flex items-center gap-2 text-body font-semibold text-pretty">
                <AppMark className="size-5" />
                {t("guide.intro.title")}
              </h2>
              <p id={bodyId} className="mt-1.5 text-small text-pretty text-muted">
                {t("guide.intro.body")}
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={skip}>
                  {t("guide.skip")}
                </Button>
                <Button ref={primary} size="sm" variant="primary" onClick={() => go(0, 1)}>
                  {t("guide.start")}
                </Button>
              </div>
            </>
          )}
        </Card>
      )}
      {hang && step && (
        <Card key={at} anchor={hang} side={crowded ? "top" : step.side} align={crowded ? "end" : step.align} onSkip={skip} counted>
          {({ titleId, bodyId, counterId, primary }) => {
            const inChapter = STEPS.filter((other) => other.chapter === step.chapter && (other === step || document.querySelector(other.target)));
            return (
              <>
                <ProgressBar value={(at + 1) / STEPS.length} label={t("guide.progress")} />
                <div className="mt-3 flex items-baseline justify-between gap-3 text-caption">
                  <span className="font-semibold text-muted">{t(CHAPTERS[step.chapter].name)}</span>
                  <span id={counterId} className="shrink-0 text-faint tabular-nums">
                    {t("guide.step", { step: inChapter.indexOf(step) + 1, count: inChapter.length })}
                  </span>
                </div>
                <h2 id={titleId} className="mt-0.5 text-body font-semibold text-pretty">
                  {t(`guide.${step.chapter}.${step.part}.title` as StringKey)}
                </h2>
                <p id={bodyId} className="mt-1 text-small text-pretty text-muted">
                  {t(`guide.${step.chapter}.${step.part}.body` as StringKey, { keys: step.part === "nav" ? keys.places : keys.search })}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="ghost" className="mr-auto -ml-2" onClick={skip}>
                    {t("guide.skip")}
                  </Button>
                  {at > 0 && (
                    <Button size="sm" onClick={() => go(at - 1, -1)}>
                      {t("action.back")}
                    </Button>
                  )}
                  <Button ref={primary} size="sm" variant="primary" onClick={() => go(at + 1, 1)}>
                    {t(at === STEPS.length - 1 ? "guide.done" : "guide.next")}
                  </Button>
                </div>
              </>
            );
          }}
        </Card>
      )}
    </>
  );
}

/** A function that's always the latest one given, under one identity (for effects that call it). */
function useLatest<A extends unknown[]>(fn: (...args: A) => void): (...args: A) => void {
  const latest = useRef(fn);
  latest.current = fn;
  return useMemo(
    () =>
      (...args: A) =>
        latest.current(...args),
    [],
  );
}

/**
 * The element `selector` finds for step `key`, or null while there's nothing to look for. One its screen hasn't drawn
 * yet is waited for a moment, then `missing` is called. Found for its own step only: a new step's card never opens,
 * even for a frame, at the last step's part.
 */
function useTarget(selector: string | null, key: number, missing: () => void): HTMLElement | null {
  const [found, setFound] = useState<{ key: number; element: HTMLElement } | null>(null);
  useLayoutEffect(() => {
    if (!selector) return;
    const look = () => document.querySelector<HTMLElement>(selector);
    const now = look();
    if (now) {
      setFound({ key, element: now });
      return;
    }
    const observer = new MutationObserver(() => {
      const element = look();
      if (!element) return;
      stop();
      setFound({ key, element });
    });
    const timer = setTimeout(() => {
      stop();
      missing();
    }, WAIT);
    const stop = () => {
      observer.disconnect();
      clearTimeout(timer);
    };
    observer.observe(document.body, { childList: true, subtree: true });
    return stop;
  }, [selector, key, missing]);
  return found?.key === key ? found.element : null;
}

/** Where `element` is in the window, kept up to date as it moves or changes size. */
function useRect(element: HTMLElement | null): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    if (!element) {
      setRect(null);
      return;
    }
    let frame = 0;
    const read = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setRect(element.getBoundingClientRect()));
    };
    setRect(element.getBoundingClientRect());
    const resized = new ResizeObserver(read);
    resized.observe(element);
    window.addEventListener("resize", read);
    window.addEventListener("scroll", read, true);
    return () => {
      cancelAnimationFrame(frame);
      resized.disconnect();
      window.removeEventListener("resize", read);
      window.removeEventListener("scroll", read, true);
    };
  }, [element]);
  return rect;
}

/** A point just inside `element`'s bottom right corner, where it's in view: a card hangs over it from there. */
function insideCorner(element: HTMLElement): Measurable {
  return {
    getBoundingClientRect: () => {
      const rect = element.getBoundingClientRect();
      return DOMRect.fromRect({ x: rect.right - 16, y: Math.min(rect.bottom, window.innerHeight) - 16, width: 0, height: 0 });
    },
  };
}

/** The part comes into view: on the screen, in the middle when it fits there, else from its top; elsewhere, just in. */
function bringIntoView(element: HTMLElement) {
  const main = element.closest("main");
  const block = !main ? "nearest" : element.getBoundingClientRect().height <= main.clientHeight * 0.55 ? "center" : "start";
  element.scrollIntoView?.({ block });
}

/**
 * The window dimmed but for the part the step is about, ringed, and taking no clicks: the guide's card is the one
 * thing to use while it runs. Before the part is found (its screen still opening), all of it is dimmed.
 */
function Scrim({ rect }: { rect: DOMRect | null }) {
  return createPortal(
    <div aria-hidden className="no-drag fixed inset-0 z-(--z-float) overflow-hidden motion-safe:animate-fade-in">
      {rect ? (
        <div
          data-guide-lit=""
          className="guide-lit pointer-events-none absolute rounded-xl"
          style={{ top: rect.top - ROOM, left: rect.left - ROOM, width: rect.width + 2 * ROOM, height: rect.height + 2 * ROOM }}
        />
      ) : (
        <div className="absolute inset-0 bg-scrim" />
      )}
    </div>,
    document.body,
  );
}

/**
 * The guide's card, hanging from its part: a dialog that holds the window (focus stays in it, the rest isn't read
 * out). Escape leaves the guide. Each step is a card of its own, growing from its part, with focus on its main button.
 */
function Card({
  anchor,
  side,
  align,
  counted = false,
  onSkip,
  children,
}: {
  anchor: Measurable;
  side: Side;
  align: "start" | "end";
  /** It says which step it is ("2 dari 5"), read out after its title. */
  counted?: boolean;
  onSkip: () => void;
  children: (ids: { titleId: string; bodyId: string; counterId: string; primary: RefObject<HTMLButtonElement | null> }) => ReactNode;
}) {
  const id = useId();
  const ids = { titleId: `${id}-title`, bodyId: `${id}-body`, counterId: `${id}-step` };
  const primary = useRef<HTMLButtonElement>(null);
  const keep = (event: Event) => event.preventDefault();
  return (
    <PopoverPrimitive.Root open modal>
      <PopoverPrimitive.Anchor virtualRef={{ current: anchor }} />
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          data-guide-card=""
          aria-labelledby={ids.titleId}
          aria-describedby={counted ? `${ids.counterId} ${ids.bodyId}` : ids.bodyId}
          side={side}
          align={align}
          sideOffset={ROOM + 10}
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
          // Over its own dimming, under any dialog (Settings, search), as the window's other quiet card is.
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
