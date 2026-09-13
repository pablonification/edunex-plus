import { useEffect, useState } from "react";
import { AppSidebar } from "./components/app-sidebar";
import { SystemPanel } from "./features/shell/system-panel";
import { FeaturesPanel } from "./features/shell/features-panel";
import { SettingsModal } from "./features/shell/settings-modal";
import { useShellSettings } from "./features/shell/use-shell-settings";
import { LoginView } from "./features/auth/login-view";
import { ReloginModal } from "./features/auth/relogin-modal";
import { useAuthState } from "./features/auth/use-auth-state";
import { AgendaPanel, DashboardPanel, ExamsPanel, TodoPanel } from "./features/feeds/feed-panels";
import { isTaskItem, toTodoItems, type TaskItem } from "./features/feeds/feed-data";
import { NotificationCenterPanel } from "./features/notifications/notification-center";
import { TaskPageShell } from "./features/tasks/task-page-shell";
import { navItem } from "./nav";
import { cx } from "./utils/cx";
import type { NavKey } from "@shared/shell";
import { notificationDestinationFor } from "@shared/notifications";

/**
 * App shell (#32), t3code-style native pass: flush sidebar + 52px topbar
 * aligned across the hairline, no boxed borders anywhere — hierarchy comes
 * from type weight, contrast and one hairline between rail and content.
 * macOS runs the hidden titlebar (traffic lights live in the sidebar
 * header); Windows/Linux keep the standard frame with the same layout minus
 * drag regions.
 *
 * Auth gating (#18): the shell holds back on a null status (startup restore
 * in flight), shows the embedded SSO webview while signed out or mid-login,
 * and lays the "please sign in again" modal over the paused shell when the
 * session has expired.
 */
export function App() {
  const [activeKey, setActiveKey] = useState<NavKey>("home");
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const authStatus = useAuthState();
  const shell = useShellSettings();
  const hiddenViews = shell.hiddenViews;
  // Hidden views (#22) leave navigation: a hidden active view falls back to
  // the pinned Home, and menu-driven navigation into a hidden view is ignored.
  const activeKeyVisible = shell.isHidden(activeKey) ? "home" : activeKey;
  const active = navItem(activeKeyVisible);
  const isMac = window.edunex.platform === "darwin";

  useEffect(
    () =>
      window.edunex.onNavigate((view) => {
        if ((hiddenViews as readonly string[]).includes(view)) return;
        setActiveKey(view);
        setSelectedTask(null);
      }),
    [hiddenViews],
  );

  // OS notification clicks (#23) focus the app in main and land here with
  // the covered task ids; the To Do screen (#21) is the destination, opening
  // the single task when there is exactly one.
  useEffect(
    () =>
      window.edunex.onNotificationClicked(({ taskIds }) => {
        const destination = notificationDestinationFor({ taskIds });
        if (destination.taskId) void openNotificationTask(destination.taskId);
        else {
          setActiveKey(destination.view);
          setSelectedTask(null);
        }
      }),
    [],
  );

  function selectView(view: NavKey) {
    setActiveKey(view);
    setSelectedTask(null);
  }

  function openTask(task: TaskItem) {
    setActiveKey("todo");
    setSelectedTask(task);
  }

  function openTodo() {
    setActiveKey("todo");
    setSelectedTask(null);
  }

  async function openNotificationTask(taskId: string) {
    setActiveKey("todo");
    setSelectedTask(null);
    try {
      const snapshot = await window.edunex.getFeed("todo");
      const found = toTodoItems(snapshot?.data).find((item) => item.id === taskId);
      if (found && isTaskItem(found)) setSelectedTask(found);
    } catch {
      // Stay on To Do when the cached feed can't be read.
    }
  }

  if (authStatus === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-background-primary-default">
        <p className="text-[13px] text-text-tertiary">Starting…</p>
      </div>
    );
  }

  const showLogin = authStatus === "signed-out" || authStatus === "authenticating";

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar
        activeKey={activeKeyVisible}
        onSelect={selectView}
        signedIn={authStatus === "signed-in"}
        hiddenViews={hiddenViews}
        onHideView={(view) => shell.setViewHidden(view, true)}
        onOpenFeatures={() => setFeaturesOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <main className="flex min-w-0 flex-1 flex-col border-l border-black/[0.08] bg-background-primary-default">
        <header
          className={cx(
            "flex h-[52px] shrink-0 items-center gap-2 px-8",
            isMac && "app-drag",
          )}
        >
          <h1 className="text-[15px] font-semibold tracking-tight">
            {showLogin ? "Sign in" : selectedTask ? "Task" : active.label}
          </h1>
          <span
            className={cx(
              "ml-auto text-caption-1-regular text-text-tertiary",
              isMac && "app-no-drag",
            )}
          >
            v{window.edunex.version}
          </span>
        </header>
        <div
          className={cx(
            "min-h-0 flex-1 px-8 pb-10 pt-2",
            showLogin ? "overflow-hidden" : "app-scrollbar overflow-y-auto",
          )}
        >
          {showLogin ? (
            <LoginView />
          ) : selectedTask ? (
            <TaskPageShell task={selectedTask} onBack={() => setSelectedTask(null)} />
          ) : (
            <>
              {activeKeyVisible === "home" && (
                <>
                  <DashboardPanel onTaskSelect={openTask} />
                  <NotificationCenterPanel onOpenTask={openNotificationTask} onOpenTodo={openTodo} />
                  <SystemPanel />
                </>
              )}
              {activeKeyVisible === "todo" && <TodoPanel onTaskSelect={openTask} />}
              {activeKeyVisible === "agenda" && <AgendaPanel />}
              {activeKeyVisible === "exams" && <ExamsPanel />}
              {activeKeyVisible !== "home" &&
                activeKeyVisible !== "todo" &&
                activeKeyVisible !== "agenda" &&
                activeKeyVisible !== "exams" && (
                <p className="max-w-prose text-[13px] leading-5 text-text-secondary">
                  {active.placeholder}
                </p>
              )}
            </>
          )}
        </div>
      </main>
      {authStatus === "session-expired" && <ReloginModal />}
      {featuresOpen && <FeaturesPanel shell={shell} onClose={() => setFeaturesOpen(false)} />}
      {settingsOpen && <SettingsModal shell={shell} onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
