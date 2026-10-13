// Keeps a child on screen after it has left its list, until it has played its
// way out (React would drop it at once). The kit's PresenceList and the toasts
// use it; each child reads usePresence() and hands its element to `exit` when
// it starts to leave.
//
// A leaving child stays where it was among the others, with the last element
// it was given. If it comes back before it has gone, it is the same element
// (and DOM node) again. A child that doesn't play a way out (an empty-state
// row, anything that isn't a PresenceItem) goes at once.
import {
  Children,
  createContext,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useCallback,
  useContext,
  useLayoutEffect,
  useReducer,
  useRef,
} from "react";
import { leave } from "./animate";

/** Plays a child's way out, or takes it away at once; returns a stop for its effect's cleanup. */
type Exit = (element: HTMLElement) => (() => void) | undefined;

const PresenceContext = createContext<{ exit?: Exit } | null>(null);

/**
 * Inside a Presence: `exit` is set from the moment this child starts to leave
 * (and unset again if it comes back first). Call it from a layout effect with
 * the child's element and return what it returns. Null outside a Presence.
 */
export function usePresence() {
  return useContext(PresenceContext);
}

interface Shown {
  key: string;
  element: ReactElement;
  exit?: Exit;
}

export function Presence({
  children,
  atOnce,
}: {
  children: ReactNode;
  /** Given how many children left and joined in this change, whether those leaving go at once (a whole list swapped). */
  atOnce?: (leaving: number, joining: number) => boolean;
}) {
  const present = Children.toArray(children).filter(isValidElement);
  const keys = new Set(present.map((child) => child.key ?? ""));
  const shown = useRef<Shown[]>([]);
  /** The keys present at the last change. */
  const before = useRef(keys);
  /** Children that have played their way out, to drop on the next render. */
  const gone = useRef(new Set<string>());
  /** Leaving children that are playing their way out (they called exit). */
  const playing = useRef(new Set<string>());
  const [, update] = useReducer((count: number) => count + 1, 0);

  const onGone = useCallback((key: string) => {
    gone.current.add(key);
    update();
  }, []);

  const leaving = [...before.current].filter((key) => !keys.has(key)).length;
  const joining = [...keys].filter((key) => !before.current.has(key)).length;
  const swap = atOnce?.(leaving, joining) ?? false;
  const exitFor =
    (key: string): Exit =>
    (element) => {
      playing.current.add(key);
      const stop = swap ? null : leave(element, () => onGone(key));
      if (!stop) onGone(key);
      return stop ?? undefined;
    };

  // The children now, in their order, with each one still leaving put back after the one it followed.
  const next: Shown[] = [];
  const placed = new Set<string>();
  let at = 0;
  const placeUpTo = (key: string | null) => {
    while (at < present.length) {
      const child = present[at++];
      const childKey = child.key ?? "";
      if (!placed.has(childKey)) next.push({ key: childKey, element: child });
      placed.add(childKey);
      if (childKey === key) return;
    }
  };
  for (const row of shown.current) {
    if (keys.has(row.key)) {
      if (!placed.has(row.key)) placeUpTo(row.key);
    } else if (!gone.current.has(row.key)) {
      next.push({ ...row, exit: row.exit ?? exitFor(row.key) });
    }
  }
  placeUpTo(null);

  // After the children's own layout effects, so every leaving child that plays its way out has started.
  useLayoutEffect(() => {
    shown.current = next;
    before.current = keys;
    const stillLeaving = new Set(next.flatMap((row) => (row.exit ? [row.key] : [])));
    for (const key of gone.current) if (!stillLeaving.has(key)) gone.current.delete(key);
    for (const key of playing.current) if (!stillLeaving.has(key)) playing.current.delete(key);
    for (const key of stillLeaving) if (!playing.current.has(key) && !gone.current.has(key)) onGone(key);
  });

  return next.map((row) => (
    <PresenceContext.Provider key={row.key} value={{ exit: row.exit }}>
      {row.element}
    </PresenceContext.Provider>
  ));
}

/** Children of a Presence child see no Presence of their own: a nested list doesn't leave with its row. */
export function NoPresence({ children }: { children: ReactNode }) {
  return <PresenceContext.Provider value={null}>{children}</PresenceContext.Provider>;
}
