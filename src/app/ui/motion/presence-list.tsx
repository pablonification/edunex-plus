// A row that leaves a list because of what the Student just did (snoozed,
// handed in, dismissed) fades, then the rows below close the gap, so the list
// never jumps. Rows that join appear at once, and a change of the whole list
// (another filter, a refresh: rows joining and leaving together, or more than
// three leaving) swaps at once too: only the Student's own small changes move.
// Focus never falls off the page: if it was in the leaving row, it moves to
// the same control in the next row (or the one before, or the list), and a
// menu or dialog opened from that row gives focus back there when it closes.
//
// Made with the Web Animations API. T3 Code fades a leaving row too, but slides
// the rows below it with transforms, which leaves whatever is under the list
// jumping; here the row's own height closes instead (one element, clipped
// while it moves), so everything below follows. With Reduce motion rows come
// and go at once.
//
// Use: <List><PresenceList>{rows.map((row) => <PresenceItem key={row.id}>…</PresenceItem>)}</PresenceList></List>.
// Outside a PresenceList, a PresenceItem is a plain <li>, so a kit Row can
// always render one.
import { type CSSProperties, createContext, type ReactNode, useContext, useLayoutEffect, useRef } from "react";
import { cx } from "../cx";
import { NoPresence, Presence, usePresence } from "./presence";

const InPresenceList = createContext(false);

/** Another filter or a refresh (rows joining and leaving together, or more than three leaving) swaps at once. */
const wholeListChanged = (leaving: number, joining: number) => leaving > 3 || (leaving > 0 && joining > 0);

export function PresenceList({ children }: { children: ReactNode }) {
  return (
    <InPresenceList.Provider value={true}>
      <Presence atOnce={wholeListChanged}>{children}</Presence>
    </InPresenceList.Provider>
  );
}

interface ItemProps {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export function PresenceItem({ className, style, children }: ItemProps) {
  const inList = useContext(InPresenceList);
  if (!inList)
    return (
      <li className={className} style={style}>
        {children}
      </li>
    );
  return (
    <MovingItem className={className} style={style}>
      {children}
    </MovingItem>
  );
}

const FOCUSABLE = "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])";

/** For each control of a leaving row, where focus goes instead: kept after the row is gone, for a menu that opened from it. */
const standIns = new WeakMap<HTMLElement, HTMLElement>();

/**
 * Focus is going back to a control that has left with its row, or is leaving
 * (a menu item that snoozed its own row): put it where it would have gone had
 * it been in the row. False, and nothing done, for any other control.
 */
export function focusInsteadOf(control: HTMLElement): boolean {
  if (control.isConnected && !control.closest("[data-leaving]")) return false;
  let instead = standIns.get(control);
  // The row it would have gone to may have left since, too: on to where that one sent its focus.
  for (let hop = 0; hop < 50 && instead && (!instead.isConnected || instead.closest("[data-leaving]")); hop++) instead = standIns.get(instead);
  if (!instead?.isConnected) return false;
  if (!instead.matches(FOCUSABLE) && !instead.hasAttribute("tabindex")) instead.setAttribute("tabindex", "-1");
  instead.focus();
  return true;
}

/** The same control in the next row that stays, else the one before, else the list itself. */
function findStandIns(item: HTMLElement) {
  const staying = (step: "nextElementSibling" | "previousElementSibling"): HTMLElement | null => {
    let next = item[step];
    while (next && (!(next instanceof HTMLElement) || next.hasAttribute("data-leaving"))) next = next[step];
    return next as HTMLElement | null;
  };
  const neighbour = [staying("nextElementSibling"), staying("previousElementSibling")].find((row) => row?.querySelector(FOCUSABLE));
  const targets = neighbour ? [...neighbour.querySelectorAll<HTMLElement>(FOCUSABLE)] : [];
  const list = item.parentElement;
  for (const [place, control] of [...item.querySelectorAll<HTMLElement>(FOCUSABLE)].entries()) {
    const instead = targets[place] ?? targets[0] ?? list;
    if (instead) standIns.set(control, instead);
  }
}

function MovingItem({ className, style, children }: ItemProps) {
  const ref = useRef<HTMLLIElement>(null);
  const exit = usePresence()?.exit;
  const leaving = exit !== undefined;
  useLayoutEffect(() => {
    const item = ref.current;
    if (!item) return;
    // Back before it had gone (the change was undone): a full row again.
    if (!exit) {
      item.inert = false;
      return;
    }
    findStandIns(item);
    if (document.activeElement instanceof HTMLElement && item.contains(document.activeElement)) focusInsteadOf(document.activeElement);
    // Leaving: no longer clickable, focusable or read out while it fades. Set here, after the focus
    // has moved: as a prop, React would make the row inert first and drop the focus on the page.
    item.inert = true;
    return exit(item);
  }, [exit]);
  return (
    <li
      ref={ref}
      // data-leaving marks every leaving row before any of them hands on focus. Clipped only while
      // it shrinks, so a focus ring around the row shows the rest of the time.
      data-leaving={leaving ? "" : undefined}
      className={cx(leaving && "overflow-clip", className)}
      style={style}
    >
      <NoPresence>{children}</NoPresence>
    </li>
  );
}
