// The Modul tab: Edunex's table of contents (course-wide items, then each
// module, the joint class's after the class's own), and the selected entry's
// Tasks and materials. It opens on the newest module with something in it;
// empty modules take one quiet line. Each material type gets the one action
// that fits it: download, join, read here, open, or Edunex itself, all alike.
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  contentCounts,
  htmlText,
  type MaterialKind,
  materialAction,
  materialKind,
  newestWithContent,
  outlineEntries,
  uploadExtension,
  VICON_PROVIDERS,
} from "../../../core/course-materials";
import type { Material, Task } from "../../../core/models";
import { useOpenExternal } from "../../hooks";
import { type Translate, useFormat, useNow, useT } from "../../i18n";
import { useBridge } from "../../store";
import { Button } from "../../ui/controls";
import { cx } from "../../ui/cx";
import { EmptyState } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { List, Meta } from "../../ui/layout";
import { Tooltip, toast } from "../../ui/overlays";
import { RichText } from "../../ui/rich-text";
import { TaskRows } from "../tasks";
import { type CoursePage, isOpenTask } from "./data";

const INTRO = "intro";
const WEEK = 7 * 24 * 3_600_000;

interface Entry {
  id: string;
  label: string | null;
  title: string;
  parent: boolean;
  postedAt: number | null;
  tasks: Task[];
  materials: Material[];
}

const latest = (entry: Pick<Entry, "postedAt" | "materials">) =>
  Math.max(entry.postedAt ?? 0, ...entry.materials.map((m) => m.postedAt ?? m.updatedAt ?? 0)) || null;

/** "2 PDF", "4 tugas": what's in it; how many Tasks are still open shows as its own chip. */
const countFacts = (t: Translate, entry: Entry) =>
  contentCounts(entry.materials, entry.tasks.length).map(({ kind, count }) => t(`course.kind.${kind}`, { count }));

/** `module`: the Edunex module asked for (from search or an alert); it opens selected and in view. */
export function ModulesTab({ page, module }: { page: CoursePage; module?: number }) {
  const t = useT();
  const now = useNow();
  const { course, outline } = page;
  const materials = page.materials ?? [];
  const main = course.edunex?.courseId ?? -1;
  const known = new Set(outline?.modules.map((m) => m.id));
  const courseWide = {
    tasks: page.tasks.filter((task) => task.moduleId === null || !known.has(task.moduleId)),
    materials: materials.filter((m) => m.moduleId === null),
  };
  const entries: Entry[] = [
    ...(courseWide.tasks.length || courseWide.materials.length
      ? [{ id: INTRO, label: null, title: t("course.intro"), parent: false, postedAt: null, ...courseWide }]
      : []),
    ...(outline ? outlineEntries(outline, main) : []).map((entry) => ({
      id: String(entry.module.id),
      label: String(entry.number),
      title: entry.module.title,
      parent: entry.parent,
      postedAt: entry.module.postedAt,
      tasks: page.tasks.filter((task) => task.moduleId === entry.module.id),
      materials: materials.filter((m) => m.moduleId === entry.module.id),
    })),
  ];
  const first = entries[newestWithContent(entries.map((e) => ({ hasContent: e.tasks.length + e.materials.length > 0, at: latest(e), parent: e.parent })))];
  const [selected, setSelected] = useState<string | null>(module === undefined ? null : String(module));
  const active = entries.find((e) => e.id === selected) ?? first;
  const asked = module !== undefined && active?.id === String(module);
  const root = useRef<HTMLDivElement>(null);
  const shown = useRef(false);
  useEffect(() => {
    // Once, on arrival: the module asked for comes into view if it's below the fold; picking another later doesn't move the page.
    if (!asked || shown.current) return;
    // After the window puts a newly opened screen at its top.
    const frame = requestAnimationFrame(() => {
      shown.current = true;
      root.current?.querySelector("[aria-current=true]")?.scrollIntoView?.({ block: "nearest" });
      root.current?.querySelector("#course-entry")?.scrollIntoView?.({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [asked]);

  if (!active) return <EmptyState icon={<Icons.BookOpen className="size-5" />} title={t("course.noMaterials")} />;
  const firstParent = entries.findIndex((e) => e.parent);
  const anyContent = entries.some((e) => e.tasks.length || e.materials.length);

  return (
    <div ref={root} className="grid grid-cols-[260px_minmax(0,1fr)] gap-8 max-[1180px]:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label={t("course.contents")} className="self-start">
        <p className="mb-2 px-2 text-caption font-semibold tracking-[0.04em] text-faint uppercase">{t("course.contents")}</p>
        <ol className="space-y-0.5">
          {entries.map((entry, index) => {
            const isActive = entry.id === active.id;
            const open = entry.tasks.filter((task) => isOpenTask(task, now)).length;
            const empty = entry.tasks.length + entry.materials.length === 0;
            const fresh = !empty && (latest(entry) ?? 0) > now - WEEK;
            return (
              <li key={entry.id}>
                {index === firstParent && (
                  <p className="mt-4 mb-1 px-2 text-caption font-semibold tracking-[0.04em] text-faint uppercase">{t("course.jointClass")}</p>
                )}
                <button
                  type="button"
                  aria-current={isActive ? "true" : undefined}
                  onClick={() => setSelected(entry.id)}
                  className={cx(
                    "focus-ring flex w-full scroll-my-6 items-start gap-2.5 rounded-lg px-2 text-left transition-colors duration-150",
                    empty ? "py-1" : "py-2",
                    isActive ? "bg-selected" : "hover:bg-hover",
                  )}
                >
                  <span
                    className={cx(
                      "grid shrink-0 place-items-center rounded-md font-semibold tabular-nums",
                      empty ? "mt-px size-5 text-micro text-faint" : "mt-px size-5 text-micro",
                      isActive ? "bg-accent text-on-accent" : empty ? "" : "bg-fill text-muted",
                    )}
                  >
                    {entry.label ?? <Icons.BookOpen className="size-3" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cx(
                        "line-clamp-2 leading-[1.35]",
                        empty ? "text-small text-muted" : "text-body",
                        !empty && (isActive ? "font-semibold" : "font-medium"),
                      )}
                    >
                      {entry.title}
                    </span>
                    {!empty && countFacts(t, entry).length > 0 && (
                      <Meta truncate className="mt-0.5 text-caption text-faint">
                        {countFacts(t, entry)}
                      </Meta>
                    )}
                  </span>
                  {(open > 0 || fresh) && (
                    <span className="mt-0.5 flex shrink-0 flex-col items-end gap-1">
                      {open > 0 && (
                        <Tooltip content={t("course.openTasksHint")}>
                          <span className="inline-flex h-[18px] items-center rounded-full bg-warning-bg px-1.5 text-micro font-semibold text-warning-fg">
                            {t("course.openTasks", { count: open })}
                          </span>
                        </Tooltip>
                      )}
                      {fresh && (
                        <Tooltip content={t("course.newHint")}>
                          <span className="inline-flex h-[18px] items-center rounded-full bg-info-bg px-1.5 text-micro font-semibold text-info-fg">
                            {t("course.new")}
                          </span>
                        </Tooltip>
                      )}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <section className="min-w-0" aria-labelledby="course-entry">
        <header className="mb-5">
          <p className="flex items-center gap-2 text-small font-semibold text-muted">
            <Meta>
              {active.id === INTRO ? t("course.courseWide") : t("course.module", { no: active.label ?? "" })}
              {active.parent ? <span className="font-normal text-faint">{t("course.jointClass")}</span> : null}
            </Meta>
            {active === first && anyContent && entries.length > 1 && (
              <span className="inline-flex h-[18px] items-center rounded-full bg-fill px-1.5 text-micro font-semibold text-muted">{t("course.newest")}</span>
            )}
          </p>
          <h2 id="course-entry" className="mt-1 text-heading font-semibold tracking-[-0.015em]">
            {active.title}
          </h2>
        </header>
        {active.tasks.length === 0 && active.materials.length === 0 ? (
          <p className="flex items-center gap-2 text-body text-muted">
            <Icons.Inbox className="size-4" />
            {t(anyContent ? "course.moduleEmpty" : "course.noMaterials")}
          </p>
        ) : (
          <div className="space-y-6">
            {active.tasks.length > 0 && (
              <div>
                <p className="mb-2 text-small font-semibold text-muted">{t("course.tasks")}</p>
                <TaskRows tasks={active.tasks} meta="none" label={t("course.tasks")} />
              </div>
            )}
            {active.materials.length > 0 && (
              <div>
                <p className="mb-2 text-small font-semibold text-muted">{t("course.materials")}</p>
                <List label={t("course.materials")}>
                  {active.materials.map((material) => (
                    <MaterialRow key={material.id} material={material} />
                  ))}
                </List>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

const KIND_ICON: Record<MaterialKind, (typeof Icons)[keyof typeof Icons]> = {
  pdf: Icons.FileText,
  vicon: Icons.Video,
  note: Icons.StickyNote,
  video: Icons.Video,
  audio: Icons.FileText,
  link: Icons.Link,
  file: Icons.Paperclip,
  interactive: Icons.Layers,
  other: Icons.BookOpen,
};

export function MaterialRow({ material }: { material: Material }) {
  const t = useT();
  const f = useFormat();
  const bridge = useBridge();
  const openExternal = useOpenExternal();
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const kind = materialKind(material.type);
  const action = materialAction(material);
  const Icon = KIND_ICON[kind];

  let meta: (string | null)[];
  const size = material.sizeBytes ? f.fileSize(material.sizeBytes) : null;
  const upload = uploadExtension(material.type);
  if (kind === "pdf") meta = [t("material.pdf"), size];
  else if (upload) meta = [upload.slice(1).toUpperCase(), size];
  else if (kind === "vicon")
    meta = [VICON_PROVIDERS[material.type] ? t("material.vicon", { service: VICON_PROVIDERS[material.type] }) : t("material.viconUnknown")];
  else if (kind === "note") meta = [htmlText(material.content ?? "").slice(0, 120) || t("material.note")];
  else meta = [t(`material.${kind}`), size];

  const download = async (url: string, name: string) => {
    setBusy(true);
    try {
      await bridge.invoke("files.download", { url, name });
      toast(t("material.downloaded"));
    } catch (error) {
      toast(t("error.action", { message: error instanceof Error ? error.message : String(error) }), "danger");
    } finally {
      setBusy(false);
    }
  };

  const named = (label: string) => `${label}: ${material.title}`;
  let button: ReactNode;
  switch (action.kind) {
    case "download":
      button = (
        <Button
          size="sm"
          busy={busy}
          icon={<Icons.Download className="size-3.5" />}
          aria-label={named(t("material.download"))}
          onClick={() => void download(action.url, action.name)}
        >
          {t("material.download")}
        </Button>
      );
      break;
    case "join":
      button = (
        <Button size="sm" icon={<Icons.ArrowUpRight className="size-3.5" />} aria-label={named(t("material.join"))} onClick={() => openExternal(action.url)}>
          {t("material.join")}
        </Button>
      );
      break;
    case "read":
      button = (
        <Button size="sm" aria-expanded={reading} aria-label={named(t(reading ? "material.hide" : "material.read"))} onClick={() => setReading(!reading)}>
          {t(reading ? "material.hide" : "material.read")}
          <Icons.ChevronDown className={cx("size-3.5 transition-transform duration-150", reading && "rotate-180")} />
        </Button>
      );
      break;
    case "open":
      button = (
        <Button size="sm" icon={<Icons.ArrowUpRight className="size-3.5" />} aria-label={named(t("material.open"))} onClick={() => openExternal(action.url)}>
          {t("material.open")}
        </Button>
      );
      break;
    default:
      button = (
        <Button
          size="sm"
          icon={<Icons.ArrowUpRight className="size-3.5" />}
          aria-label={named(t("action.openInEdunex"))}
          onClick={() => openExternal(action.url)}
        >
          {t("action.openInEdunex")}
        </Button>
      );
  }

  return (
    <li>
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-fill text-muted">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-medium">{material.title}</p>
          <Meta truncate className="mt-0.5 text-small text-muted">
            {meta}
          </Meta>
        </div>
        {material.updatedAt !== null && <span className="text-small whitespace-nowrap text-faint">{f.fromNow(material.updatedAt)}</span>}
        {/* One width for every action, so the dates beside them line up. */}
        <span className="flex w-[9.5rem] shrink-0 justify-end">{button}</span>
      </div>
      {reading && action.kind === "read" && (
        <div className="border-t border-line bg-fill/50 px-4 py-3.5">
          <RichText html={action.html} onOpenLink={openExternal} />
        </div>
      )}
    </li>
  );
}
