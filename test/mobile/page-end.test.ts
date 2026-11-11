// Where a scrolling page ends at the foot of the screen (mobile/src/ui/page-end.ts): the one answer `Page` and every
// screen with a list of its own use. An iPhone's tab bar and home indicator are drawn over the page, so the page runs
// under them and its last row ends clear; Android's three buttons get a strip the page never scrolls into.
import { describe, expect, it } from "vitest";
import { IOS_TAB_BAR, pageEnd, tabBarHeight } from "../../mobile/src/ui/page-end";

describe("pageEnd", () => {
  it("on an iPhone's tab, leaves the tab bar's room under the last row and scrolls to the screen's edge", () => {
    // The tab's own safe area: the bar (49) over the home indicator (34).
    expect(pageEnd({ os: "ios", inTabs: true, bottom: 83 })).toEqual({ strip: 0, room: 83 });
  });

  it("on an iPhone's pushed page, scrolls under the home indicator and ends clear of it: padding, never a cut", () => {
    expect(pageEnd({ os: "ios", inTabs: false, bottom: 34 })).toEqual({ strip: 0, room: 34 });
    expect(pageEnd({ os: "ios", inTabs: false, bottom: 34, toFoot: false })).toEqual({ strip: 0, room: 34 });
  });

  it("on an iPhone with a home button, has nothing to leave on a pushed page", () => {
    expect(pageEnd({ os: "ios", inTabs: false, bottom: 0 })).toEqual({ strip: 0, room: 0 });
  });

  it("on Android's tab, leaves nothing: the tabs sit under the page", () => {
    expect(pageEnd({ os: "android", inTabs: true, bottom: 0 })).toEqual({ strip: 0, room: 0 });
  });

  it("on Android over the tabs, stops the scrolling above three-button navigation", () => {
    expect(pageEnd({ os: "android", inTabs: false, bottom: 48 })).toEqual({ strip: 48, room: 0 });
  });

  it("on Android with a bar of the screen's own under the page, pads instead of cutting", () => {
    expect(pageEnd({ os: "android", inTabs: false, bottom: 48, toFoot: false })).toEqual({ strip: 0, room: 48 });
  });

  it("on Android with gesture navigation, runs under the handle and ends clear of it", () => {
    expect(pageEnd({ os: "android", inTabs: false, bottom: 24 })).toEqual({ strip: 0, room: 24 });
    expect(pageEnd({ os: "android", inTabs: false, bottom: 0 })).toEqual({ strip: 0, room: 0 });
  });
});

describe("tabBarHeight", () => {
  it("is Material's navigation bar on Android and iOS's tab bar on an iPhone", () => {
    expect(tabBarHeight("android")).toBe(80);
    expect(tabBarHeight("ios")).toBe(IOS_TAB_BAR);
    expect(IOS_TAB_BAR).toBe(49);
  });
});
