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

import { FileIcon } from "phosphor-react-native/src/icons/File";
import { FileAudioIcon } from "phosphor-react-native/src/icons/FileAudio";
import { FileCsvIcon } from "phosphor-react-native/src/icons/FileCsv";
import { FileDocIcon } from "phosphor-react-native/src/icons/FileDoc";
import { FileImageIcon } from "phosphor-react-native/src/icons/FileImage";
import { FilePdfIcon } from "phosphor-react-native/src/icons/FilePdf";
import { FilePptIcon } from "phosphor-react-native/src/icons/FilePpt";
import { FileVideoIcon } from "phosphor-react-native/src/icons/FileVideo";
import { FileXlsIcon } from "phosphor-react-native/src/icons/FileXls";
import { FileZipIcon } from "phosphor-react-native/src/icons/FileZip";
import { GlobeIcon } from "phosphor-react-native/src/icons/Globe";
import { ImageIcon } from "phosphor-react-native/src/icons/Image";
import { LinkSimpleIcon } from "phosphor-react-native/src/icons/LinkSimple";
import { NoteIcon } from "phosphor-react-native/src/icons/Note";
import { ShareNetworkIcon } from "phosphor-react-native/src/icons/ShareNetwork";
import { StackIcon } from "phosphor-react-native/src/icons/Stack";
import { VideoCameraIcon } from "phosphor-react-native/src/icons/VideoCamera";
import { type ComponentType, type ReactNode, useMemo } from "react";
import { ActivityIndicator, View } from "react-native";
import { useOpenExternal, useOpenLink } from "../../../../src/app/hooks";
import { type Format, type Translate, useFormat, useNow, useT } from "../../../../src/app/i18n";
import { type CoursePage, isOpenTask } from "../../../../src/app/screens/course/data";
import { edunexMaterialUrl, type MaterialKind, materialAction, materialKind, uploadExtension, VICON_PROVIDERS } from "../../../../src/core/course-materials";
import { linkHost } from "../../../../src/core/links";
import type { Material } from "../../../../src/core/models";
import { taskStatus } from "../../../../src/core/tasks";
import { FileProblemNote, useEdunexFile } from "../../parts/files";
import { LecturerHtml } from "../../parts/lecturer-html";
import { IconButton } from "../../ui/controls";
import { EmptyState } from "../../ui/display";
import { Rise } from "../../ui/expressive";
import { IconTile, type TileTone, useToneTile } from "../../ui/icon-tile";
import { Icons } from "../../ui/icons";
import { factsLabel } from "../../ui/layout";
import { PressScale } from "../../ui/press";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { CourseTile, useCourseTile } from "../../ui/tile";
import { CardGroup, ROW_INSET, SectionTitle, StatusChip, TileRow } from "../../ui/v4-list";
import { TaskRow } from "../tasks/rows";
import { contentsOf, countFacts, currentEntry, dayAndTime, type Entry, entrySlug } from "./contents";

/** The table of contents; picking a module opens its own screen (`onPick`). */
export function ModulesTab({ page, onPick }: { page: CoursePage; onPick: (module: number) => void }) {
  const t = useT();
  const theme = useTheme();
  const entries = contentsOf(page, t);
  if (!entries.length) return <EmptyState icon={<Icons.BookOpen size={24} color={theme.color.onSecondaryContainer} />} title={t("course.noMaterials")} />;
  return <Contents entries={entries} code={page.course.code} name={page.course.name} onPick={onPick} />;
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

function Contents({ entries, code, name, onPick }: { entries: Entry[]; code: string; name: string; onPick: (module: number) => void }) {
  const t = useT();
  const now = useNow();
  const current = useMemo(() => currentEntry(entries, now), [entries, now]);
  // The class's own, then the joint class's under its own title (both can have a Modul 1).
  const firstParent = entries.findIndex((e) => e.parent);
  const groups = (firstParent === -1 ? [entries] : [entries.slice(0, firstParent), entries.slice(firstParent)]).filter((group) => group.length > 0);
  return (
    <View testID="list.course.contents">
      {groups.map((group, g) => {
        const joint = group[0]?.parent ?? false;
        return (
          <View key={joint ? "joint" : "own"}>
            {joint && <SectionTitle first={g === 0}>{t("course.jointClass")}</SectionTitle>}
            <CardGroup>
              {group.map((entry, i) => (
                <ModuleRow
                  key={entry.id}
                  entry={entry}
                  first={i === 0}
                  code={code}
                  name={name}
                  onPick={onPick}
                  now={current?.entry === entry ? (current.thisWeek ? "week" : "latest") : null}
                />
              ))}
            </CardGroup>
          </View>
        );
      })}
    </View>
  );
}

/** A module's number on its tile ("3"), in the course's ink on its tint. */
function NumberTile({ no, ink, tint }: { no: string; ink: string; tint: string }) {
  return (
    <IconTile tint={tint}>
      <Text face="display" weight="bold" tabular style={{ color: ink, fontSize: no.length > 2 ? 14 : 17, lineHeight: 22 }}>
        {no}
      </Text>
    </IconTile>
  );
}

function ModuleRow({
  entry,
  first,
  code,
  name,
  onPick,
  now: mark,
}: {
  entry: Entry;
  first: boolean;
  code: string;
  name: string;
  onPick: (module: number) => void;
  /** The module the course is on: new material this week, else the newest. */
  now: "week" | "latest" | null;
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
  const markText = mark === "week" ? t("course.thisWeek") : mark === "latest" ? t("course.latest") : null;
  // With open Tasks the chip is theirs: the mark leads the meta line instead, so which module is now still shows.
  const facts = [open > 0 ? markText : null, ...(empty ? [] : countFacts(t, entry))].filter((x): x is string => !!x);
  const tile = empty ? { ink: v.muted, tint: neutral.tint } : course;
  // One chip: open Tasks first (something to do), else the module the course is on.
  const status =
    open > 0 ? (
      <StatusChip tone="amber">{t("course.openTasks", { count: open })}</StatusChip>
    ) : markText ? (
      <StatusChip tone="brand">{markText}</StatusChip>
    ) : undefined;
  return (
    <TileRow
      testID={testID}
      first={first}
      leading={entry.intro ? <CourseTile code={code} name={name} /> : <NumberTile no={entry.label ?? ""} ink={tile.ink} tint={tile.tint} />}
      title={entry.title}
      meta={facts.join(" · ") || undefined}
      status={status}
      onPress={() => onPick(Number(entry.id))}
      label={factsLabel(label, ...facts, entry.title, whose, open > 0 ? t("course.openTasks", { count: open }) : null, open > 0 ? null : markText)}
    />
  );
}

/**
 * One module (or a course's Introduction), on its own screen: where it is ("Modul 3 · Tugas Akhir I"), its title big
 * (collapsing into the bar, `onTitleHeight`), its Tasks, then its materials, and who posted them.
 */
export function ModulePage({
  entry,
  anyContent,
  course,
  onTitleHeight,
}: {
  entry: Entry;
  anyContent: boolean;
  /** The course's name, for the line over the title. */
  course: string;
  onTitleHeight?: (height: number) => void;
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
        <View onLayout={(event) => onTitleHeight?.(event.nativeEvent.layout.height)}>
          <Text size="bodyMedium" numberOfLines={1} style={{ color: v.muted }}>
            {where}
          </Text>
          <Text
            face="display"
            weight="bold"
            accessibilityRole="header"
            style={{ color: v.fg, fontSize: 26, lineHeight: 33, letterSpacing: -0.4, marginTop: space[1] }}
          >
            {entry.title}
          </Text>
        </View>
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
              {both ? <SectionTitle>{t("course.tasks")}</SectionTitle> : <View style={{ height: space[6] }} />}
              <CardGroup>
                {entry.tasks.map((task, i) => (
                  <View key={task.id}>
                    {i > 0 && <View style={{ height: 1, marginLeft: space[4], backgroundColor: v.line }} />}
                    <TaskRow task={task} status={taskStatus(task, now)} meta="none" />
                  </View>
                ))}
              </CardGroup>
            </Rise>
          )}
          {entry.materials.length > 0 && (
            <Rise screen="module" index={2}>
              {both ? <SectionTitle>{t("course.materials")}</SectionTitle> : <View style={{ height: space[6] }} />}
              <CardGroup>
                {entry.materials.map((material, i) => (
                  <MaterialRow key={material.id} material={material} first={i === 0} />
                ))}
              </CardGroup>
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

type Glyph = ComponentType<{ size?: number; color?: string; weight?: "duotone" | "fill" | "regular"; duotoneOpacity?: number }>;

/** A file's look by its extension, as phones' file apps colour them: PDF red, Word blue, slides amber, sheets green. */
const BY_EXTENSION: readonly [RegExp, Glyph, TileTone][] = [
  [/^pdf$/, FilePdfIcon, "red"],
  [/^(docx?|odt|rtf)$/, FileDocIcon, "brand"],
  [/^(pptx?|odp|key)$/, FilePptIcon, "amber"],
  [/^csv$/, FileCsvIcon, "ok"],
  [/^(xlsx?|ods)$/, FileXlsIcon, "ok"],
  [/^(zip|rar|7z|tar|gz)$/, FileZipIcon, "neutral"],
  [/^(png|jpe?g|gif|webp|svg|bmp|heic)$/, FileImageIcon, "neutral"],
  [/^(mp4|mov|mkv|avi|webm)$/, FileVideoIcon, "neutral"],
  [/^(mp3|wav|m4a|ogg|aac)$/, FileAudioIcon, "neutral"],
];

/** Edunex's own kinds, each on a neutral tile. */
const KIND_GLYPH: Record<MaterialKind, Glyph> = {
  pdf: FilePdfIcon,
  vicon: VideoCameraIcon,
  note: NoteIcon,
  video: FileVideoIcon,
  audio: FileAudioIcon,
  link: LinkSimpleIcon,
  file: FileIcon,
  image: ImageIcon,
  page: GlobeIcon,
  interactive: StackIcon,
  other: NoteIcon,
};

/** A file's extension, lower case, from Edunex's type or the file's name; null when neither says. */
function extensionOf(material: Material, name: string | null): string | null {
  if (materialKind(material.type) === "pdf") return "pdf";
  const upload = uploadExtension(material.type);
  if (upload) return upload.slice(1).toLowerCase();
  return (name && /\.([a-z0-9]{2,5})$/i.exec(name)?.[1]?.toLowerCase()) || null;
}

function KindTile({ kind, extension }: { kind: MaterialKind; extension: string | null }) {
  const tone = useToneTile();
  const byExtension = extension ? BY_EXTENSION.find(([pattern]) => pattern.test(extension)) : undefined;
  const Glyph = byExtension?.[1] ?? KIND_GLYPH[kind];
  const { ink, tint } = tone(byExtension?.[2] ?? (kind === "pdf" ? "red" : "neutral"));
  return (
    <IconTile tint={tint}>
      <Glyph size={23} color={ink} weight="duotone" duotoneOpacity={0.35} />
    </IconTile>
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

const rowStyle = { flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: 14, paddingVertical: space[3], minHeight: 68 } as const;

export function MaterialRow({ material, first }: { material: Material; first: boolean }) {
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

  // Notes and pictures are read right here, in full, as on Edunex: the title and when, then what the lecturer posted.
  if (action.kind === "note" || action.kind === "image")
    return (
      <View testID={testID}>
        <TileRow first={first} leading={tile} title={material.title} meta={when ?? undefined} />
        <View style={{ paddingHorizontal: 14, paddingBottom: space[4] }}>
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
  const facts = [...what, kind !== "vicon" && where ? where : kind !== "vicon" && size ? size : null, when];
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
 * A lecturer's file (W1): the row opens it in the phone's own app, downloading it once (a spinner meanwhile, the
 * download arrow until it's here); once it's here, Share beside it. What went wrong stays under the row with the way
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
          style={[rowStyle, { flex: 1, paddingRight: here ? space[1] : 14 }]}
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
          {busy ? <ActivityIndicator size="small" color={v.muted} /> : !here && <Icons.Download size={20} color={v.muted} />}
        </PressScale>
        {here && (
          <View style={{ paddingRight: space[1] }}>
            <IconButton label={t("mobile.file.shareFor", { name: file.name })} onPress={share} testID={`${testID}.share`}>
              {/* Android's share glyph; src/ui/icons has no "Share" yet. */}
              <ShareNetworkIcon size={20} color={v.muted} />
            </IconButton>
          </View>
        )}
      </View>
      {problem && (
        <FileProblemNote
          problem={problem}
          name={file.name}
          edunexUrl={edunexUrl}
          onRetry={() => void open()}
          onShare={share}
          testID={`${testID}.problem`}
          style={{ paddingLeft: ROW_INSET, paddingRight: 14 }}
        />
      )}
    </View>
  );
}
