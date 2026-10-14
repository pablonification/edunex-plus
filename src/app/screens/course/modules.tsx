// The Modul tab: Edunex's table of contents (each Edunex course's
// course-wide items as its Introduction, then every module Edunex lists, by
// Edunex's own number, the ones not opened yet greyed; the joint class's after
// the class's own), and the selected entry's Tasks and materials, drawn the way
// Edunex draws them: notes and pictures in full right on the page, a link by
// its own words, every other kind with the one action that fits it (download,
// join, open, or Edunex itself; a PDF reads in the app's viewer), all alike,
// each with who posted it and when. It opens on the newest module with
// something in it; empty modules take one quiet line.
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  contentCounts,
  edunexMaterialUrl,
  introModule,
  type MaterialKind,
  materialAction,
  materialKind,
  newestWithContent,
  outlineEntries,
  uploadExtension,
  VICON_PROVIDERS,
} from "../../../core/course-materials";
import { linkHost } from "../../../core/links";
import type { Material, Task } from "../../../core/models";
import { useOpenExternal, useOpenLink } from "../../hooks";
import { type Format, type Translate, useFormat, useNow, useT } from "../../i18n";
import { LecturerHtml, RemoteImage } from "../../lecturer-html";
import { canView, usePdfViewer } from "../../pdf";
import { useBridge } from "../../store";
import { Button, IconButton } from "../../ui/controls";
import { cx } from "../../ui/cx";
import { EmptyState, Tag } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { breakAfterSlashes, List, Meta } from "../../ui/layout";
import { Tooltip, toast } from "../../ui/overlays";
import { WebLink } from "../../ui/rich-text";
import { TaskRows } from "../tasks";
import { type CoursePage, isOpenTask } from "./data";

const WEEK = 7 * 24 * 3_600_000;

interface Entry {
  id: string;
  /** Edunex's number for a module; null for an Introduction. */
  label: string | null;
  title: string;
  /** An Edunex course's course-wide items. */
  intro: boolean;
  parent: boolean;
  /** Listed on Edunex but not opened yet by the lecturer: greyed, nothing to pick. */
  unopened: boolean;
  /** When Edunex opens it by itself, if the lecturer set a date. */
  opensAt: number | null;
  postedAt: number | null;
  tasks: Task[];
  materials: Material[];
}

const latest = (entry: Pick<Entry, "postedAt" | "materials">) =>
  Math.max(entry.postedAt ?? 0, ...entry.materials.map((m) => m.postedAt ?? m.updatedAt ?? 0)) || null;

/** "2 PDF", "4 tugas": what's in it; how many Tasks are still open shows as its own chip. */
const countFacts = (t: Translate, entry: Entry) =>
  contentCounts(entry.materials, entry.tasks.length).map(({ kind, count }) => t(`course.kind.${kind}`, { count }));

/**
 * The table of contents, Edunex course by Edunex course (the class's own,
 * then each joint class's): its Introduction, when it has course-wide items,
 * then every module Edunex lists, in Edunex's order. On Edunex these are
 * separate course pages, so an item in both courses (a schedule posted to
 * each) shows once under each.
 */
function contentsOf(page: CoursePage, t: Translate): Entry[] {
  const { course, outline } = page;
  const materials = page.materials ?? [];
  const main = course.edunex?.courseId ?? -1;
  const modules = outline ? outlineEntries(outline, main) : [];
  const known = new Set(modules.map((entry) => entry.module.id));
  const wideTasks = page.tasks.filter((task) => task.moduleId === null || !known.has(task.moduleId));
  const wideMaterials = materials.filter((m) => m.moduleId === null);
  const courseIds = [
    ...new Set([
      main,
      ...(course.edunex?.relatedCourseIds ?? []),
      ...modules.map((entry) => entry.module.courseId),
      ...(outline?.unopened ?? []).map((module) => module.courseId),
      ...wideMaterials.map((m) => m.courseId),
      ...wideTasks.map((task) => task.courseId),
    ]),
  ];
  return courseIds.flatMap((courseId): Entry[] => {
    const parent = courseId !== main;
    const intro = { tasks: wideTasks.filter((task) => task.courseId === courseId), materials: wideMaterials.filter((m) => m.courseId === courseId) };
    const opened = modules
      .filter((entry) => entry.module.courseId === courseId)
      .map((entry) => ({
        number: entry.number,
        id: String(entry.module.id),
        label: String(entry.number),
        title: entry.module.title,
        intro: false,
        parent,
        unopened: false,
        opensAt: null,
        postedAt: entry.module.postedAt,
        tasks: page.tasks.filter((task) => task.moduleId === entry.module.id),
        materials: materials.filter((m) => m.moduleId === entry.module.id),
      }));
    const unopened = (outline?.unopened ?? [])
      .filter((module) => module.courseId === courseId)
      .map((module) => ({
        number: module.number,
        id: String(module.id),
        label: String(module.number),
        title: module.title,
        intro: false,
        parent,
        unopened: true,
        opensAt: module.opensAt,
        postedAt: null,
        tasks: [],
        materials: [],
      }));
    return [
      ...(intro.tasks.length || intro.materials.length
        ? [
            {
              id: String(introModule(courseId)),
              label: null,
              title: t("course.intro"),
              intro: true,
              parent,
              unopened: false,
              opensAt: null,
              postedAt: null,
              ...intro,
            },
          ]
        : []),
      ...[...opened, ...unopened].sort((a, b) => a.number - b.number).map(({ number: _number, ...entry }) => entry),
    ];
  });
}

/** `module`: the Edunex module asked for (from search or an alert), or a course's Introduction (introModule); it opens selected and in view. */
export function ModulesTab({ page, module }: { page: CoursePage; module?: number }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const entries = contentsOf(page, t);
  // A module not opened yet is never the one shown, even when nothing has content yet (the start of a term).
  const opened = entries.filter((e) => !e.unopened);
  const first = opened[newestWithContent(opened.map((e) => ({ hasContent: e.tasks.length + e.materials.length > 0, at: latest(e), parent: e.parent })))];
  const [selected, setSelected] = useState<string | null>(module === undefined ? null : String(module));
  const active: Entry | undefined = opened.find((e) => e.id === selected) ?? first;
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

  if (!entries.length) return <EmptyState icon={<Icons.BookOpen className="size-5" />} title={t("course.noMaterials")} />;
  const firstParent = entries.findIndex((e) => e.parent);
  const anyContent = entries.some((e) => e.tasks.length || e.materials.length);
  // Said once per list rather than on every greyed row, so grey isn't the only sign; each row says it to a screen reader.
  const unopenedNote = (
    <p aria-hidden className="mb-1 px-2 text-caption text-faint">
      {t("course.unopenedNote")}
    </p>
  );

  return (
    <div ref={root} className="grid grid-cols-[260px_minmax(0,1fr)] gap-8 max-[1180px]:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label={t("course.contents")} className="self-start">
        <p className="mb-2 px-2 text-small font-semibold text-muted">{t("course.contents")}</p>
        {entries.some((e) => e.unopened && !e.parent) && unopenedNote}
        <ol className="space-y-0.5">
          {entries.map((entry, index) => {
            const heading = index === firstParent && (
              <>
                <p className="mt-4 mb-1 px-2 text-small font-semibold text-muted">{t("course.jointClass")}</p>
                {entries.some((e) => e.unopened && e.parent) && unopenedNote}
              </>
            );
            // Heard with the title: two "Pengantar" (or two same-named modules) are told apart without the heading above.
            const whose = entry.parent && <span className="sr-only">{`, ${t("course.jointClass")}`}</span>;
            // An Introduction is named by its title alone; a module by Edunex's label above it.
            const label = entry.intro ? "" : t("course.module", { no: entry.label ?? "" });
            if (entry.unopened)
              // As on Edunex: listed, greyed, and nothing to open until the lecturer opens it.
              return (
                <li key={entry.id}>
                  {heading}
                  <div className="px-2 py-1 text-faint">
                    <Meta truncate className="text-caption">
                      {label}
                      {/* A date already past while it's still closed would read as "opened on" ("Dibuka"): then it's just greyed. */}
                      {entry.opensAt !== null && entry.opensAt > now ? t("course.opensOn", { when: dayAndTime(f, entry.opensAt) }) : ""}
                    </Meta>
                    <span className="line-clamp-2 text-small">
                      {entry.title}
                      <span className="sr-only">{`, ${t("course.unopened")}`}</span>
                      {whose}
                    </span>
                  </div>
                </li>
              );
            const isActive = entry.id === active?.id;
            const open = entry.tasks.filter((task) => isOpenTask(task, now)).length;
            const empty = entry.tasks.length + entry.materials.length === 0;
            const fresh = !empty && (latest(entry) ?? 0) > now - WEEK;
            return (
              <li key={entry.id}>
                {heading}
                <button
                  type="button"
                  aria-current={isActive ? "true" : undefined}
                  onClick={() => setSelected(entry.id)}
                  className={cx(
                    "focus-ring flex w-full scroll-my-6 items-start gap-2.5 rounded-lg px-2 text-left",
                    empty ? "py-1" : "py-2",
                    isActive ? "bg-selected" : "hover:bg-hover",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    {/* Edunex's own label above the title ("Modul 7"), then what's in it. */}
                    <Meta truncate className={cx("text-caption", isActive ? "text-muted" : "text-faint")}>
                      {label}
                      {empty ? "" : countFacts(t, entry)}
                    </Meta>
                    <span className={cx("line-clamp-2", empty ? "text-small text-muted" : "text-body", !empty && (isActive ? "font-semibold" : "font-medium"))}>
                      {entry.title}
                      {whose}
                    </span>
                  </span>
                  {(open > 0 || fresh) && (
                    <span className="mt-0.5 flex shrink-0 flex-col items-end gap-1">
                      {open > 0 && (
                        <Tooltip content={t("course.openTasksHint")}>
                          <span className="inline-flex">
                            <Tag tone="warning">{t("course.openTasks", { count: open })}</Tag>
                          </span>
                        </Tooltip>
                      )}
                      {fresh && (
                        <Tooltip content={t("course.newHint")}>
                          <span className="inline-flex">
                            <Tag tone="info">{t("course.new")}</Tag>
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

      {!active ? (
        <p className="flex items-center gap-2 self-start text-body text-muted">
          <Icons.Inbox className="size-4" />
          {t("course.noMaterials")}
        </p>
      ) : (
        <section className="min-w-0" aria-labelledby="course-entry">
          <header className="mb-5">
            <Meta className="text-small font-semibold text-muted">
              {active.intro ? t("course.courseWide") : t("course.module", { no: active.label ?? "" })}
              {active.parent ? <span className="font-normal text-faint">{t("course.jointClass")}</span> : null}
            </Meta>
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
      )}
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
  image: Icons.Image,
  page: Icons.Globe,
  interactive: Icons.Layers,
  other: Icons.BookOpen,
};

export function MaterialRow({ material }: { material: Material }) {
  const t = useT();
  const f = useFormat();
  const bridge = useBridge();
  const openExternal = useOpenExternal();
  const openLink = useOpenLink();
  const pdf = usePdfViewer();
  const [busy, setBusy] = useState(false);
  const kind = materialKind(material.type);
  const action = materialAction(material);
  const Icon = KIND_ICON[kind];
  const icon = (
    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-fill text-muted">
      <Icon className="size-4" />
    </span>
  );

  // Notes and pictures are read right here, in full, as on Edunex: the title, what the lecturer posted, and who and when.
  if (action.kind === "note" || action.kind === "image") {
    return (
      <li>
        <div className="flex items-start gap-3 px-4 py-3.5">
          {icon}
          <div className="min-w-0 flex-1">
            <p className="pt-1.5 text-body font-medium">{material.title}</p>
            <div className="mt-2">
              {action.kind === "image" ? (
                <RemoteImage src={action.url} alt={material.title} />
              ) : action.html ? (
                <LecturerHtml html={action.html} />
              ) : (
                <p className="text-body text-muted">{t("note.empty")}</p>
              )}
            </div>
            <Credits material={material} className="mt-2.5" />
          </div>
        </div>
      </li>
    );
  }

  const size = material.sizeBytes ? f.fileSize(material.sizeBytes) : null;
  const upload = uploadExtension(material.type);
  const where = action.kind === "open" ? linkHost(action.url) : null;
  // What it is ("ZIP"; "Kelas online", "Microsoft Teams"), then its size or where it goes.
  let what: string[];
  if (kind === "pdf") what = [t("material.pdf")];
  else if (upload) what = [upload.slice(1).toUpperCase()];
  else if (kind === "vicon") what = [t("material.vicon"), ...(VICON_PROVIDERS[material.type] ? [VICON_PROVIDERS[material.type]] : [])];
  else what = [t(`material.${kind}`)];

  const download = async (url: string, name: string) => {
    setBusy(true);
    try {
      const { existing } = await bridge.invoke("files.download", { url, name });
      toast(t(existing ? "material.openedCopy" : "material.downloaded"));
    } catch (error) {
      toast(t("error.action", { message: error instanceof Error ? error.message : String(error) }), "danger");
    } finally {
      setBusy(false);
    }
  };

  const named = (label: string) => `${label}: ${material.title}`;
  const opens = <Icons.ArrowUpRight className="size-3.5" />;
  // A lecturer's link is its title, opened like a link in a note; anything else opening elsewhere (a video on YouTube) keeps its button.
  const link = kind === "link" && action.kind === "open" ? action.url : null;
  let button: ReactNode = null;
  switch (action.kind) {
    case "download":
      button = canView(action.name) ? (
        // A PDF, Word document, spreadsheet, slides, text or picture reads right here; downloading stays one click away.
        <span className="flex items-center gap-1">
          <Tooltip content={named(t("material.download"))}>
            <IconButton label={named(t("material.download"))} size="sm" disabled={busy} onClick={() => void download(action.url, action.name)}>
              {busy ? <Icons.Loader className="size-4 animate-spin" /> : <Icons.Download className="size-4" />}
            </IconButton>
          </Tooltip>
          <Button
            size="sm"
            icon={<Icons.Eye className="size-3.5" />}
            aria-label={named(t("pdf.view"))}
            onClick={() => pdf.open({ kind: "edunex", url: action.url, name: action.name, edunexUrl: edunexMaterialUrl(material) })}
          >
            {t("pdf.view")}
          </Button>
        </span>
      ) : (
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
        <Button size="sm" icon={opens} aria-label={named(t("material.join"))} onClick={() => openExternal(action.url)}>
          {t("material.join")}
        </Button>
      );
      break;
    case "open":
      if (link) break;
      button = (
        <Tooltip content={t("link.opensIn", { host: where ?? action.url })}>
          <Button size="sm" icon={opens} aria-label={named(t("material.open"))} onClick={() => openLink(action.url)}>
            {t("material.open")}
          </Button>
        </Tooltip>
      );
      break;
    default:
      button = (
        <Button size="sm" icon={opens} aria-label={named(t("action.openInEdunex"))} onClick={() => openExternal(action.url || edunexMaterialUrl(material))}>
          {t("action.openInEdunex")}
        </Button>
      );
  }

  return (
    <li>
      <div className="flex items-center gap-3 px-4 py-3">
        {icon}
        <div className="min-w-0 flex-1">
          {/* As a list row's name: wraps after a "/" too, and shows whole on hover when two lines aren't enough. A link is its own words, as on Edunex. */}
          <p className="line-clamp-2 text-body font-medium break-words" title={material.title}>
            {link ? (
              <WebLink href={link} onOpen={openLink}>
                {breakAfterSlashes(material.title)}
              </WebLink>
            ) : (
              breakAfterSlashes(material.title)
            )}
          </p>
          {/* One line, whatever the width: where it goes gives way first, never a "·" left hanging at a line's end. */}
          <Meta truncate className="mt-0.5 text-small text-muted">
            {what}
            {kind !== "vicon" && where ? (
              <span className="min-w-0 truncate" title={where}>
                {where}
              </span>
            ) : kind !== "vicon" && size ? (
              size
            ) : (
              ""
            )}
          </Meta>
          <Credits material={material} className="mt-0.5" />
        </div>
        {button && <span className="flex shrink-0 justify-end">{button}</span>}
      </div>
    </li>
  );
}

/** "28 Agu 14:01", as Edunex writes an item's times (it says the year too; a term's items are all this year's); never split across lines. */
const dayAndTime = (f: Format, when: number) => `${f.dayMonth(when)} ${f.time(when)}`.replace(/ /g, "\u00a0");

/** Under each item, as on Edunex: who posted it and when, and who last changed it and when; once when they're the same moment. */
function Credits({ material, className }: { material: Material; className?: string }) {
  const t = useT();
  const f = useFormat();
  const { postedAt, updatedAt, createdBy, updatedBy } = material;
  const changed = updatedAt !== null && (postedAt === null || Math.abs(updatedAt - postedAt) >= 60_000);
  const posted =
    postedAt === null
      ? ""
      : createdBy
        ? t("material.createdBy", { name: createdBy, when: dayAndTime(f, postedAt) })
        : t("note.posted", { when: dayAndTime(f, postedAt) });
  const updated = !changed
    ? ""
    : updatedBy && updatedBy !== createdBy
      ? t("material.updatedBy", { name: updatedBy, when: dayAndTime(f, updatedAt) })
      : t("note.updated", { when: dayAndTime(f, updatedAt) });
  if (!posted && !updated) return null;
  return (
    <Meta className={cx("text-caption text-faint", className)}>
      {posted}
      {updated}
    </Meta>
  );
}
