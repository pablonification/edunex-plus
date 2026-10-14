// A PowerPoint presentation's slides in the viewer (./file-viewer.tsx), as
// ./slides.ts reads them: each slide a page as wide as the viewer (up to
// 1000 px) at the slide's own shape, white like paper in both themes unless
// it has a background of its own. What's on a slide is placed in % of it and
// its text sized in units of the slide's width (container query units), so a
// slide scales as one. All of it is built as elements from plain data; text
// can be selected, and links open through the app's own link rules.
import type { CSSProperties } from "react";
import { isWebLink } from "../../core/links";
import { useT } from "../i18n";
import type { Deck, Item, Paragraph, Run, TextBody } from "./slides";

/** Points in EMU. */
const POINT = 12700;
/** PowerPoint's single line spacing, as a multiple of the text's size. */
const SINGLE = 1.2;

/** The presentation's visible slides, one under the other. */
export function SlideDeck({ deck, onOpenLink }: { deck: Deck; onOpenLink: (url: string) => void }) {
  const t = useT();
  /** A length on the slide, as a share of its width that scales with it. */
  const scaled = (emu: number) => `${(emu / deck.width) * 100}cqw`;
  const across = (emu: number) => `${(emu / deck.width) * 100}%`;
  const down = (emu: number) => `${(emu / deck.height) * 100}%`;
  const color = (hex: string | null) => (hex ? `#${hex}` : undefined);

  const run = (r: Run, key: number) => {
    if (r.text === "\n") return <br key={key} />;
    const style: CSSProperties = {
      fontSize: scaled(r.size * POINT),
      fontWeight: r.bold ? 700 : undefined,
      fontStyle: r.italic ? "italic" : undefined,
      textDecorationLine: [r.underline && "underline", r.strike && "line-through"].filter(Boolean).join(" ") || undefined,
      textTransform: r.caps ? "uppercase" : undefined,
      color: color(r.color),
      fontFamily: r.font ? `"${r.font}", sans-serif` : undefined,
    };
    const link = r.link;
    if (!link) {
      return (
        <span key={key} style={style}>
          {r.text}
        </span>
      );
    }
    return (
      <a
        key={key}
        href={link}
        style={style}
        onClick={(event) => {
          event.preventDefault();
          if (isWebLink(link)) onOpenLink(link);
        }}
        // A middle click would open the link in a new window.
        onAuxClick={(event) => event.preventDefault()}
      >
        {r.text}
      </a>
    );
  };

  const paragraph = (p: Paragraph, index: number) => (
    <p
      key={index}
      style={{
        textAlign: p.align,
        fontSize: scaled(p.size * POINT),
        lineHeight: p.lineSpacing * SINGLE,
        paddingLeft: scaled(p.margin),
        textIndent: scaled(p.indent),
        // PowerPoint leaves out the space before a box's first paragraph.
        marginTop: index > 0 ? scaled(p.spaceBefore * POINT) : 0,
        marginBottom: scaled(p.spaceAfter * POINT),
      }}
    >
      {p.bullet && (
        <span
          // A bullet is decoration; a list's number or letter is read out.
          aria-hidden={!/[\p{L}\p{N}]/u.test(p.bullet.text)}
          className="inline-block indent-0"
          style={{ minWidth: p.indent < 0 ? scaled(-p.indent) : undefined, color: color(p.bullet.color), fontSize: scaled(p.bullet.size * POINT) }}
        >
          {p.bullet.text}
          {p.indent >= 0 && " "}
        </span>
      )}
      {p.runs.length ? p.runs.map(run) : <br />}
    </p>
  );

  const text = (body: TextBody) => ({
    style: {
      padding: body.inset.map(scaled).join(" "),
      justifyContent: body.anchor === "middle" ? "center" : body.anchor === "bottom" ? "flex-end" : "flex-start",
    },
    className: body.wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre",
    children: body.paragraphs.map(paragraph),
  });

  const item = (it: Item, key: number) => {
    if (it.kind === "line") {
      const [dx, dy] = [it.to.x - it.from.x, it.to.y - it.from.y];
      return (
        <div
          key={key}
          className="absolute origin-top-left"
          style={{
            left: across(it.from.x),
            top: down(it.from.y),
            width: across(Math.hypot(dx, dy)),
            borderTop: `max(1px, ${scaled(it.stroke.width)}) solid #${it.stroke.color}`,
            transform: `rotate(${Math.atan2(dy, dx)}rad)`,
          }}
        />
      );
    }
    const box: CSSProperties = {
      left: across(it.box.x),
      top: down(it.box.y),
      width: across(it.box.width),
      height: down(it.box.height),
      transform: it.box.rotation ? `rotate(${it.box.rotation}deg)` : undefined,
    };
    if (it.kind === "picture") {
      const [l, t, r, b] = it.crop;
      const [w, h] = [1 - l - r, 1 - t - b];
      return (
        <div key={key} className="absolute overflow-hidden" style={box}>
          <img
            src={it.url}
            alt=""
            draggable={false}
            loading="lazy"
            decoding="async"
            className="absolute max-w-none"
            style={{
              left: `${(-l / w) * 100}%`,
              top: `${(-t / h) * 100}%`,
              width: `${100 / w}%`,
              height: `${100 / h}%`,
              transform: it.flip.x || it.flip.y ? `scale(${it.flip.x ? -1 : 1}, ${it.flip.y ? -1 : 1})` : undefined,
            }}
          />
        </div>
      );
    }
    if (it.kind === "table") {
      const total = it.columns.reduce((sum, w) => sum + w, 0) || 1;
      return (
        <div key={key} className="absolute" style={box}>
          <table className="w-full table-fixed border-collapse" style={{ fontSize: scaled(it.size * POINT), lineHeight: SINGLE }}>
            <colgroup>
              {it.columns.map((w, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: a table's columns are its positions
                <col key={index} style={{ width: `${(w / total) * 100}%` }} />
              ))}
            </colgroup>
            <tbody>
              {it.rows.map((row, r) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: a table's rows are its positions
                <tr key={r} style={{ height: down(row.height) }}>
                  {row.cells.map((cell, c) => (
                    <td
                      // biome-ignore lint/suspicious/noArrayIndexKey: a row's cells are its positions
                      key={c}
                      colSpan={cell.columns}
                      rowSpan={cell.rows}
                      className={`border border-black/25 align-top whitespace-pre-wrap break-words ${it.header && r === 0 ? "font-bold" : ""}`}
                      style={{ padding: `${scaled(45720)} ${scaled(91440)}`, backgroundColor: color(cell.fill) }}
                    >
                      {cell.text}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    const shape: CSSProperties = {
      ...box,
      backgroundColor: color(it.fill),
      border: it.outline ? `max(1px, ${scaled(it.outline.width)}) solid #${it.outline.color}` : undefined,
      borderRadius: it.geometry === "ellipse" ? "50%" : it.geometry === "roundRect" ? scaled(Math.min(it.box.width, it.box.height) / 6) : undefined,
    };
    if (!it.text) return <div key={key} className="absolute" style={shape} />;
    const { style, className, children } = text(it.text);
    return (
      <div key={key} className={`absolute flex flex-col ${className}`} style={{ ...shape, ...style }}>
        {children}
      </div>
    );
  };

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-6 p-6">
      {deck.slides.map((slide, index) => (
        <article
          // biome-ignore lint/suspicious/noArrayIndexKey: a presentation's slides are its positions
          key={index}
          aria-label={t("slides.slide", { number: index + 1, total: deck.slides.length })}
          className="@container relative w-full overflow-hidden bg-white text-black shadow-card select-text"
          style={{
            aspectRatio: `${deck.width} / ${deck.height}`,
            backgroundColor: slide.background && "color" in slide.background ? `#${slide.background.color}` : undefined,
          }}
        >
          {slide.background && "picture" in slide.background && (
            <img src={slide.background.picture} alt="" draggable={false} loading="lazy" className="absolute inset-0 size-full object-cover" />
          )}
          {slide.items.map(item)}
        </article>
      ))}
    </div>
  );
}
