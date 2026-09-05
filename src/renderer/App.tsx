import { useEffect, useState } from "react";
import { AppSidebar } from "./components/app-sidebar";
import { SystemPanel } from "./features/shell/system-panel";
import { navItem, type NavKey } from "./nav";

/**
 * App shell (#32): flush sidebar + content panel under a hidden titlebar
 * (macOS) — the sidebar runs to the window's top edge and holds the traffic
 * lights, the way native macOS apps do. On Windows/Linux the standard frame
 * stays and the layout is identical minus the drag regions. Views are
 * placeholders naming the slice each surface lands in — no EduNex data or
 * auth in the shell.
 */
export function App() {
  const [activeKey, setActiveKey] = useState<NavKey>("home");
  const active = navItem(activeKey);

  useEffect(() => window.edunex.onNavigate((view) => setActiveKey(view as NavKey)), []);

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar activeKey={activeKey} onSelect={setActiveKey} />
      <main className="flex min-w-0 flex-1 flex-col border-l border-separator-border bg-background-primary-default">
        <header className="app-drag flex h-12 shrink-0 items-center gap-2 border-b border-separator-border px-4">
          <h1 className="text-title-3-bold">{active.label}</h1>
          <span className="app-no-drag ml-auto text-caption-1-regular text-text-tertiary">
            Edunex Plus {window.edunex.version}
          </span>
        </header>
        <div className="flex-1 overflow-y-auto p-6">
          <p className="max-w-prose text-body-regular text-text-secondary">
            {active.placeholder}
          </p>
          {activeKey === "home" && <SystemPanel />}
        </div>
      </main>
    </div>
  );
}
