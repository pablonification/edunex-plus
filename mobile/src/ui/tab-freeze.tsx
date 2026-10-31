// A tab not in front stops drawing (react-freeze, as react-native-screens' freezeOnBlur does for a
// stack): every tab is mounted ahead, so the switch is instant, but without this each one drew again on
// every change anywhere, the clock's minute tick among them (useFormat hangs on useNow), and a minute's
// tick across five tabs blocked the JS thread for 300–500 ms on `mid`. A tab draws once when it mounts
// (it's ready before its first visit), then waits while hidden and catches up the moment it's shown.
import { useIsFocused } from "expo-router";
import { type ReactNode, useEffect, useState } from "react";
import { Freeze } from "react-freeze";

export function TabFreeze({ children }: { children: ReactNode }) {
  const focused = useIsFocused();
  const [drawn, setDrawn] = useState(false);
  useEffect(() => setDrawn(true), []);
  return <Freeze freeze={drawn && !focused}>{children}</Freeze>;
}
