// The Modul tab: Edunex's table of contents (each Edunex course's
// course-wide items as its Introduction, then its modules; the joint class's
// after the class's own), and the selected entry's Tasks and materials, drawn
// the way Edunex draws them: notes and pictures right on the page, every other
// kind with the one action that fits it (download, join, open, or Edunex
// itself; a PDF reads in the app's viewer), all alike. It opens on the newest
// module with something in it; empty modules take one quiet line.
import { type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
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
import { type Translate, useFormat, useNow, useT } from "../../i18n";
import { LecturerHtml, RemoteImage } from "../../lecturer-html";
import { isPdfName, usePdfViewer } from "../../pdf";
import { useBridge } from "../../store";
import { Button, IconButton } from "../../ui/controls";
import { cx } from "../../ui/cx";
import { EmptyState } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { List, Meta } from "../../ui/layout";
import { Tooltip, toast } from "../../ui/overlays";
import { TaskRows } from "../tasks";
import { type CoursePage, isOpenTask } from "./data";

const WEEK = 7 * 24 * 3_600_000;

interface Entry {
  id: string;
  label: string | null;
  title: string;
  /** An Edunex course's course-wide items. */
  intro: boolean;
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

/**
 * The table of contents, Edunex course by Edunex course (the class's own,
 * then each joint class's): its Introduction, when it has course-wide items,
 * then its modules. On Edunex these are separate course pages, so an item in
 * both courses (a schedule posted to each) shows once under each.
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
      ...wideMaterials.map((m) => m.courseId),
      ...wideTasks.map((task) => task.courseId),
    ]),
  ];
  return courseIds.flatMap((courseId): Entry[] => {
    const parent = courseId !== main;
    const intro = { tasks: wideTasks.filter((task) => task.courseId === courseId), materials: wideMaterials.filter((m) => m.courseId === courseId) };
    return [
      ...(intro.tasks.length || intro.materials.length
        ? [{ id: String(introModule(courseId)), label: null, title: t("course.intro"), intro: true, parent, postedAt: null, ...intro }]
        : []),
      ...modules
        .filter((entry) => entry.module.courseId === courseId)
        .map((entry) => ({
          id: String(entry.module.id),
          label: String(entry.number),
          title: entry.module.title,
          intro: false,
          parent,
          postedAt: entry.module.postedAt,
          tasks: page.tasks.filter((task) => task.moduleId === entry.module.id),
          materials: materials.filter((m) => m.moduleId === entry.module.id),
        })),
    ];
  });
}

/** `module`: the Edunex module asked for (from search or an alert), or a course's Introduction (introModule); it opens selected and in view. */
export function ModulesTab({ page, module }: { page: CoursePage; module?: number }) {
  const t = useT();
  const now = useNow();
  const entries = contentsOf(page, t);
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
                      {/* Heard with the title: two "Pengantar" (or two same-named modules) are told apart without the heading above. */}
                      {entry.parent && <span className="sr-only">{`, ${t("course.jointClass")}`}</span>}
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
              {active.intro ? t("course.courseWide") : t("course.module", { no: active.label ?? "" })}
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

  // Notes and pictures are read right here, as on Edunex: the title, what the lecturer posted, and when.
  if (action.kind === "note" || action.kind === "image") {
    const changed = material.updatedAt !== null && material.postedAt !== null && material.updatedAt - material.postedAt > 3_600_000;
    const when = changed ? material.updatedAt : (material.postedAt ?? material.updatedAt);
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
                <Folded label={material.title}>
                  <LecturerHtml html={action.html} />
                </Folded>
              ) : (
                <p className="text-body text-muted">{t("note.empty")}</p>
              )}
            </div>
            {when !== null && <p className="mt-2.5 text-caption text-faint">{t(changed ? "note.updated" : "note.posted", { when: f.fromNow(when) })}</p>}
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
  const ago = material.updatedAt !== null ? f.fromNow(material.updatedAt) : null;

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
  const opens = <Icons.ArrowUpRight className="size-3.5" />;
  let button: ReactNode;
  switch (action.kind) {
    case "download":
      button = isPdfName(action.name) ? (
        // A PDF reads right here; downloading stays one click away.
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
          <p className="line-clamp-2 text-body font-medium [overflow-wrap:anywhere]">{material.title}</p>
          {/* One line, whatever the width: the date gives way first, never a "·" left hanging at a line's end. */}
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
            {ago ? (
              <span className="min-w-0 truncate text-faint" title={ago}>
                {ago}
              </span>
            ) : (
              ""
            )}
          </Meta>
        </div>
        <span className="flex shrink-0 justify-end">{button}</span>
      </div>
    </li>
  );
}

/** About twelve lines of a note; a longer one folds there, with a way to read it all. */
const FOLD_PX = 288;

function Folded({ label, children }: { label: string; children: ReactNode }) {
  const t = useT();
  const id = useId();
  const body = useRef<HTMLDivElement>(null);
  const [long, setLong] = useState(false);
  const [open, setOpen] = useState(false);
  useLayoutEffect(() => {
    const element = body.current;
    if (!element) return;
    // Pictures load after the text: the note can grow past the fold later.
    const measure = () => setLong(element.scrollHeight > FOLD_PX + 48);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  // Folding a note read to its end brings it back into view; the page would otherwise be left past it.
  const folding = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the note folds, on purpose
  useLayoutEffect(() => {
    if (!folding.current) return;
    folding.current = false;
    body.current?.scrollIntoView?.({ block: "nearest" });
  }, [open]);
  const folded = long && !open;
  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: focus arriving inside a folded note unfolds it; the note itself does nothing */}
      <div
        ref={body}
        id={id}
        style={folded ? { maxHeight: FOLD_PX } : undefined}
        className={cx("overflow-hidden", folded && "[mask-image:linear-gradient(to_bottom,black_65%,transparent)]")}
        // A link the keyboard reaches in the faded or hidden part unfolds the note, so it's seen where it is.
        onFocus={(event) => {
          if (folded && event.target.getBoundingClientRect().bottom > event.currentTarget.getBoundingClientRect().top + FOLD_PX * 0.65) setOpen(true);
        }}
      >
        {children}
      </div>
      {long && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          aria-label={`${t(open ? "note.less" : "note.more")}: ${label}`}
          onClick={() => {
            folding.current = open;
            setOpen(!open);
          }}
          className="focus-ring mt-1.5 inline-flex items-center gap-1 rounded-md text-small font-medium text-accent-fg hover:underline"
        >
          {t(open ? "note.less" : "note.more")}
          <Icons.ChevronDown className={cx("size-3.5 transition-transform duration-150", open && "rotate-180")} />
        </button>
      )}
    </>
  );
}
