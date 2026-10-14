// What the viewer shows of an old Word document or PowerPoint presentation
// (.doc, .ppt): only their text, which ./doc.ts and ./ppt.ts read. A Word
// document's is on white pages, as paper in both themes, its tables as
// tables; a presentation's is a card per slide, its title then its text. A
// line above says only the text is here, and that the file downloaded has
// its layout. Text is only ever shown as text.
import { useT } from "../i18n";
import type { Block } from "./doc";
import { Icons } from "./icons";
import type { Slide } from "./ppt";

/** A page: white with black text in both themes, as Word's own pages are. */
const PAPER = "flex w-full max-w-3xl flex-col gap-2 bg-white px-16 py-14 text-lead text-black shadow-card ring-1 ring-black/5 [color-scheme:light] select-text";

function TextOnlyNote() {
  const t = useT();
  return (
    <p className="flex items-center gap-1.5 text-small text-muted">
      <Icons.Info className="size-3.5 shrink-0" />
      {t("viewer.textOnly")}
    </p>
  );
}

/** An old Word document's text, page by page, on paper. */
export function DocPages({ pages }: { pages: Block[][] }) {
  return (
    <div className="flex flex-col items-center gap-4 p-6">
      <TextOnlyNote />
      {pages.map((blocks, p) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a document's pages are its positions
        <article key={p} className={PAPER}>
          {blocks.map((block, b) =>
            typeof block === "string" ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: a page's paragraphs are its positions
              <p key={b} className="min-h-[1lh] break-words whitespace-pre-wrap">
                {block}
              </p>
            ) : (
              // biome-ignore lint/suspicious/noArrayIndexKey: a page's tables are its positions
              <table key={b} className="my-1 w-full border-collapse text-body">
                <tbody>
                  {block.rows.map((row, r) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: a table's rows are its positions
                    <tr key={r}>
                      {row.map((cell, c) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: a row's cells are its positions
                        <td key={c} className="border border-black/25 px-2 py-1 align-top break-words whitespace-pre-wrap">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ),
          )}
        </article>
      ))}
    </div>
  );
}

/** An old presentation's slides, a card each: which slide, its title, its text. */
export function SlideCards({ slides }: { slides: Slide[] }) {
  const t = useT();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <TextOnlyNote />
      {slides.map((slide, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a presentation's slides are its positions
        <article key={i} aria-label={t("slides.slide", { number: i + 1, total: slides.length })} className="rounded-xl bg-surface p-5 shadow-card select-text">
          <p className="text-caption text-faint">{t("slides.slide", { number: i + 1, total: slides.length })}</p>
          {slide.title && <h3 className="mt-1 text-title font-semibold break-words">{slide.title}</h3>}
          {slide.text.length > 0 && (
            <div className="mt-2 flex flex-col gap-1.5 text-body">
              {slide.text.map((line, l) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: a slide's paragraphs are its positions
                <p key={l} className="break-words whitespace-pre-wrap">
                  {line}
                </p>
              ))}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
