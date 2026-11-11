// The Modul tab on the phone (S17, src/app/screens/course/modules.tsx), in round 2's v4: Edunex's table of contents
// ("Daftar isi": each Edunex course's course-wide items as its Introduction, then every module Edunex lists by Edunex's
// own number; the joint class's after the class's own, under its own title) as white cards of rows on the page's grey.
// A row: the module's number on a tile in the course's colour (neutral when it's empty, greyed with a lock when the
// lecturer hasn't opened it), its title, what's in it ("1 tugas · 1 PDF") and at most one chip (open Tasks, else
// "Minggu ini" on the module new material came to this week, or "Terbaru" on the newest when none did: round 3's
// blind pair couldn't tell which module was this week's, and Edunex gives modules no dates). Tapping one opens it as a screen of its own (ModulePage, ./module-screen.tsx,
// /course/<code>/module/<id>): its Tasks and materials, drawn the way Edunex draws them (notes and pictures in full, a
// link by its own words, every other kind as a row doing the one thing that fits it), each with when it was posted,
// and who posted them once under the list. Files download once and open in the phone's own apps (../../parts/files.tsx,
// W1); links open as a lecturer's link does (Edunex's and SIX's pages in the app, signed in); highlights and page notes
// stay on the desktop (A14).

import { type ReactNode, useMemo } from "react";
import { ActivityIndicator, View } from "react-native";
import { useOpenExternal, useOpenLink } from "../../../../src/app/hooks";
import { type Format, type Translate, useFormat, useNow, useT } from "../../../../src/app/i18n";
import { type CoursePage, isOpenTask } from "../../../../src/app/screens/course/data";
import { edunexMaterialUrl, type MaterialKind, materialAction, materialKind, uploadExtension, VICON_PROVIDERS } from "../../../../src/core/course-materials";
import { linkHost } from "../../../../src/core/links";
import type { Material } from "../../../../src/core/models";
import { taskStatus } from "../../../../src/core/tasks";
import { FILE_KINDS, FileProblemNote, useEdunexFile } from "../../parts/files";
import { hold } from "../../parts/hold";
import { LecturerHtml } from "../../parts/lecturer-html";
import { BHeading } from "../../ui/b";
import { EmptyState } from "../../ui/display";
import { Rise } from "../../ui/expressive";
import { useToneTile } from "../../ui/icon-tile";
import { type IconProps, Icons } from "../../ui/icons";
import { factsLabel } from "../../ui/layout";
import { Appear } from "../../ui/moves";
import { PressScale } from "../../ui/press";
import { ROW_SIDE } from "../../ui/row-end";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { CourseTile, useCourseTile } from "../../ui/tile";
import { ROW_INSET, SectionTitle, StatusChip, TileRow } from "../../ui/v4-list";
import { TaskRow } from "../tasks/rows";
import { contentsOf, countFacts, currentEntry, dayAndTime, type Entry, entrySlug } from "./contents";

/** The table of contents; picking a module opens its own screen (`onPick`). */
export function ModulesTab({
  page,
  onPick,
  classModule = null,
  saidAbove = null,
}: {
  page: CoursePage;
  onPick: (module: number) => void;
  classModule?: number | null;
  /** The module the block above the tabs already names (./now.tsx's `moduleSaidAbove`). */
  saidAbove?: number | null;
}) {
  const t = useT();
  const theme = useTheme();
  const entries = contentsOf(page, t);
  if (!entries.length) return <EmptyState icon={<Icons.BookOpen size={24} color={theme.color.onSecondaryContainer} />} title={t("course.noMaterials")} />;
  return <Contents entries={entries} code={page.course.code} name={page.course.name} onPick={onPick} classModule={classModule} saidAbove={saidAbove} />;
}

/**
 * The module `module` names among a course's contents (picked from them, or asked for by search, an alert or a
 * Task's way up), or the course's Introduction (introModule). A Task's module the contents don't list as opened
 * (Edunex's outline leaves it out): where its Tasks are.
 */
export function moduleEntry(entries: readonly Entry[], module: number): Entry | undefined {
  const opened = entries.filter((e) => !e.unopened);
  return opened.find((e) => e.id === String(module)) ?? opened.find((e) => e.tasks.some((task) => task.moduleId === module));
}

function Contents({
  entries,
  code,
  name,
  onPick,
  classModule,
  saidAbove,
}: {
  entries: Entry[];
  code: string;
  name: string;
  onPick: (module: number) => void;
  /** The module the course's latest class was on (the course's page works it out from its meetings), when it's known. */
  classModule: number | null;
  /** The module the block above the tabs names: it isn't said again as the tab's lead row. */
  saidAbove: number | null;
}) {
  const t = useT();
  const now = useNow();
  // The module the course is on: the one its class is on (round 1: the list started at module 1 while the class was on
  // module 7), else the one new material came to this week, else the newest.
  const current = useMemo(() => {
    const byClass = classModule === null ? undefined : entries.find((entry) => !entry.unopened && !entry.intro && entry.id === String(classModule));
    return byClass ? { entry: byClass, thisWeek: true, byClass: true } : currentEntry(entries, now);
  }, [entries, now, classModule]);
  // Its files unfolded at the top: "this week's material, opened, in two taps" (Kuliah's course, then the file). With
  // no files yet there is no heading at all (never a sentence saying so). Below, the whole table of contents, the
  // module the class is on marked "sekarang", its number in a filled circle.
  const unfolded = current && current.entry.materials.length > 0 ? current : undefined;
  // With no files to unfold, the module itself leads the tab under "Minggu ini" (round 4: "the list starts at 1 while
  // the card says Modul 7"; round 2 had this week on top): on screen with no scrolling, and out of the list under it
  // ("Modul lain"), so it's said once. Not when it's the list's first row anyway.
  // Not when the block above the tabs names that module already (its title, said twice on one screen): then it stays in
  // the list at its own number, marked, and the list needs no "Modul lain" over it.
  const above = current !== undefined && saidAbove !== null && current.entry.id === String(saidAbove);
  const lead = current && !unfolded && !above && entries[0] !== current.entry ? current : undefined;
  const listed = lead ? entries.filter((entry) => entry !== lead.entry) : entries;
  // The class's own, then the joint class's under its own title (both can have a Modul 1).
  const firstParent = listed.findIndex((e) => e.parent);
  const groups = (firstParent === -1 ? [listed] : [listed.slice(0, firstParent), listed.slice(firstParent)]).filter((group) => group.length > 0);
  return (
    <View testID="list.course.contents">
      {unfolded && <CurrentModule entry={unfolded.entry} thisWeek={unfolded.thisWeek} />}
      {lead && (
        <View testID="module.current">
          <BHeading style={{ marginBottom: 0 }}>{t(lead.thisWeek ? "course.thisWeek" : "course.latest")}</BHeading>
          <View style={{ marginHorizontal: -ROW_SIDE }}>
            <ModuleRow entry={lead.entry} first code={code} name={name} onPick={onPick} now={null} here />
          </View>
        </View>
      )}
      {groups.map((group, g) => {
        const joint = group[0]?.parent ?? false;
        return (
          <View key={joint ? "joint" : "own"}>
            {joint ? (
              <SectionTitle first={g === 0 && !unfolded && !lead}>{t("course.jointClass")}</SectionTitle>
            ) : (
              (unfolded || lead) && (
                <BHeading style={{ marginTop: space[6], marginBottom: 0 }}>{t(lead ? "mobile.course.material.others" : "mobile.course.material.all")}</BHeading>
              )
            )}
            {/* Flat on the page, a hairline between rows: the same in light and dark. */}
            <View style={{ marginHorizontal: -ROW_SIDE }}>
              {group.map((entry, i) => (
                <ModuleRow
                  key={entry.id}
                  entry={entry}
                  first={i === 0}
                  code={code}
                  name={name}
                  onPick={onPick}
                  // The module the class is on says "sekarang"; one picked by its material says "Minggu ini" or
                  // "Terbaru", unless the heading above already did. Its number sits in a filled circle.
                  now={current?.entry !== entry ? null : "byClass" in current ? "class" : unfolded ? null : current.thisWeek ? "week" : "latest"}
                  here={current?.entry === entry}
                />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/**
 * The files of the module the course is on, open in place under "Materi minggu ini" (or "Materi terbaru" when nothing
 * came this week), each one tap from open. The module isn't named here: the class's block above says its topic once,
 * and its row in the list under this (marked "sekarang") opens its own page.
 */
function CurrentModule({ entry, thisWeek }: { entry: Entry; thisWeek: boolean }) {
  const t = useT();
  return (
    <Appear testID="module.current">
      <BHeading style={{ marginBottom: space[1] }}>{t(thisWeek ? "mobile.course.material.thisWeek" : "mobile.course.material.latest")}</BHeading>
      <View style={{ marginHorizontal: -ROW_SIDE }}>
        {entry.materials.map((material, i) => (
          <MaterialRow key={material.id} material={material} first={i === 0} />
        ))}
      </View>
    </Appear>
  );
}

/**
 * A module's number ("3"), bare in the course's ink (no pale square behind it). `here`: the module the course is on,
 * its number on a filled circle of that ink (a mark, not a colour alone). `tint` is kept for its callers.
 */
export function NumberTile({ no, ink, here = false }: { no: string; ink: string; tint?: string; here?: boolean }) {
  const v = useTheme().v4;
  return (
    <View style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
      <View style={here ? { width: 36, height: 36, borderRadius: 18, backgroundColor: ink, alignItems: "center", justifyContent: "center" } : undefined}>
        <Text face="display" weight="extrabold" tabular style={{ color: here ? v.page : ink, fontSize: no.length > 2 ? 16 : here ? 18 : 22, lineHeight: 28 }}>
          {no}
        </Text>
      </View>
    </View>
  );
}

function ModuleRow({
  entry,
  first,
  code,
  name,
  onPick,
  now: mark,
  here = false,
}: {
  entry: Entry;
  first: boolean;
  code: string;
  name: string;
  onPick: (module: number) => void;
  /** The module the course is on: the one its class is on ("sekarang"), else new material this week, else the newest. */
  now: "class" | "week" | "latest" | null;
  /** The module the course is on: its number in a filled circle. */
  here?: boolean;
}) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const v = useTheme().v4;
  const course = useCourseTile()(code);
  const neutral = useToneTile()("neutral");
  const label = entry.intro ? "" : t("course.module", { no: entry.label ?? "" });
  const whose = entry.parent ? t("course.jointClass") : null;
  const testID = `row.module.${entrySlug(t, entry)}`;
  if (entry.unopened) {
    // A date already past while it's still closed would read as "opened on": then it's just greyed.
    const opens = entry.opensAt !== null && entry.opensAt > now ? t("course.opensOn", { when: dayAndTime(f, entry.opensAt) }) : "";
    // As on Edunex: listed, greyed, and nothing to open until the lecturer opens it; the lock says so beside the grey.
    return (
      <TileRow
        testID={testID}
        first={first}
        dim
        leading={<NumberTile no={entry.label ?? ""} ink={v.muted} tint={neutral.tint} />}
        title={entry.title}
        meta={opens || undefined}
        status={<Icons.Lock size={18} color={v.muted} />}
        label={factsLabel(label, opens, `${entry.title}, ${t("course.unopened")}`, whose)}
      />
    );
  }
  const open = entry.tasks.filter((task) => isOpenTask(task, now)).length;
  const empty = entry.tasks.length + entry.materials.length === 0;
  const markText = mark === "class" ? t("mobile.course.material.now") : mark === "week" ? t("course.thisWeek") : mark === "latest" ? t("course.latest") : null;
  // Open Tasks are said in the row's own words on its meta line, in amber ("1 tugas terbuka", "4 tugas, 3 terbuka":
  // round 3's chip "1 terbuka" didn't say what was open), and the row ends in the chevron every row that opens has.
  const openFact =
    open === 0
      ? null
      : open === entry.tasks.length
        ? t("mobile.course.tasksOpen", { count: open })
        : t("mobile.course.tasksOpenOf", { count: entry.tasks.length, open });
  const counts = empty ? [] : countFacts(t, entry).slice(openFact ? 1 : 0);
  const before = open > 0 ? markText : null;
  const facts = [before, openFact, ...counts].filter((x): x is string => !!x);
  // One colour for every opened module's number (round 1: "purple or grey with no clue why"); a closed one is grey
  // with its lock, the current one sits in a filled circle.
  const tile = course;
  // One chip at most: the module the course is on, when the row has nothing to do.
  const status = open === 0 && markText ? <StatusChip tone="brand">{markText}</StatusChip> : undefined;
  const meta = openFact ? (
    <Text size="bodyMedium" tabular style={{ color: v.muted, marginTop: 2 }}>
      {before ? `${before} · ` : ""}
      <Text size="bodyMedium" weight="semibold" tabular style={{ color: v.ambFg }}>
        {openFact}
      </Text>
      {counts.length > 0 ? ` · ${counts.join(" · ")}` : ""}
    </Text>
  ) : (
    facts.join(" · ") || undefined
  );
  return (
    <TileRow
      testID={testID}
      first={first}
      leading={entry.intro ? <CourseTile code={code} name={name} /> : <NumberTile no={entry.label ?? ""} ink={tile.ink} tint={tile.tint} here={here} />}
      title={entry.title}
      meta={meta}
      status={status}
      onPress={() => onPick(Number(entry.id))}
      label={factsLabel(label, ...facts, entry.title, whose, open > 0 ? null : markText, here && !mark ? t("mobile.course.material.current") : null)}
    />
  );
}

/**
 * One module (or a course's Introduction), on its own screen, under the bar that holds its title: where it is on one
 * quiet line ("Modul 3 · Tugas Akhir I"), its Tasks, then its materials, and who posted them.
 */
export function ModulePage({
  entry,
  anyContent,
  course,
}: {
  entry: Entry;
  anyContent: boolean;
  /** The course's name, for the line under the bar's title. */
  course: string;
}) {
  const t = useT();
  const now = useNow();
  const theme = useTheme();
  const v = theme.v4;
  const where = factsLabel(entry.intro ? null : t("course.module", { no: entry.label ?? "" }), entry.parent ? t("course.jointClass") : null, course);
  const empty = entry.tasks.length === 0 && entry.materials.length === 0;
  const both = entry.tasks.length > 0 && entry.materials.length > 0;
  // Who posted the materials, said once under them: most modules are one lecturer's.
  const authors = [...new Set(entry.materials.map((m) => m.createdBy).filter((name): name is string => !!name))];
  return (
    <View testID={`page.module.${entry.id}`}>
      <Rise screen="module" index={0}>
        <Text size="bodyMedium" style={{ color: v.fg2 }}>
          {where}
        </Text>
      </Rise>
      {empty ? (
        <EmptyState
          icon={<Icons.Inbox size={24} color={theme.color.onSecondaryContainer} />}
          title={t(anyContent ? "course.moduleEmpty" : "course.noMaterials")}
        />
      ) : (
        <>
          {entry.tasks.length > 0 && (
            <Rise screen="module" index={1}>
              {both ? <SectionTitle>{t("course.tasks")}</SectionTitle> : <View style={{ height: space[3] }} />}
              <View>
                {entry.tasks.map((task, i) => (
                  <View key={task.id}>
                    {i > 0 && <View style={{ height: 1, marginLeft: space[4], backgroundColor: v.line }} />}
                    <TaskRow task={task} status={taskStatus(task, now)} meta="none" />
                  </View>
                ))}
              </View>
            </Rise>
          )}
          {entry.materials.length > 0 && (
            <Rise screen="module" index={2}>
              {both ? <SectionTitle>{t("course.materials")}</SectionTitle> : <View style={{ height: space[3] }} />}
              <View style={{ marginHorizontal: -ROW_SIDE }}>
                {entry.materials.map((material, i) => (
                  <MaterialRow key={material.id} material={material} first={i === 0} />
                ))}
              </View>
              {authors.length > 0 && (
                <Text size="bodyMedium" style={{ color: v.muted, marginTop: space[3], marginHorizontal: space[1] }}>
                  {t("mobile.module.postedBy", { names: authors.join(" · ") })}
                </Text>
              )}
            </Rise>
          )}
        </>
      )}
    </View>
  );
}

type Glyph = (props: IconProps) => ReactNode;

/** Edunex's own kinds, each a neutral glyph (the app's one icon family, ui/icons.tsx). */
const KIND_GLYPH: Record<MaterialKind, Glyph> = {
  pdf: Icons.FilePdf,
  vicon: Icons.Video,
  note: Icons.StickyNote,
  video: Icons.Video,
  audio: Icons.FileAudio,
  link: Icons.Link,
  file: Icons.Paperclip,
  image: Icons.Image,
  page: Icons.Globe,
  interactive: Icons.Layers,
  other: Icons.StickyNote,
};

/** A file's extension, lower case, from Edunex's type or the file's name; null when neither says. */
function extensionOf(material: Material, name: string | null): string | null {
  if (materialKind(material.type) === "pdf") return "pdf";
  const upload = uploadExtension(material.type);
  if (upload) return upload.slice(1).toLowerCase();
  return (name && /\.([a-z0-9]{2,5})$/i.exec(name)?.[1]?.toLowerCase()) || null;
}

/** A file's kind as a bare glyph in its kind's ink: no pale square behind it. */
function KindTile({ kind, extension }: { kind: MaterialKind; extension: string | null }) {
  const tone = useToneTile();
  const byExtension = extension ? FILE_KINDS.find(([pattern]) => pattern.test(extension)) : undefined;
  const Glyph = byExtension?.[1] ?? KIND_GLYPH[kind];
  const { ink } = tone(byExtension?.[2] ?? (kind === "pdf" ? "red" : "neutral"));
  return (
    <View style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
      <Glyph size={24} color={ink} />
    </View>
  );
}

/**
 * When an item was posted ("25 Agu 19:52"), and when it last changed if that came later ("· Diperbarui 28 Agu
 * 14:03"), as the desktop's credits say both.
 */
function whenOf(t: Translate, f: Format, material: Material): string | null {
  const { postedAt, updatedAt } = material;
  const posted = postedAt === null ? null : dayAndTime(f, postedAt);
  if (updatedAt !== null && (postedAt === null || Math.abs(updatedAt - postedAt) >= 60_000))
    return factsLabel(posted, t("note.updated", { when: dayAndTime(f, updatedAt) }));
  return posted;
}

/** `"` and `<` kept out of a picture's address, for the one-picture HTML an image material is drawn from. */
const attr = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

const rowStyle = { flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: ROW_SIDE, paddingVertical: space[3], minHeight: 68 } as const;

/**
 * One material, as a module's page lists it. Materi (../material) lists the same rows under each module: there a note
 * or a picture is a row that opens its module's page (`onRead`) instead of being read in place, and an item that came
 * this week says so first on its quiet line (`fresh`).
 */
export function MaterialRow({ material, first, onRead, fresh }: { material: Material; first: boolean; onRead?: () => void; fresh?: string }) {
  const t = useT();
  const f = useFormat();
  const v = useTheme().v4;
  const openExternal = useOpenExternal();
  const openLink = useOpenLink();
  const kind = materialKind(material.type);
  const action = materialAction(material);
  const when = whenOf(t, f, material);
  const testID = `row.material.${material.id}`;
  const extension = extensionOf(material, action.kind === "download" ? action.name : null);
  const tile = <KindTile kind={kind} extension={extension} />;

  if ((action.kind === "note" || action.kind === "image") && onRead) {
    const meta = factsLabel(fresh, t(`material.${kind}`), when);
    return (
      <TileRow testID={testID} first={first} leading={tile} title={material.title} meta={meta} onPress={onRead} label={factsLabel(material.title, meta)} />
    );
  }
  // Notes and pictures are read right here, in full, as on Edunex: the title and when, then what the lecturer posted.
  if (action.kind === "note" || action.kind === "image")
    return (
      <View testID={testID}>
        <TileRow first={first} leading={tile} title={material.title} meta={when ?? undefined} />
        <View style={{ paddingHorizontal: ROW_SIDE, paddingBottom: space[4] }}>
          {action.kind === "image" ? (
            // The picture through the same reader as a note's pictures (Edunex's storage, read in by the host).
            <LecturerHtml html={`<img src="${attr(action.url)}">`} pictureAlt={material.title} edunexUrl={edunexMaterialUrl(material)} />
          ) : action.html ? (
            <LecturerHtml html={action.html} edunexUrl={edunexMaterialUrl(material)} />
          ) : (
            <Text size="body" style={{ color: v.muted }}>
              {t("note.empty")}
            </Text>
          )}
        </View>
      </View>
    );

  const size = material.sizeBytes ? f.fileSize(material.sizeBytes) : null;
  const where = action.kind === "open" ? linkHost(action.url) : null;
  // What it is ("PDF", "ZIP"; "Kelas online · Microsoft Teams"), then its size or where it goes, then when.
  let what: string[];
  if (kind === "pdf") what = [t("material.pdf")];
  else if (kind === "vicon") what = [t("material.vicon"), ...(VICON_PROVIDERS[material.type] ? [VICON_PROVIDERS[material.type]!] : [])];
  else if (extension && (kind === "file" || uploadExtension(material.type))) what = [extension.toUpperCase()];
  else what = [t(`material.${kind}`)];
  const facts = [fresh, ...what, kind !== "vicon" && where ? where : kind !== "vicon" && size ? size : null, when];
  const meta = factsLabel(...facts);

  if (action.kind === "download")
    return <FileItem material={material} file={{ url: action.url, name: action.name }} first={first} tile={tile} meta={meta} testID={testID} />;

  // A lecturer's link, or anything else: the row does the one thing that fits it (a link opens as a lecturer's link
  // does, a class is joined, the rest opens on Edunex), the arrow saying it leaves this screen.
  let verb: string;
  let go: () => void;
  if (action.kind === "join") [verb, go] = [t("material.join"), () => openExternal(action.url)];
  else if (action.kind === "open") [verb, go] = [t("material.open"), () => openLink(action.url)];
  else [verb, go] = [t("action.openInEdunex"), () => openExternal(action.url || edunexMaterialUrl(material))];
  return (
    <TileRow
      testID={testID}
      first={first}
      leading={tile}
      title={material.title}
      meta={meta}
      status={<Icons.ArrowUpRight size={18} color={v.muted} />}
      onPress={go}
      label={factsLabel(kind === "link" ? material.title : `${verb}: ${material.title}`, ...facts, where ? t("link.opensIn", { host: where }) : null)}
    />
  );
}

/**
 * A lecturer's file (W1): the row opens it in the phone's own app, downloading it once. One mark at its end, the same
 * as Materi's rows: the chevron (it opens here), a spinner while it downloads. Once it's on the phone, tap and hold
 * shares it (a screen reader hears that as the row's hint). What went wrong stays under the row with the way
 * forward (FileProblemNote), never a snackbar.
 */
function FileItem({
  material,
  file,
  first,
  tile,
  meta,
  testID,
}: {
  material: Material;
  file: { url: string; name: string };
  first: boolean;
  tile: ReactNode;
  meta: string;
  testID: string;
}) {
  const t = useT();
  const v = useTheme().v4;
  const edunexUrl = edunexMaterialUrl(material);
  const { here, busy, open, share, problem } = useEdunexFile(file, edunexUrl, { inline: true });
  return (
    <View>
      {!first && <View style={{ position: "absolute", top: 0, left: ROW_INSET, right: 0, height: 1, backgroundColor: v.line }} />}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <PressScale
          testID={testID}
          accessibilityLabel={factsLabel(t("mobile.file.openFor", { name: material.title }), meta)}
          accessibilityState={{ busy }}
          onPress={() => void open()}
          onLongPress={
            here
              ? () => {
                  hold();
                  void share();
                }
              : undefined
          }
          accessibilityHint={here ? t("mobile.file.shareFor", { name: file.name }) : undefined}
          style={[rowStyle, { flex: 1 }]}
        >
          {tile}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text size="bodyLarge" weight="medium" style={{ color: v.fg, lineHeight: 21 }}>
              {material.title}
            </Text>
            <Text size="bodyMedium" tabular style={{ color: v.muted, marginTop: 2 }}>
              {meta}
            </Text>
          </View>
          {busy ? <ActivityIndicator size="small" color={v.muted} /> : <Icons.ChevronRight size={20} color={v.muted} />}
        </PressScale>
      </View>
      {problem && (
        <FileProblemNote
          problem={problem}
          name={file.name}
          edunexUrl={edunexUrl}
          onRetry={() => void open()}
          onShare={share}
          testID={`${testID}.problem`}
          style={{ paddingLeft: ROW_INSET, paddingRight: ROW_SIDE }}
        />
      )}
    </View>
  );
}
