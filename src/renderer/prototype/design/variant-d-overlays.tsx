// PROTOTYPE (#83) — throwaway. Variant D "Kuliah": search (⌘K), the
// notification inbox and settings.
import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Icons, type IconProps } from "./icons";
import { setParams, type Screen } from "./params";
import type { VariantProps } from "./variant-props";
import { actions, changeFeed, type ChangeEvent } from "./variant-d-insights";
import {
  Kbd,
  SourceTag,
  courseOf,
  cx,
  moduleNumber,
  openTasks,
  ui,
  updateDSettings,
  useDSettings,
  type DSettings,
} from "./variant-d-ui";

// ---------------------------------------------------------------- search

interface SearchItem {
  id?: string;
  group: string;
  title: string;
  subtitle: string;
  Icon: ComponentType<IconProps>;
  color?: string;
  run: () => void;
}

export function CommandPalette({ p, onClose }: { p: VariantProps; onClose: () => void }) {
  const { data, t, tr, go } = p;
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  const items = useMemo<SearchItem[]>(() => {
    const nav = (screen: Screen, opts?: { task?: string; course?: string }) => () => {
      go(screen, opts);
      onClose();
    };
    const pages: [Screen, string, ComponentType<IconProps>][] = [
      ["today", tr({ en: "Home", id: "Beranda" }), Icons.Home],
      ["tasks", tr({ en: "Tasks & Exams", id: "Tugas & Ujian" }), Icons.ListChecks],
      ["schedule", t("schedule"), Icons.Calendar],
      ["presence", t("presence"), Icons.Hand],
      ["grades", t("grades"), Icons.GraduationCap],
      ["academic", tr({ en: "Study plan", id: "Rencana studi" }), Icons.BookOpen],
    ];
    return [
      ...data.courses.map((c) => ({
        group: tr({ en: "Courses", id: "Mata kuliah" }),
        title: c.name,
        subtitle: `${c.code} · ${t("class_no")} ${c.classNo}`,
        Icon: Icons.BookOpen,
        color: c.color,
        run: nav("course", { course: c.code }),
      })),
      ...data.tasks.map((x) => ({
        id: x.id,
        group: t("tasks"),
        title: x.title,
        subtitle: `${x.courseCode} · ${t(`status_${x.status}` as Parameters<typeof t>[0])}`,
        Icon: Icons.ListChecks,
        color: courseOf(data, x.courseCode)?.color,
        run: nav("task", { task: x.id }),
      })),
      ...data.modules.map((m) => ({
        group: tr({ en: "Modules", id: "Modul" }),
        title: m.title,
        subtitle: `${m.courseCode} · ${tr({ en: "Module", id: "Modul" })} ${moduleNumber(data, m)}`,
        Icon: Icons.LayoutGrid,
        color: courseOf(data, m.courseCode)?.color,
        run: nav("course", { course: m.courseCode }),
      })),
      ...data.materials.map((m) => ({
        group: t("materials"),
        title: m.title,
        subtitle: m.courseCode,
        Icon: m.kind === "meeting" ? Icons.Video : Icons.FileText,
        color: courseOf(data, m.courseCode)?.color,
        run: nav("course", { course: m.courseCode }),
      })),
      ...pages.map(([screen, label, Icon]) => ({
        group: tr({ en: "Go to", id: "Buka" }),
        title: label,
        subtitle: "",
        Icon,
        run: nav(screen),
      })),
    ];
  }, [data, go, onClose, t, tr]);

  const q = query.trim().toLowerCase();
  // Empty query: what you most likely want — open tasks, your courses, the main pages.
  const openIds = new Set(openTasks(data).map((x) => x.id));
  const results = q
    ? items.filter((it) => `${it.title} ${it.subtitle}`.toLowerCase().includes(q)).slice(0, 12)
    : [
        ...items.filter((it) => it.id && openIds.has(it.id)).slice(0, 3),
        ...items.filter((it) => it.group === tr({ en: "Courses", id: "Mata kuliah" })),
        ...items.filter((it) => it.group === tr({ en: "Go to", id: "Buka" })),
      ];

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(results.length - 1, i + 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(0, i - 1));
    }
    if (e.key === "Enter") results[index]?.run();
  };

  let lastGroup = "";
  return (
    <Overlay onClose={onClose} align="top">
      <div className={cx("w-[620px] overflow-hidden rounded-2xl shadow-[0_24px_80px_-12px_rgba(0,0,0,0.35)]", "bg-white dark:bg-[#1f1f23]", "ring-1 ring-black/10 dark:ring-white/10")} onKeyDown={onKey}>
        <div className={cx("flex items-center gap-3 border-b px-4", ui.line)}>
          <Icons.Search className={cx("size-4", ui.muted)} />
          <input
            ref={input}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            placeholder={tr({ en: "Search courses, tasks, modules, materials…", id: "Cari mata kuliah, tugas, modul, materi…" })}
            className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[#9a9aa1]"
          />
          <Kbd>esc</Kbd>
        </div>
        <ul className="max-h-[400px] overflow-y-auto p-2">
          {results.length === 0 && <li className={cx("px-3 py-6 text-center text-[13px]", ui.muted)}>{tr({ en: "No results", id: "Tidak ditemukan" })}</li>}
          {results.map((it, i) => {
            const header = it.group !== lastGroup ? it.group : null;
            lastGroup = it.group;
            return (
              <li key={`${it.group}-${it.title}-${i}`}>
                {header && <p className={cx("px-3 pt-2.5 pb-1 text-[11.5px] font-semibold", ui.faint)}>{header}</p>}
                <button
                  onMouseEnter={() => setIndex(i)}
                  onClick={it.run}
                  className={cx("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left", i === index ? "bg-[#eef2fd] dark:bg-[#1e2638]" : "")}
                >
                  <span className="relative grid size-7 shrink-0 place-items-center rounded-md bg-black/[0.04] dark:bg-white/[0.06]">
                    <it.Icon className={cx("size-3.5", ui.muted)} />
                    {it.color && <span className="absolute -right-0.5 -bottom-0.5 size-2 rounded-[3px] ring-2 ring-white dark:ring-[#1f1f23]" style={{ background: it.color }} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium">{it.title}</span>
                    {it.subtitle && <span className={cx("block truncate text-[12px]", ui.muted)}>{it.subtitle}</span>}
                  </span>
                  {i === index && <Icons.ArrowUpRight className={cx("size-3.5", ui.faint)} />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Overlay>
  );
}

// ---------------------------------------------------------------- inbox

export function InboxPanel({ p, onClose }: { p: VariantProps; onClose: () => void }) {
  const { f, tr, go } = p;
  const { attendanceTarget } = useDSettings();
  const urgent = actions(p, attendanceTarget).filter((a) => a.urgency === "now");
  const feed = changeFeed(p).slice(0, 16);
  const days = [...new Set(feed.map((e) => f.dayKey(e.at)))];
  const open = (fn: () => void) => () => {
    fn();
    onClose();
  };
  const KIND_ICON: Record<ChangeEvent["kind"], ReactNode> = {
    schedule: <Icons.CalendarClock className="size-4" />,
    exam: <Icons.GraduationCap className="size-4" />,
    task_new: <Icons.ListChecks className="size-4" />,
    task_edited: <Icons.PenLine className="size-4" />,
    material_new: <Icons.FileText className="size-4" />,
    krs: <Icons.ShieldCheck className="size-4" />,
  };

  return (
    <>
      <button aria-label="Close" className="fixed inset-0 z-40 cursor-default" onClick={onClose} />
      <div className={cx("absolute top-[50px] right-4 z-50 w-[420px] overflow-hidden rounded-2xl", "bg-white dark:bg-[#1f1f23]", "shadow-[0_20px_60px_-12px_rgba(0,0,0,0.3)] ring-1 ring-black/10 dark:ring-white/10")}>
        <div className={cx("border-b px-4 py-3", ui.line)}>
          <p className="text-[14px] font-semibold">{tr({ en: "Notifications", id: "Notifikasi" })}</p>
          <p className={cx("mt-0.5 text-[12px]", ui.muted)}>
            {tr({
              en: "What changed in EduNex and SIX. Reading here never marks anything as read there.",
              id: "Yang berubah di EduNex dan SIX. Membaca di sini tidak menandai apa pun di sana.",
            })}
          </p>
        </div>
        <div className="max-h-[520px] overflow-y-auto py-1.5">
          {urgent.length > 0 && (
            <>
              <p className={cx("px-4 pt-2 pb-1 text-[11.5px] font-semibold", ui.faint)}>{tr({ en: "Right now", id: "Sekarang" })}</p>
              {urgent.map((a) => (
                <InboxRow
                  key={a.id}
                  icon={a.icon === "hand" ? <Icons.Hand className="size-4" /> : <Icons.AlertTriangle className="size-4" />}
                  tone={a.icon === "hand" ? "amber" : "red"}
                  title={a.title}
                  subtitle={a.when ?? ""}
                  onClick={open(() => (a.primary?.go ? go(a.primary.go.screen, { task: a.primary.go.task, course: a.primary.go.course }) : go("today")))}
                />
              ))}
            </>
          )}
          {days.map((day) => (
            <div key={day}>
              <p className={cx("px-4 pt-3 pb-1 text-[11.5px] font-semibold", ui.faint)}>{f.relativeDay(`${day}T12:00:00+07:00`)}</p>
              {feed
                .filter((e) => f.dayKey(e.at) === day)
                .map((e) => (
                  <InboxRow
                    key={e.id}
                    icon={KIND_ICON[e.kind]}
                    tone={e.important ? "amber" : undefined}
                    title={e.title}
                    subtitle={
                      <span className="flex items-center gap-1.5">
                        <SourceTag source={e.source} />
                        <span className="truncate">{e.detail || f.time(e.at)}</span>
                      </span>
                    }
                    onClick={open(() => e.go && go(e.go.screen, { task: e.go.task, course: e.go.course }))}
                  />
                ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function InboxRow({
  icon,
  title,
  subtitle,
  onClick,
  unread,
  tone,
}: {
  icon: ReactNode;
  title: string;
  subtitle: ReactNode;
  onClick: () => void;
  unread?: boolean;
  tone?: "amber" | "red";
}) {
  return (
    <button onClick={onClick} className={cx("flex w-full items-start gap-3 px-4 py-2.5 text-left", ui.hover, ui.focus)}>
      <span
        className={cx(
          "mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg",
          tone === "amber"
            ? "bg-[#fff1d6] text-[#8a5300] dark:bg-[#3a2c10] dark:text-[#f5c46a]"
            : tone === "red"
              ? "bg-[#fde4e2] text-[#b42318] dark:bg-[#3a1817] dark:text-[#ff9c94]"
              : cx(ui.fill, ui.muted),
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cx("block truncate text-[13px]", unread ? "font-semibold" : "font-medium")}>{title}</span>
        <span className={cx("mt-0.5 block truncate text-[12px]", ui.muted)}>{subtitle}</span>
      </span>
      {unread && <span className="mt-2 size-2 shrink-0 rounded-full bg-[#2f6feb]" />}
    </button>
  );
}

// ---------------------------------------------------------------- settings

export function SettingsSheet({ p, onClose }: { p: VariantProps; onClose: () => void }) {
  const { data, t, tr, lang } = p;
  const settings = useDSettings();
  const explicitTheme = new URLSearchParams(window.location.search).get("theme");
  const theme = explicitTheme === "light" || explicitTheme === "dark" ? explicitTheme : "system";
  const setNotify = (key: keyof DSettings["notify"], value: boolean) => updateDSettings((s) => ({ notify: { ...s.notify, [key]: value } }));
  const toggleHidden = (key: string) =>
    updateDSettings((s) => ({ hidden: s.hidden.includes(key) ? s.hidden.filter((h) => h !== key) : [...s.hidden, key] }));

  const notifyRows: [keyof DSettings["notify"], string, string][] = [
    ["presence", tr({ en: "Attendance opens", id: "Presensi dibuka" }), tr({ en: "In the system that counts it, the moment it opens", id: "Di sistem yang menghitungnya, saat dibuka" })],
    ["attendanceRisk", tr({ en: "Attendance at risk", id: "Kehadiran berisiko" }), tr({ en: "No absences left, or SIX didn't count a class", id: "Tidak boleh absen lagi, atau SIX tidak menghitung kuliah" })],
    ["changes", tr({ en: "Something changed", id: "Ada perubahan" }), tr({ en: "Room or time moved, task edited, meeting added", id: "Ruang/jam pindah, tugas diubah, pertemuan baru" })],
    ["exams", tr({ en: "Exams", id: "Ujian" }), tr({ en: "When one is scheduled, and the day before", id: "Saat dijadwalkan, dan sehari sebelumnya" })],
    ["deadline", tr({ en: "Deadlines", id: "Tenggat" }), tr({ en: "24 h and 3 h before, only if not submitted", id: "24 jam dan 3 jam sebelumnya, hanya jika belum dikumpulkan" })],
    ["newTask", tr({ en: "New tasks", id: "Tugas baru" }), tr({ en: "Including short-window ones, immediately", id: "Termasuk yang waktunya singkat, langsung" })],
    ["newMaterial", tr({ en: "New materials", id: "Materi baru" }), tr({ en: "Grouped, and flagged when it's for today's class", id: "Digabung, dan ditandai jika untuk kuliah hari ini" })],
    ["grade", tr({ en: "Grades", id: "Nilai" }), tr({ en: "New grade in SIX, and the questionnaire that unlocks it", id: "Nilai baru di SIX, dan kuesioner yang membukanya" })],
    ["krs", tr({ en: "KRS", id: "KRS" }), tr({ en: "DRS/URS windows and advisor approval", id: "Jendela DRS/URS dan persetujuan dosen wali" })],
    ["bill", tr({ en: "UKT", id: "UKT" }), tr({ en: "New bill and its deadline", id: "Tagihan baru dan batasnya" })],
  ];
  const features: [string, string][] = [
    ["schedule", t("schedule")],
    ["presence", t("presence")],
    ["grades", t("grades")],
    ["academic", tr({ en: "Study plan", id: "Rencana studi" })],
  ];

  return (
    <Overlay onClose={onClose} align="center">
      <div className={cx("flex max-h-[min(720px,86vh)] w-[600px] flex-col overflow-hidden rounded-2xl", "bg-white dark:bg-[#1f1f23]", "shadow-[0_24px_80px_-12px_rgba(0,0,0,0.35)] ring-1 ring-black/10 dark:ring-white/10")}>
        <div className={cx("flex items-center justify-between border-b px-5 py-3.5", ui.line)}>
          <p className="text-[15px] font-semibold">{t("settings")}</p>
          <button onClick={onClose} aria-label={tr({ en: "Close", id: "Tutup" })} className={cx("rounded-md p-1", ui.muted, ui.hover, ui.focus)}>
            <Icons.X className="size-4" />
          </button>
        </div>
        <div className="space-y-7 overflow-y-auto px-5 py-5">
          <Group title={tr({ en: "Appearance", id: "Tampilan" })}>
            <Row label={tr({ en: "Theme", id: "Tema" })}>
              <Segmented
                value={theme}
                options={[
                  ["system", tr({ en: "System", id: "Sistem" })],
                  ["light", tr({ en: "Light", id: "Terang" })],
                  ["dark", tr({ en: "Dark", id: "Gelap" })],
                ]}
                onChange={(v) => setParams({ theme: v === "system" ? null : (v as "light" | "dark") })}
              />
            </Row>
            <Row label={tr({ en: "Language", id: "Bahasa" })}>
              <Segmented value={lang} options={[["id", "Indonesia"], ["en", "English"]]} onChange={(v) => setParams({ lang: v as "en" | "id" })} />
            </Row>
          </Group>

          <Group title={tr({ en: "Notifications", id: "Notifikasi" })}>
            {notifyRows.map(([key, label, hint]) => (
              <Row key={key} label={label} hint={hint}>
                <Switch checked={settings.notify[key]} onChange={(v) => setNotify(key, v)} label={label} />
              </Row>
            ))}
          </Group>

          <Group title={tr({ en: "On this laptop and your phone", id: "Di laptop dan HP-mu" })}>
            <Row
              label={tr({ en: "Save course files", id: "Simpan berkas kuliah" })}
              hint={tr({ en: "Every EduNex file, by course and module, in ~/Kuliah. Opens offline.", id: "Semua berkas EduNex per mata kuliah dan modul di ~/Kuliah. Bisa dibuka offline." })}
            >
              <Switch checked={settings.offlineFiles} onChange={(v) => updateDSettings({ offlineFiles: v })} label="offline" />
            </Row>
            <Row
              label={tr({ en: "Phone calendar", id: "Kalender HP" })}
              hint={tr({
                en: data.sixCalendarFeed
                  ? "SIX already publishes your timetable as a calendar feed. This adds exams and deadlines to it."
                  : "Classes with rooms, exams and deadlines in your phone's calendar.",
                id: data.sixCalendarFeed
                  ? "SIX sudah menerbitkan jadwalmu sebagai feed kalender. Ini menambahkan ujian dan tenggat."
                  : "Kuliah beserta ruang, ujian, dan tenggat di kalender HP-mu.",
              })}
            >
              <Switch checked={settings.phoneCalendar} onChange={(v) => updateDSettings({ phoneCalendar: v })} label="calendar" />
            </Row>
          </Group>

          <Group title={tr({ en: "Attendance", id: "Kehadiran" })}>
            <Row
              label={tr({ en: "Minimum attendance", id: "Batas minimal kehadiran" })}
              hint={tr({ en: "Your course contract sets it; SIX marks red below about 80%.", id: "Ditentukan kontrak kuliah; SIX menandai merah di bawah sekitar 80%." })}
            >
              <div className="flex items-center gap-1.5">
                <button onClick={() => updateDSettings((s) => ({ attendanceTarget: Math.max(50, s.attendanceTarget - 5) }))} className={cx("grid size-7 place-items-center rounded-md", ui.secondary, ui.focus)} aria-label="−">
                  −
                </button>
                <span className="w-12 text-center text-[13.5px] font-semibold tabular-nums">{settings.attendanceTarget}%</span>
                <button onClick={() => updateDSettings((s) => ({ attendanceTarget: Math.min(100, s.attendanceTarget + 5) }))} className={cx("grid size-7 place-items-center rounded-md", ui.secondary, ui.focus)} aria-label="+">
                  +
                </button>
              </div>
            </Row>
          </Group>

          <Group title={tr({ en: "Accounts", id: "Akun" })}>
            {["EduNex", "SIX"].map((name) => (
              <Row key={name} label={name} hint={`${data.student.name} · ${t("connected")}`}>
                <button className={cx("h-8 rounded-lg px-3 text-[12.5px] font-medium", ui.secondary, ui.focus)}>{tr({ en: "Sign out", id: "Keluar" })}</button>
              </Row>
            ))}
          </Group>

          <Group title={tr({ en: "Show in sidebar", id: "Tampilkan di sidebar" })}>
            {features.map(([key, label]) => (
              <Row key={key} label={label}>
                <Switch checked={!settings.hidden.includes(key)} onChange={() => toggleHidden(key)} label={label} />
              </Row>
            ))}
          </Group>
        </div>
      </div>
    </Overlay>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <p className={cx("mb-2 text-[12px] font-semibold", ui.muted)}>{title}</p>
      <div className={cx("divide-y overflow-hidden", ui.card, "divide-[#ececef] dark:divide-[#26262b]")}>{children}</div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <span className="min-w-0">
        <span className="block text-[13.5px]">{label}</span>
        {hint && <span className={cx("block truncate text-[12px]", ui.muted)}>{hint}</span>}
      </span>
      {children}
    </div>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx("relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors", checked ? "bg-[#2f6feb] dark:bg-[#3a77f0]" : "bg-[#d4d4da] dark:bg-[#3a3a40]", ui.focus)}
    >
      <span className={cx("absolute top-[2px] left-[2px] size-[18px] rounded-full bg-white shadow transition-transform motion-reduce:transition-none", checked ? "translate-x-4" : "translate-x-0")} />
    </button>
  );
}

function Segmented({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className={cx("flex rounded-lg p-0.5", ui.fill)}>
      {options.map(([key, label]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          aria-pressed={value === key}
          className={cx("h-7 rounded-md px-3 text-[12.5px] font-medium transition", value === key ? "bg-white shadow-[0_1px_2px_rgba(16,24,40,0.12)] dark:bg-[#34343a]" : ui.muted, ui.focus)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Overlay({ children, onClose, align }: { children: ReactNode; onClose: () => void; align: "top" | "center" }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className={cx("fixed inset-0 z-50 flex justify-center bg-black/25 backdrop-blur-[2px] dark:bg-black/45", align === "top" ? "items-start pt-[12vh]" : "items-center")} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      {children}
    </div>
  );
}
