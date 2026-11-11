// Where a scrolling page ends at the foot of the screen, per phone and place: one answer for every screen (`Page`
// in ./layout.tsx, and the few screens with a list of their own, through ./insets.ts's `usePageEnd`). No React
// Native in here, so the tests can ask it (test/mobile/page-end.test.ts).
//
// What sits at the screen's foot, and what the page does about it:
// - iPhone, a tab: iOS's own tab bar floats over the page (Liquid Glass on iOS 26, a translucent bar before), and the
//   page runs under it to the screen's edge. Its last row ends clear of the bar: the tab's own safe area (the bar and
//   the home indicator) as padding.
// - iPhone, a screen over the tabs: the home indicator is drawn over the page. The page scrolls to the screen's edge
//   under it, and its last row ends clear of it: padding, never a cut.
// - Android, a tab: the tabs' bar sits under the page, which already ends above it. Nothing to leave.
// - Android, over the tabs, three-button navigation: Back, Home and Recents are buttons with a scrim, and a row under
//   them can't be read or pressed (round 3, the real phone). The scrolling stops at the top of the bar: a strip of the
//   page's colour lies under the buttons.
// - Android, over the tabs, gesture navigation: the handle is a thin line drawn over the page, as the iPhone's is. The
//   page runs under it to the edge, and its last row ends clear of it (Material's edge to edge).

/** Android's three-button bar is 48 dp tall; gesture navigation's handle leaves 24 dp or less. Between the two. */
const BUTTONS_FROM = 40;

/** An iPhone's tab bar over the home indicator (UITabBar's 49 pt): the least a tab leaves, if iOS reports less. */
export const IOS_TAB_BAR = 49;

export interface PageEnd {
  /** How far above the screen's foot the scrolling stops (the page's colour fills it). 0: it scrolls to the edge. */
  strip: number;
  /** The room the content's end leaves under its last row for what's drawn over the page, past the page's own padding. */
  room: number;
}

export function pageEnd({
  os,
  inTabs,
  bottom,
  toFoot = true,
}: {
  os: string;
  /** Under the bottom tabs. */
  inTabs: boolean;
  /** The safe area's bottom where the page is: on an iPhone's tab, the tab's own (its bar and the home indicator). */
  bottom: number;
  /** Whether the page reaches the screen's foot (not with a bar of the screen's own under it, or the keyboard up). */
  toFoot?: boolean;
}): PageEnd {
  if (os === "ios") return { strip: 0, room: bottom };
  if (inTabs) return { strip: 0, room: 0 };
  if (toFoot && bottom >= BUTTONS_FROM) return { strip: bottom, room: 0 };
  return { strip: 0, room: bottom };
}

/** The tabs' bar's own height: Material 3's navigation bar with its labels shown, iOS's UITabBar. */
export function tabBarHeight(os: string): number {
  return os === "ios" ? IOS_TAB_BAR : 80;
}
