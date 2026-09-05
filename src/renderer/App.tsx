import { useEffect, useState } from "react";
import { AppSidebar } from "./components/app-sidebar";
import { SystemPanel } from "./features/shell/system-panel";
import { navItem } from "./nav";
import { cx } from "./utils/cx";
import type { NavKey } from "@shared/shell";

/**
 * App shell (#32), t3code-style native pass: flush sidebar + 52px topbar
 * aligned across the hairline, no boxed borders anywhere — hierarchy comes
 * from type weight, contrast and one hairline between rail and content.
 * macOS runs the hidden titlebar (traffic lights live in the sidebar
 * header); Windows/Linux keep the standard frame with the same layout minus
 * drag regions. Views are placeholders naming the slice each surface lands
 * in — no EduNex data or auth in the shell.
 */
export function App() {
  const [activeKey, setActiveKey] = useState<NavKey>("home");
  const active = navItem(activeKey);
  const isMac = window.edunex.platform === "darwin";

  useEffect(() => window.edunex.onNavigate(setActiveKey), []);

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar activeKey={activeKey} onSelect={setActiveKey} />
      <main className="flex min-w-0 flex-1 flex-col border-l border-black/[0.08] bg-background-primary-default">
        <header
          className={cx(
            "flex h-[52px] shrink-0 items-center gap-2 px-8",
            isMac && "app-drag",
          )}
        >
          <h1 className="text-[15px] font-semibold tracking-tight">{active.label}</h1>
          <span
            className={cx(
              "ml-auto text-caption-1-regular text-text-tertiary",
              isMac && "app-no-drag",
            )}
          >
            v{window.edunex.version}
          </span>
        </header>
        <div className="app-scrollbar flex-1 overflow-y-auto px-8 pb-10 pt-2">
          <p className="max-w-prose text-[13px] leading-5 text-text-secondary">
            {active.placeholder}
          </p>
          {activeKey === "home" && <SystemPanel />}
        </div>
      </main>
    </div>
  );
}
