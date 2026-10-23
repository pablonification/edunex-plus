// Taking a file's highlights and notes out of the app, what the PDF viewer
// (./pdf-viewer.tsx) and the one for Word documents and text files
// (./file-viewer.tsx) share: the viewer's "⋯" menu with "Salin sorotan dan
// catatan" and "Simpan sebagai Markdown…", how many of each the file has under
// the first (dimmed, with the reason, while it has none). Each highlight goes
// out whole: the viewer finds its text in the file again, since only its first
// words are kept. The Markdown is core/marks-export.ts's; the caller copies or
// saves it (../pdf.tsx).
import { CopyIcon } from "@phosphor-icons/react/dist/csr/Copy";
import { marksMarkdown } from "../../core/marks-export";
import { useFormat, useT } from "../i18n";
import type { Highlights } from "./highlights";
import { Icons, icon } from "./icons";
import { factsLabel } from "./layout";
import { Menu } from "./menu";
import type { PageNotes } from "./page-notes";

const CopyGlyph = icon(CopyIcon);

/** Copies the Markdown, or saves it as a file the Student picks; the caller says how it went. */
export type ExportMarks = (markdown: string, how: "copy" | "save") => Promise<void>;

/** The whole text of each highlight the viewer found in the file now, by its id. */
export type WholeTexts = () => Promise<ReadonlyMap<string, string>>;

/** The viewer's "⋯" menu for its toolbar; none where the file's highlights and notes can't go out (not Edunex's). */
export function MarksMenu({
  name,
  course,
  highlights,
  notes,
  wholeTexts,
  onExport,
}: {
  name: string;
  course?: string;
  highlights?: Highlights;
  notes?: PageNotes;
  wholeTexts: WholeTexts;
  onExport?: ExportMarks;
}) {
  const t = useT();
  const f = useFormat();
  if (!onExport || (!highlights && !notes)) return null;
  const marked = highlights?.items ?? [];
  const noted = notes?.items ?? [];
  const none = !marked.length && !noted.length;

  const run = async (how: "copy" | "save") => {
    const whole = await wholeTexts().catch(() => new Map<string, string>());
    const markdown = marksMarkdown(
      { name, course, date: f.dateYear(Date.now()), highlights: marked.map((h) => ({ ...h, whole: whole.get(h.id) })), notes: noted },
      t,
    );
    await onExport(markdown, how);
  };

  return (
    <Menu
      label={t("viewer.more")}
      trigger={{ icon: <Icons.MoreHorizontal className="size-4" /> }}
      items={[
        {
          label: t("export.copy"),
          hint: none
            ? t("export.none")
            : factsLabel(
                marked.length ? t("export.highlights", { count: marked.length }) : null,
                noted.length ? t("export.notes", { count: noted.length }) : null,
              ),
          icon: <CopyGlyph className="size-4" />,
          disabled: none,
          onSelect: () => void run("copy"),
        },
        { label: t("export.save"), hint: t("export.saveHint"), icon: <Icons.Download className="size-4" />, disabled: none, onSelect: () => void run("save") },
      ]}
    />
  );
}
