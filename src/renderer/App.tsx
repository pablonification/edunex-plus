import { useState } from "react";
import { AppSidebar } from "./components/app-sidebar";
import { ShellStatusCard } from "./features/shell/shell-status-card";
import { navItem, type NavKey } from "./nav";

// App shell (#32) per the #8 BoardUI revision: floating sidebar + floating
// content panel on the grey canvas. Views are placeholders naming the slice
// each surface lands in — no EduNex data or auth in the shell.
export function App() {
  const [activeKey, setActiveKey] = useState<NavKey>("home");
  const active = navItem(activeKey);

  return (
    <div className="flex min-h-screen gap-3 bg-[#e9eaec] p-3">
      <AppSidebar activeKey={activeKey} onSelect={setActiveKey} />
      <main className="flex flex-1 flex-col overflow-y-auto rounded-3xl border border-white bg-white p-8 shadow-sidebar">
        <h1 className="text-title-1-bold">{active.label}</h1>
        <p className="mt-1 max-w-prose text-body-regular text-text-secondary">
          {active.placeholder}
        </p>
        {activeKey === "home" && <ShellStatusCard />}
      </main>
    </div>
  );
}
