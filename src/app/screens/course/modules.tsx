// The Modul tab: EduNex's table of contents (course-wide items, then each
// module, the parent class's after the class's own), and the selected
// entry's Tasks and materials. Each material type gets the one action that
// fits it: download, join, read here, open, or EduNex itself.
import { useState } from "react";
import { htmlText, materialAction, materialKind, type MaterialKind, outlineEntries, uploadExtension, VICON_PROVIDERS } from "../../../core/course-materials";
import type { Material, Task } from "../../../core/models";
import { useOpenExternal } from "../../hooks";
import { useFormat, useNow, useT } from "../../i18n";
import { useBridge } from "../../store";
import { Button } from "../../ui/controls";
import { cx } from "../../ui/cx";
import { Card, EmptyState } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { toast } from "../../ui/overlays";
import { RichText } from "../../ui/rich-text";
import { type CoursePage, isOpenTask } from "./data";
import { TaskRows } from "./lists";

const INTRO = "intro";

interface Entry {
  id: string;
  label: string;
  title: string;
  parent: boolean;
  tasks: Task[];
  materials: Material[];
}

export function ModulesTab({ page }: { page: CoursePage }) {
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
      ? [{ id: INTRO, label: "·", title: t("course.intro"), parent: false, ...courseWide }]
      : []),
    ...(outline ? outlineEntries(outline, main) : []).map((entry) => ({
      id: String(entry.module.id),
      label: String(entry.number),
      title: entry.module.title,
      parent: entry.parent,
      tasks: page.tasks.filter((task) => task.moduleId === entry.module.id),
      materials: materials.filter((m) => m.moduleId === entry.module.id),
    })),
  ];
  const first = entries.find((e) => e.tasks.some((task) => isOpenTask(task, now))) ?? entries[0];
  const [selected, setSelected] = useState<string | null>(null);
  const active = entries.find((e) => e.id === selected) ?? first;

  if (!active) return <EmptyState icon={<Icons.BookOpen className="size-5" />} title={t("course.noMaterials")} />;
  const firstParent = entries.findIndex((e) => e.parent);

  return (
    <div className="grid grid-cols-[248px_minmax(0,1fr)] gap-8">
      <nav aria-label={t("course.contents")} className="self-start">
        <p className="mb-2 px-2 text-caption font-semibold tracking-[0.04em] text-faint uppercase">{t("course.contents")}</p>
        <ol className="space-y-0.5">
          {entries.map((entry, index) => {
            const isActive = entry.id === active.id;
            const open = entry.tasks.some((task) => isOpenTask(task, now));
            const count = entry.tasks.length + entry.materials.length;
            return (
              <li key={entry.id}>
                {index === firstParent && <p className="mt-4 mb-1 px-2 text-caption font-semibold tracking-[0.04em] text-faint uppercase">{t("course.parentClass")}</p>}
                <button
                  type="button"
                  aria-current={isActive ? "true" : undefined}
                  onClick={() => setSelected(entry.id)}
                  className={cx("focus-ring flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left transition-colors duration-150", isActive ? "bg-selected" : "hover:bg-hover")}
                >
                  <span
                    className={cx(
                      "mt-px grid size-5 shrink-0 place-items-center rounded-md text-micro font-semibold tabular-nums",
                      isActive ? "bg-accent text-on-accent" : "bg-fill text-muted",
                    )}
                  >
                    {entry.label}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cx("line-clamp-2 text-body leading-[1.35]", isActive ? "font-semibold" : "font-medium")}>{entry.title}</span>
                    <span className="mt-0.5 block text-caption text-faint">{count ? t("course.itemCount", { count }) : t("course.empty")}</span>
                  </span>
                  {open && (
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-danger-fg" role="img" aria-label={t("course.openTask")} />
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <section className="min-w-0" aria-labelledby="course-entry">
        <header className="mb-5">
          <p className="text-small font-semibold text-muted">
            {active.id === INTRO ? t("course.courseWide") : t("course.module", { no: active.label })}
            {active.parent && <span className="text-faint"> · {t("course.parentClass")}</span>}
          </p>
          <h2 id="course-entry" className="mt-1 text-heading font-semibold tracking-[-0.015em]">
            {active.title}
          </h2>
        </header>
        {active.tasks.length === 0 && active.materials.length === 0 ? (
          <EmptyState
            icon={<Icons.Inbox className="size-5" />}
            title={t(entries.some((e) => e.tasks.length || e.materials.length) ? "course.moduleEmpty" : "course.noMaterials")}
          />
        ) : (
          <div className="space-y-6">
            {active.tasks.length > 0 && (
              <div>
                <p className="mb-2 text-small font-semibold text-muted">{t("course.tasks")}</p>
                <TaskRows tasks={active.tasks} />
              </div>
            )}
            {active.materials.length > 0 && (
              <div>
                <p className="mb-2 text-small font-semibold text-muted">{t("course.materials")}</p>
                <Card className="overflow-hidden">
                  <ul>
                    {active.materials.map((material, index) => (
                      <MaterialRow key={material.id} material={material} first={index === 0} />
                    ))}
                  </ul>
                </Card>
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

export function MaterialRow({ material, first }: { material: Material; first: boolean }) {
  const t = useT();
  const f = useFormat();
  const bridge = useBridge();
  const openExternal = useOpenExternal();
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const kind = materialKind(material.type);
  const action = materialAction(material);
  const Icon = KIND_ICON[kind];

  let meta: string;
  const size = material.sizeBytes ? ` · ${f.fileSize(material.sizeBytes)}` : "";
  const upload = uploadExtension(material.type);
  if (kind === "pdf") meta = `${t("material.pdf")}${size}`;
  else if (upload) meta = `${upload.slice(1).toUpperCase()}${size}`;
  else if (kind === "vicon") meta = VICON_PROVIDERS[material.type] ? t("material.vicon", { service: VICON_PROVIDERS[material.type] }) : t("material.viconUnknown");
  else if (kind === "note") meta = htmlText(material.content ?? "").slice(0, 120) || t("material.note");
  else meta = `${t(`material.${kind}`)}${size}`;

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
  let button;
  switch (action.kind) {
    case "download":
      button = (
        <Button size="sm" busy={busy} icon={<Icons.Download className="size-3.5" />} aria-label={named(t("material.download"))} onClick={() => void download(action.url, action.name)}>
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
        <Button variant="ghost" size="sm" icon={<Icons.ArrowUpRight className="size-3.5" />} aria-label={named(t("action.openInEdunex"))} onClick={() => openExternal(action.url)}>
          {t("action.openInEdunex")}
        </Button>
      );
  }

  return (
    <li className={cx(!first && "border-t border-line")}>
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-fill text-muted">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-medium">{material.title}</p>
          <p className="mt-0.5 truncate text-small text-muted">{meta}</p>
        </div>
        {material.updatedAt !== null && <span className="text-small whitespace-nowrap text-faint">{f.fromNow(material.updatedAt)}</span>}
        {button}
      </div>
      {reading && action.kind === "read" && (
        <div className="border-t border-line bg-fill/50 px-4 py-3.5">
          <RichText html={action.html} onOpenLink={openExternal} />
        </div>
      )}
    </li>
  );
}
