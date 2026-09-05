import { AppSidebar } from "./components/app-sidebar";
import { TasksView } from "./features/tasks/tasks-view";

// App shell per the #8 BoardUI revision: floating sidebar + floating content
// panel on the grey canvas (first working evidence: prototype/submit-ux-spike).
export function App() {
  return (
    <div className="flex min-h-screen gap-3 bg-[#e9eaec] p-3">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto rounded-3xl border border-white bg-white p-8 shadow-sidebar">
        <TasksView />
      </main>
    </div>
  );
}
