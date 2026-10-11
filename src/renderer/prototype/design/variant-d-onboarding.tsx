// PROTOTYPE (#83) — throwaway. Variant D "Kuliah": first run. Connect EduNex
// and SIX, then a first scan that shows, on the Student's own data, what
// neither system tells them on its own. That's the reason to use the app.
import { useState, type JSX } from "react";
import { TrafficLights } from "./chrome";
import { Icons } from "./icons";
import {
  attendanceHealth,
  clashes,
  examsOf,
  graduationPath,
  honorsPath,
  offTimetable,
  taskSignals,
} from "./variant-d-insights";
import type { VariantProps } from "./variant-props";
import { SourceTag, cx, tint, ui, useDSettings } from "./variant-d-ui";

type Step = "connect" | "scan";

export function SignIn(p: VariantProps) {
  // Prototype convenience: ?step=scan opens the first scan directly (for screenshots).
  const [step, setStep] = useState<Step>(() => (new URLSearchParams(window.location.search).get("step") as Step | null) ?? "connect");
  return (
    <div className={cx("relative h-screen overflow-y-auto bg-[#f5f5f7] dark:bg-[#121214]", ui.text)}>
      <TrafficLights />
      {step === "connect" ? <Connect {...p} onDone={() => setStep("scan")} /> : <FirstScan {...p} />}
    </div>
  );
}

// ---------------------------------------------------------------- step 1: connect both systems

function Connect({ onDone, ...p }: VariantProps & { onDone: () => void }) {
  const { data, t, tr } = p;
  const [six, setSix] = useState(false);
  const rows = [
    {
      name: "EduNex",
      detail: tr({ en: "Tasks, materials, Presence, lecturer posts", id: "Tugas, materi, presensi, unggahan dosen" }),
      who: `${data.student.name} · ${data.student.nim}`,
      connected: true,
      color: "#2f6feb",
    },
    {
      name: "SIX",
      detail: tr({ en: "Timetable and rooms, attendance count, grades, KRS, UKT", id: "Jadwal dan ruang, hitungan kehadiran, nilai, KRS, UKT" }),
      who: six ? `${data.student.name} · ${data.student.program?.replace(/^\d+ \/ /, "")}` : null,
      connected: six,
      color: "#1f9d8a",
    },
  ];
  return (
    <div className="grid min-h-full place-items-center py-16">
      <div className="w-[460px]">
        <div className="mx-auto grid size-14 place-items-center rounded-[16px] bg-gradient-to-b from-[#4c8bf7] to-[#2563eb] text-white shadow-[0_8px_24px_-8px_rgba(37,99,235,0.55)]">
          <Icons.GraduationCap className="size-7" strokeWidth={1.9} />
        </div>
        <h1 className="mt-5 text-center text-[24px] font-semibold tracking-[-0.02em]">{t("welcome")}</h1>
        <p className={cx("mx-auto mt-2 max-w-[400px] text-center text-[14px] leading-[1.55]", ui.muted)}>
          {tr({
            en: "EduNex and SIX don't talk to each other. Edunex Plus reads both and tells you what needs you, what changed, and where you stand.",
            id: "EduNex dan SIX tidak saling terhubung. Edunex Plus membaca keduanya dan memberi tahu apa yang perlu kamu urus, apa yang berubah, dan posisimu.",
          })}
        </p>

        <ul className={cx("mt-7 overflow-hidden", ui.card)}>
          {rows.map((r, i) => (
            <li key={r.name} className={cx("flex items-center gap-3.5 px-4 py-3.5", i > 0 && "border-t", ui.line)}>
              <span
                className="grid size-9 shrink-0 place-items-center rounded-lg text-[13px] font-bold"
                style={{ background: tint(r.color, 0.14), color: r.color }}
              >
                {r.name[0]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold">{r.name}</span>
                <span className={cx("block truncate text-[12.5px]", ui.muted)}>{r.who ?? r.detail}</span>
              </span>
              {r.connected ? (
                <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#178a4a] dark:text-[#6fdc9c]">
                  <Icons.CheckCircle className="size-4" />
                  {t("connected")}
                </span>
              ) : (
                <button onClick={() => setSix(true)} className={cx("h-8 rounded-lg px-3 text-[13px] font-semibold", ui.primary, ui.focus)}>
                  {tr({ en: "Connect", id: "Hubungkan" })}
                </button>
              )}
            </li>
          ))}
        </ul>
        <p className={cx("mt-3 flex items-center justify-center gap-1.5 text-[12.5px]", ui.muted)}>
          <Icons.ShieldCheck className="size-3.5" />
          {t("password_note")}
        </p>
        <p className={cx("mt-1 text-center text-[12px]", ui.faint)}>
          {tr({
            en: "Read-only. Nothing is submitted, marked or changed unless you press the button yourself.",
            id: "Hanya membaca. Tidak ada yang dikumpulkan, ditandai, atau diubah kecuali kamu sendiri menekan tombolnya.",
          })}
        </p>
        <button
          disabled={!six}
          onClick={onDone}
          className={cx("mt-7 h-10 w-full rounded-lg text-[14px] font-semibold", ui.primary, !six && "opacity-50", ui.focus)}
        >
          {six ? tr({ en: "Check both systems", id: "Periksa kedua sistem" }) : t("continue")}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- step 2: first scan

interface Finding {
  key: string;
  Icon: (props: { className?: string }) => JSX.Element;
  tone: "bad" | "warn" | "info" | "good";
  title: string;
  detail: string;
  sources: ("SIX" | "EduNex" | "ITB")[];
}

const TONE: Record<Finding["tone"], string> = {
  bad: "bg-[#fde7e4] text-[#c4321f] dark:bg-[#3a1c19] dark:text-[#ff9c8f]",
  warn: "bg-[#fdf2d6] text-[#8a5300] dark:bg-[#382d10] dark:text-[#f2c862]",
  info: "bg-[#e6eefe] text-[#2f5fc4] dark:bg-[#1b2742] dark:text-[#9ab8ff]",
  good: "bg-[#dcf4e5] text-[#166240] dark:bg-[#12301f] dark:text-[#80e0a9]",
};

/** What the first sync found that neither system says on its own, computed from the Student's data. */
export function firstScanFindings(p: VariantProps, targetPct: number): Finding[] {
  const { data, now, f, tr } = p;
  const findings: Finding[] = [];
  const health = data.courses.map((c) => attendanceHealth(data, c.code, now, f, targetPct));
  const out = health.filter((h) => h.state === "out");
  const last = health.filter((h) => h.state === "last");
  if (out.length || last.length) {
    findings.push({
      key: "attendance",
      Icon: Icons.Hand,
      tone: out.length ? "bad" : "warn",
      title: out.length
        ? tr({
            en: `${out.map((h) => h.code).join(", ")} can't reach ${targetPct}% attendance anymore`,
            id: `Kehadiran ${out.map((h) => h.code).join(", ")} tidak bisa lagi mencapai ${targetPct}%`,
          })
        : tr({ en: `No absences left in ${last.map((h) => h.code).join(" and ")}`, id: `Tidak boleh absen lagi di ${last.map((h) => h.code).join(" dan ")}` }),
      detail: [
        ...out.map((h) =>
          tr({
            en: `${h.code}: ${h.attended} of ${h.held}, best case ${Math.round((h.best ?? 0) * 100)}%.`,
            id: `${h.code}: ${h.attended} dari ${h.held}, paling tinggi ${Math.round((h.best ?? 0) * 100)}%.`,
          }),
        ),
        out.length && last.length
          ? tr({ en: `No absences left in ${last.map((h) => h.code).join(" and ")}.`, id: `Tidak boleh absen lagi di ${last.map((h) => h.code).join(" dan ")}.` })
          : "",
        tr({ en: "SIX shows only a percentage.", id: "SIX hanya menampilkan persentase." }),
      ]
        .filter(Boolean)
        .join(" "),
      sources: ["SIX", "ITB"],
    });
  }
  for (const c of clashes(data, now, f).slice(0, 1)) {
    findings.push({
      key: "clash",
      Icon: Icons.Overlap,
      tone: "bad",
      title: tr({ en: `${c.codes[0]} and ${c.codes[1]} overlap every ${c.weekday}`, id: `${c.codes[0]} dan ${c.codes[1]} bentrok setiap ${c.weekday}` }),
      detail: tr({
        en: `${c.from}–${c.to}. SIX accepted both in your KRS without a warning.`,
        id: `${c.from}–${c.to}. SIX menerima keduanya di KRS-mu tanpa peringatan.`,
      }),
      sources: ["SIX"],
    });
  }
  const misleading = health.filter((h) => h.edunexMisleading);
  const unpublished = data.courses.filter((c) => !c.gradebookPublished).length;
  if (misleading.length || unpublished) {
    findings.push({
      key: "wrong",
      Icon: Icons.EyeOff,
      tone: "info",
      title: tr({ en: "Two things EduNex shows you are wrong", id: "Dua hal yang ditampilkan EduNex keliru" }),
      detail: [
        ...misleading.map((h) =>
          tr({
            en: `It marks ${h.code} "Absent" ${h.edunexPast - h.edunexMarked} times because you didn't open the material in EduNex during class, while SIX, where your lecturer counts you, has ${h.attended} of ${h.held}.`,
            id: `${h.code} ditandai "Absent" ${h.edunexPast - h.edunexMarked} kali karena materinya tidak dibuka di EduNex selama kuliah, padahal SIX, tempat dosen menghitungmu, mencatat ${h.attended} dari ${h.held}.`,
          }),
        ),
        unpublished
          ? tr({
              en: `Its gradebook shows "0.00 · E" in ${unpublished} courses; nothing is graded yet.`,
              id: `Buku nilainya menampilkan "0.00 · E" di ${unpublished} mata kuliah; belum ada yang dinilai.`,
            })
          : "",
      ]
        .filter(Boolean)
        .join(" "),
      sources: ["EduNex", "SIX"],
    });
  }
  const exam = examsOf(data).find((e) => e.source === "SIX" && e.start && new Date(e.start) > now);
  if (exam?.start) {
    const takeHome = data.tasks.find((t) => t.courseCode === exam.courseCode && t.domain === "uts");
    findings.push({
      key: "exam",
      Icon: Icons.GraduationCap,
      tone: "warn",
      title: tr({
        en: `${exam.kind} ${exam.courseCode}: ${f.weekdayShort(exam.start)} ${f.dayMonth(exam.start)}, ${f.time(exam.start)}${exam.room ? ` in ${exam.room}` : ""}`,
        id: `${exam.kind} ${exam.courseCode}: ${f.weekdayShort(exam.start)} ${f.dayMonth(exam.start)}, ${f.time(exam.start)}${exam.room ? ` di ${exam.room}` : ""}`,
      }),
      detail: tr({
        en: `Only on SIX's calendar.${takeHome?.dueAt ? ` EduNex has a separate take-home UTS due ${f.weekdayShort(takeHome.dueAt)} ${f.dayMonth(takeHome.dueAt)}.` : ""}`,
        id: `Hanya ada di kalender SIX.${takeHome?.dueAt ? ` EduNex punya UTS take-home terpisah, tenggat ${f.weekdayShort(takeHome.dueAt)} ${f.dayMonth(takeHome.dueAt)}.` : ""}`,
      }),
      sources: takeHome ? ["SIX", "EduNex"] : ["SIX"],
    });
  }
  const hidden = offTimetable(data, f).find((m) => new Date(m.end) > now);
  const viaTask = data.presence.find((x) => x.taskId && new Date(x.closesAt) > now);
  if (hidden || viaTask) {
    findings.push({
      key: "hidden",
      Icon: Icons.CalendarClock,
      tone: "warn",
      title: hidden
        ? tr({
            en: `${hidden.courseCode} meets online ${f.weekdayShort(hidden.start)} ${f.dayMonth(hidden.start)}, ${f.time(hidden.start)}`,
            id: `${hidden.courseCode} ada pertemuan daring ${f.weekdayShort(hidden.start)} ${f.dayMonth(hidden.start)}, ${f.time(hidden.start)}`,
          })
        : tr({ en: "A course takes attendance through Tasks", id: "Ada mata kuliah yang presensinya lewat tugas" }),
      detail: [
        hidden
          ? tr({ en: "Announced only in EduNex's parent class, not in SIX's timetable.", id: "Hanya diumumkan di kelas induk EduNex, tidak ada di jadwal SIX." })
          : "",
        viaTask
          ? tr({
              en: `In ${viaTask.courseCode}, EduNex Presence is set to "Answer Assignment": it counts only if you hand in the Friday task between 15:00 and 23:59.`,
              id: `Di ${viaTask.courseCode}, Presensi EduNex diatur ke "Answer Assignment": hanya terhitung jika tugas Jumat dikumpulkan antara 15:00 dan 23:59.`,
            })
          : "",
      ]
        .filter(Boolean)
        .join(" "),
      sources: ["EduNex"],
    });
  }
  const edited = data.tasks.map((t) => taskSignals(data, t, now)).filter((s) => s.editedAt);
  const afterSubmit = edited.filter((s) => s.editedAfterSubmit).length;
  if (edited.length) {
    findings.push({
      key: "edits",
      Icon: Icons.PenLine,
      tone: afterSubmit ? "warn" : "info",
      title: tr({ en: `Lecturers edited ${edited.length} tasks after posting them`, id: `Dosen mengubah ${edited.length} tugas setelah diunggah` }),
      detail: tr({
        en: `${afterSubmit ? `${afterSubmit} after you'd already submitted. ` : ""}EduNex sent no notification for any of them. From now on, you'll see what changed.`,
        id: `${afterSubmit ? `${afterSubmit} di antaranya setelah kamu mengumpulkan. ` : ""}EduNex tidak memberi notifikasi sama sekali. Mulai sekarang, kamu akan melihat apa yang berubah.`,
      }),
      sources: ["EduNex"],
    });
  }
  const path = graduationPath(data);
  const leftSks = path.inProgress + path.requiredLeft.reduce((s, c) => s + c.sks, 0);
  const cum = honorsPath(data, leftSks).find((h) => h.key === "cum");
  findings.push({
    key: "graduation",
    Icon: Icons.Flag,
    tone: "good",
    title: tr({
      en: `${path.passed + path.inProgress} of ${path.target} SKS after this semester`,
      id: `${path.passed + path.inProgress} dari ${path.target} SKS setelah semester ini`,
    }),
    detail: [
      path.requiredLeft.length
        ? tr({
            en: `${path.requiredLeft.map((c) => c.name).join(" and ")} finish your degree.`,
            id: `${path.requiredLeft.map((c) => c.name).join(" dan ")} menuntaskan studimu.`,
          })
        : "",
      cum?.needAvg !== null && cum?.needAvg !== undefined
        ? tr({
            en: `Cum laude (IPK ≥ 3.50) needs about ${cum.needAvg.toFixed(2)} over your last ${leftSks} SKS.`,
            id: `Cum laude (IPK ≥ 3,50) butuh rata-rata sekitar ${cum.needAvg.toFixed(2).replace(".", ",")} di ${leftSks} SKS terakhirmu.`,
          })
        : "",
    ]
      .filter(Boolean)
      .join(" "),
    sources: ["SIX", "ITB"],
  });
  return findings;
}

function FirstScan(p: VariantProps) {
  const { data, tr, go } = p;
  const { attendanceTarget } = useDSettings();
  const findings = firstScanFindings(p, attendanceTarget);
  return (
    <div className="mx-auto max-w-[720px] px-8 pt-20 pb-16">
      <p className="flex items-center gap-2 text-[12.5px] font-semibold text-[#178a4a] dark:text-[#6fdc9c]">
        <Icons.CheckCircle className="size-4" />
        {tr({
          en: `EduNex and SIX connected · ${data.courses.length} courses, ${data.tasks.length} tasks, ${data.sessions.length} meetings read`,
          id: `EduNex dan SIX terhubung · ${data.courses.length} mata kuliah, ${data.tasks.length} tugas, ${data.sessions.length} pertemuan dibaca`,
        })}
      </p>
      <h1 className="mt-3 text-[28px] leading-tight font-semibold tracking-[-0.02em]">
        {tr({ en: `${findings.length} things neither system tells you`, id: `${findings.length} hal yang tidak disampaikan kedua sistem` })}
      </h1>
      <p className={cx("mt-2 text-[14px] leading-[1.55]", ui.muted)}>
        {tr({
          en: "Found by reading EduNex and SIX together, on your own data. From now on the app keeps checking and tells you when something needs you.",
          id: "Ditemukan dengan membaca EduNex dan SIX bersamaan, dari datamu sendiri. Mulai sekarang aplikasi terus memeriksa dan memberi tahu saat ada yang perlu kamu urus.",
        })}
      </p>

      <ol className={cx("mt-7 overflow-hidden", ui.card)}>
        {findings.map((x, i) => (
          <li key={x.key} className={cx("flex items-start gap-3.5 px-5 py-4", i > 0 && "border-t", ui.line)}>
            <span className={cx("mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg", TONE[x.tone])}>
              <x.Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] leading-snug font-semibold">{x.title}</p>
              <p className={cx("mt-1 text-[13px] leading-[1.5]", ui.muted)}>{x.detail}</p>
            </div>
            <span className="flex shrink-0 gap-1 pt-0.5">
              {x.sources.map((s) => (
                <SourceTag key={s} source={s} />
              ))}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-7 flex items-center justify-between gap-4">
        <p className={cx("text-[12.5px]", ui.faint)}>
          {tr({ en: "Notifications are on for these. Change them in Settings.", id: "Notifikasi aktif untuk semua ini. Ubah di Pengaturan." })}
        </p>
        <button onClick={() => go("today")} className={cx("h-10 rounded-lg px-5 text-[14px] font-semibold", ui.primary, ui.focus)}>
          {tr({ en: "Go to Home", id: "Ke Beranda" })}
        </button>
      </div>
    </div>
  );
}
