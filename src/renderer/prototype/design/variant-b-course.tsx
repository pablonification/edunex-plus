// PROTOTYPE (#83) — throwaway. Variant B ("Lists"): the course page, styled like
// a Things project — big title with its progress pie, a quiet notes block
// (lecturer, slot and room, attendance from SIX), then headed lists.
import { useState } from "react";
import type { Material, PresenceWindow } from "./data";
import { Icons } from "./icons";
import { useVB } from "./variant-b-context";
import { ClassRow, PresenceNow, TaskRow } from "./variant-b-lists";
import { isOpen, tidy } from "./variant-b-model";
import { Page } from "./variant-b-shell";
import {
  Button,
  EmptyRow,
  FileTile,
  Mark,
  ProgressPie,
  STATUS_LABEL,
  Section,
  StatusCircle,
  cx,
  ink,
  leadCol,
  rowBase,
} from "./variant-b-ui";

export function CourseScreen() {
  const { p } = useVB();
  // Fresh local state (expanded notes, "view all") per course.
  return <CoursePage key={p.course.code} />;
}

function CoursePage() {
  const { p, m } = useVB();
  const { t, tr, f } = p;
  const c = p.course;
  const pr = m.progress(c.code);
  const slot = m.slot(c.code);
  const next = m.courseSessions(c.code).slice(0, 3);
  const tasks = m.courseTasks(c.code);
  const materials = m.courseMaterials(c.code);
  const presence = m.coursePresence(c.code);
  const [allPresence, setAllPresence] = useState(false);
  const pastShown = allPresence ? presence.past : presence.past.slice(0, 4);

  const meta = [c.code, `${t("class_no")} ${c.classNo}`, c.sks !== null ? `${c.sks} ${t("sks")}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <Page
      glyph={<ProgressPie color={c.color} value={pr.total ? pr.done / pr.total : 0} size={26} />}
      title={c.name}
      subtitle={meta}
    >
      {/* Things-style project notes: plain facts, no boxes */}
      <dl className="mt-6 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2.5 text-[14px] leading-5">
        {c.lecturer && (
          <>
            <dt className={ink.secondary}>{t("lecturer")}</dt>
            <dd className={ink.body}>{c.lecturer}</dd>
          </>
        )}
        {slot && (
          <>
            <dt className={ink.secondary}>{t("schedule")}</dt>
            <dd className={ink.body}>
              {f.weekday(slot.start)} · <span className="tabular-nums">{f.timeRange(slot.start, slot.end)}</span>
              {slot.room.trim() && (
                <>
                  {" · "}
                  {t("room")} {slot.room.trim()}
                </>
              )}
            </dd>
          </>
        )}
        {c.attendancePct !== null && (
          <>
            <dt className={ink.secondary}>{t("attendance")}</dt>
            <dd className={cx("flex items-center gap-3", ink.body)}>
              <span className="tabular-nums">{m.num(c.attendancePct)}%</span>
              <span
                className="h-[5px] w-[120px] overflow-hidden rounded-full bg-black/[0.07] dark:bg-white/[0.1]"
                role="meter"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={c.attendancePct}
                aria-label={t("attendance")}
              >
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${Math.min(100, c.attendancePct)}%`, backgroundColor: c.color }}
                />
              </span>
              <span className={cx("text-[12px]", ink.secondary)}>SIX</span>
            </dd>
          </>
        )}
      </dl>

      {presence.open && (
        <Section title={t("now")} className="mt-9">
          <div className="pt-2">
            <PresenceNow w={presence.open} withCourse={false} />
          </div>
        </Section>
      )}

      <Section title={tr({ en: "Next classes", id: "Kuliah berikutnya" })} aside="SIX">
        {next.length === 0 ? (
          <EmptyRow>{tr({ en: "No more classes this term", id: "Tidak ada kuliah lagi semester ini" })}</EmptyRow>
        ) : (
          <ul>
            {next.map((s) => (
              <li key={s.id}>
                <ClassRow
                  session={s}
                  lead={f.relativeDay(s.start)}
                  label={<span className="tabular-nums">{f.timeRange(s.start, s.end)}</span>}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title={t("tasks")}
        aside={
          pr.total > 0
            ? tr({ en: `${pr.done} of ${pr.total} submitted`, id: `${pr.done} dari ${pr.total} terkumpul` })
            : undefined
        }
      >
        {tasks.length === 0 ? (
          <EmptyRow>{tr({ en: "No Tasks yet", id: "Belum ada tugas" })}</EmptyRow>
        ) : (
          <ul>
            {tasks.map((task) => (
              <li key={task.id}>
                <TaskRow
                  task={task}
                  withCourse={false}
                  lead={task.dueAt ? f.relativeDay(task.dueAt) : ""}
                  trail={
                    !task.dueAt
                      ? undefined
                      : isOpen(task.status)
                        ? f.fromNow(task.dueAt)
                        : t(STATUS_LABEL[task.status])
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t("materials")} aside="EduNex">
        {materials.length === 0 ? (
          <EmptyRow>{tr({ en: "No materials yet", id: "Belum ada materi" })}</EmptyRow>
        ) : (
          <ul>
            {materials.map((item) => (
              <li key={item.id}>
                <MaterialRow item={item} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t("presence")} aside="EduNex">
        {presence.next || pastShown.length > 0 ? (
          <ul>
            {presence.next && (
              <li>
                <PresenceRow w={presence.next} kind="next" />
              </li>
            )}
            {pastShown.map((w) => (
              <li key={w.id}>
                <PresenceRow w={w} kind="past" />
              </li>
            ))}
          </ul>
        ) : (
          !presence.open && <EmptyRow>{tr({ en: "No Presence yet", id: "Belum ada presensi" })}</EmptyRow>
        )}
        {presence.past.length > 4 && (
          <Button kind="quiet" size="sm" className={cx("-ml-2.5 mt-1", ink.blue)} onClick={() => setAllPresence((v) => !v)}>
            {allPresence ? tr({ en: "Show less", id: "Lebih sedikit" }) : `${t("view_all")} (${presence.past.length})`}
          </Button>
        )}
      </Section>
    </Page>
  );
}

function MaterialRow({ item }: { item: Material }) {
  const { p } = useVB();
  const { t, tr, f } = p;
  const [open, setOpen] = useState(false);
  const kindLabel =
    item.kind === "pdf"
      ? "PDF"
      : item.kind === "meeting"
        ? item.provider === "ms-teams"
          ? "Microsoft Teams"
          : t("online_class")
        : item.kind === "note"
          ? tr({ en: "Note", id: "Catatan" })
          : tr({ en: "Link", id: "Tautan" });
  const meta = [kindLabel, item.sizeBytes ? f.fileSize(item.sizeBytes) : null, item.updatedAt ? f.relativeDay(item.updatedAt) : null]
    .filter(Boolean)
    .join(" · ");
  const isNote = item.kind === "note" && !!item.html;

  const body = (
    <>
      <FileTile kind={item.kind === "pdf" ? "pdf" : item.kind === "meeting" ? "meeting" : item.kind === "note" ? "note" : "other"} />
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] leading-5">{tidy(item.title)}</span>
        <span className={cx("mt-0.5 block text-[12.5px] leading-4", ink.secondary)}>{meta}</span>
      </span>
    </>
  );

  if (item.kind === "meeting") {
    return (
      <div className="-mx-2.5 flex items-center gap-3 px-2.5 py-2">
        {body}
        <Button kind="tinted" size="sm">
          <Icons.Video className="size-3.5" />
          {t("join")}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => isNote && setOpen((v) => !v)}
        aria-expanded={isNote ? open : undefined}
        className={cx(rowBase, "items-center py-2")}
      >
        {body}
        {isNote ? (
          <Icons.ChevronRight
            className={cx(
              "size-4 shrink-0 transition-transform duration-200 ease-out",
              ink.secondary,
              open && "rotate-90",
            )}
          />
        ) : (
          <Icons.Download className={cx("size-4 shrink-0", ink.blue)} />
        )}
      </button>
      {isNote && open && (
        <div
          className={cx(
            "vb-prose mb-2 ml-11 mt-1 rounded-[10px] bg-black/[0.03] px-4 py-3 text-[13.5px] leading-[1.6] dark:bg-white/[0.04]",
            "motion-safe:animate-[vb-in_200ms_ease-out]",
            ink.body,
          )}
          // Prototype only: lecturer HTML from EduNex; production must sanitize it.
          dangerouslySetInnerHTML={{ __html: item.html ?? "" }}
        />
      )}
    </div>
  );
}

function PresenceRow({ w, kind }: { w: PresenceWindow; kind: "next" | "past" }) {
  const { p } = useVB();
  const { t, tr, f } = p;
  const attended = w.myStatus === "attended";
  return (
    <div className={cx("-mx-2.5 flex items-center gap-3 rounded-[9px] px-2.5 py-2")}>
      <span className={cx(leadCol, ink.secondary)}>{f.relativeDay(w.opensAt)}</span>
      <Mark>
        {kind === "next" ? (
          <Icons.Clock className={cx("size-[15px]", ink.secondary)} />
        ) : attended ? (
          <StatusCircle status="submitted" label={t("attended")} size={16} />
        ) : (
          <span
            role="img"
            aria-label={tr({ en: "Not recorded", id: "Tidak tercatat" })}
            className="size-4 rounded-full border-[1.5px] border-dashed border-[#AEAEB2] dark:border-[#636366]"
          />
        )}
      </Mark>
      <span className="min-w-0 flex-1 text-[14px] leading-5">
        <span className="tabular-nums">{f.timeRange(w.opensAt, w.closesAt)}</span>
        {w.topic.trim() && <span className={ink.secondary}> · {w.topic.trim()}</span>}
      </span>
      <span
        className={cx(
          "shrink-0 pl-3 text-right text-[13px] leading-5",
          kind === "past" && attended ? ink.green : ink.secondary,
        )}
      >
        {kind === "next"
          ? tr({ en: `Opens ${f.fromNow(w.opensAt)}`, id: `Dibuka ${f.fromNow(w.opensAt)}` })
          : attended
            ? t("attended")
            : tr({ en: "Not recorded", id: "Tidak tercatat" })}
      </span>
    </div>
  );
}
