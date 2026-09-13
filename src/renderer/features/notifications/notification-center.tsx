import { Badge } from "@/components/ui/badge";
import { Chip } from "@/components/ui/chip";
import { formatTimestamp } from "../feeds/feed-data";
import type { InAppNotification } from "@shared/notifications";
import { useNotifications } from "./use-notifications";

export interface NotificationCenterProps {
  entries: InAppNotification[];
  loading: boolean;
  onOpenTask: (taskId: string) => void;
  onOpenTodo: () => void;
  onOpenAgenda: () => void;
  onMarkAllRead: () => void;
}

/** Wired panel: reads the fallback feed and forwards opens to the shell. */
export function NotificationCenterPanel({
  onOpenTask,
  onOpenTodo,
  onOpenAgenda,
}: {
  onOpenTask: (taskId: string) => void;
  onOpenTodo: () => void;
  onOpenAgenda: () => void;
}) {
  const { entries, loading, markAllRead } = useNotifications();
  return (
    <div className="mt-10">
      <NotificationCenter
        entries={entries}
        loading={loading}
        onOpenTask={onOpenTask}
        onOpenTodo={onOpenTodo}
        onOpenAgenda={onOpenAgenda}
        onMarkAllRead={() => void markAllRead()}
      />
    </div>
  );
}

/**
 * The in-app fallback feed (#23, extended by #24): every OS notification
 * leaves a trace here, newest first, so a missed or failed popup is still
 * checkable. Built free-tier from Badge/Chip — the BoardUI Notification
 * Center block's list shape, not a Pro component. Presence-open entries
 * render with a Presence chip and land on the agenda.
 */
export function NotificationCenter({
  entries,
  loading,
  onOpenTask,
  onOpenTodo,
  onOpenAgenda,
  onMarkAllRead,
}: NotificationCenterProps) {
  const unread = entries.filter((entry) => !entry.read).length;

  return (
    <section aria-label="Notification Center" className="min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 px-1">
        <div>
          <p className="text-caption-1-semibold uppercase tracking-[0.08em] text-text-tertiary">
            Fallback feed
          </p>
          <h2 className="mt-1 text-[20px] font-semibold tracking-tight text-text-primary">
            Notification Center
            {unread > 0 && (
              <Badge className="ml-2 align-middle" color="primary">
                {unread} new
              </Badge>
            )}
          </h2>
        </div>
        {unread > 0 && (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="shrink-0 rounded-md px-2 py-1 text-[13px] font-medium text-text-secondary outline-none transition-colors duration-150 hover:bg-background-secondary-default hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            Mark all read
          </button>
        )}
      </div>

      <div className="mt-3 rounded-xl bg-background-secondary-default/80 p-2">
        {loading ? (
          <p className="px-2 py-8 text-center text-[13px] text-text-tertiary">
            Loading notifications…
          </p>
        ) : entries.length === 0 ? (
          <p className="px-2 py-8 text-center text-[13px] text-text-tertiary">
            No notifications yet — new tasks and presence windows will appear here.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {entries.map((entry) => (
              <NotificationRow
                key={entry.id}
                entry={entry}
                onOpenTask={onOpenTask}
                onOpenTodo={onOpenTodo}
                onOpenAgenda={onOpenAgenda}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function NotificationRow({
  entry,
  onOpenTask,
  onOpenTodo,
  onOpenAgenda,
}: {
  entry: InAppNotification;
  onOpenTask: (taskId: string) => void;
  onOpenTodo: () => void;
  onOpenAgenda: () => void;
}) {
  const isPresence = entry.kind === "presence" || (entry.presenceIds?.length ?? 0) > 0;
  const isDigest = !isPresence && entry.taskIds.length > 1;
  const handleOpen = () => {
    if (isPresence) {
      onOpenAgenda();
      return;
    }
    if (!isDigest && entry.taskIds.length === 1) onOpenTask(entry.taskIds[0]);
    else onOpenTodo();
  };

  const ariaLabel = isPresence
    ? `Open agenda for ${entry.body}`
    : isDigest
      ? `Open To Do for ${entry.title}`
      : `Open task ${entry.body}`;

  return (
    <li>
      <button
        type="button"
        onClick={handleOpen}
        aria-label={ariaLabel}
        className="block w-full cursor-pointer rounded-lg bg-background-primary-default p-3.5 text-left shadow-sm outline-none transition-[background-color,box-shadow] duration-150 hover:bg-background-primary-hover hover:shadow-md focus-visible:ring-2 focus-visible:ring-border-focus-ring"
      >
        <span className="flex items-center gap-2">
          {!entry.read && (
            <span
              className="size-2 shrink-0 rounded-full bg-accent-500"
              aria-label="Unread"
              role="status"
            />
          )}
          <Chip
            color={isPresence ? "lime" : isDigest ? "purple" : "blue"}
            variant="caption"
          >
            {isPresence ? "Presence" : isDigest ? `${entry.taskIds.length} tasks` : "Task"}
          </Chip>
          <span className="truncate text-caption-1-semibold text-text-secondary">
            {entry.title}
          </span>
          <time
            className="ml-auto shrink-0 text-caption-1-regular text-text-tertiary"
            dateTime={entry.createdAt}
          >
            {formatTimestamp(entry.createdAt)}
          </time>
        </span>
        <span className="mt-1.5 block truncate text-[13px] font-medium leading-5 text-text-primary">
          {entry.body}
        </span>
      </button>
    </li>
  );
}
