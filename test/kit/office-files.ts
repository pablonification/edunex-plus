// Tiny made-up Word documents, Excel workbooks and PowerPoint presentations
// for tests, built here with JSZip: only the parts a reader needs, in the real
// shape. No real course content.
import JSZip from "jszip";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const S = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PR = "http://schemas.openxmlformats.org/package/2006/relationships";
const OFFICE_DOCUMENT = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument";

const zip = async (parts: Record<string, string | Uint8Array>) => {
  const file = new JSZip();
  for (const [path, text] of Object.entries(parts)) file.file(path, text);
  return file.generateAsync({ type: "uint8array", compression: "DEFLATE" });
};

const contentTypes = (main: string, type: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/${main}" ContentType="${type}"/></Types>`;

/** A Word document: a paragraph per line, then a link with this text to `link`. */
export function aDocx({ lines, link }: { lines: string[]; link?: { text: string; url: string } }): Promise<Uint8Array> {
  const paragraphs = lines.map((line) => `<w:p><w:r><w:t xml:space="preserve">${line}</w:t></w:r></w:p>`).join("");
  const hyperlink = link ? `<w:p><w:hyperlink r:id="rIdLink"><w:r><w:t>${link.text}</w:t></w:r></w:hyperlink></w:p>` : "";
  return zip({
    "[Content_Types].xml": contentTypes("word/document.xml", "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"),
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${PR}"><Relationship Id="rId1" Type="${OFFICE_DOCUMENT}" Target="word/document.xml"/></Relationships>`,
    "word/document.xml": `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="${W}" xmlns:r="${R}"><w:body>${paragraphs}${hyperlink}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body></w:document>`,
    "word/_rels/document.xml.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${PR}">${
      link
        ? `<Relationship Id="rIdLink" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${link.url}" TargetMode="External"/>`
        : ""
    }</Relationships>`,
  });
}

/** A cell: text (kept as a shared string), a number, or a date (Excel's day number, shown with a date format). */
type Cell = string | number | { date: number };

/** A workbook: each sheet's rows of cells, by name; `hidden` sheets are in the file but hidden. */
export function anXlsx(sheets: Record<string, Cell[][]>, { hidden = [] as string[] } = {}): Promise<Uint8Array> {
  const shared: string[] = [];
  const names = Object.keys(sheets);
  const parts: Record<string, string> = {
    "[Content_Types].xml": contentTypes("xl/workbook.xml", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"),
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${PR}"><Relationship Id="rId1" Type="${OFFICE_DOCUMENT}" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${S}" xmlns:r="${R}"><sheets>${names
      .map((name, i) => `<sheet name="${name}" sheetId="${i + 1}" r:id="rId${i + 1}"${hidden.includes(name) ? ' state="hidden"' : ""}/>`)
      .join("")}</sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${PR}">${names
      .map(
        (_, i) =>
          `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
      )
      .join("")}</Relationships>`,
    // Style 0 is plain; style 1 shows a date (Excel's own format 14).
    "xl/styles.xml": `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="${S}"><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14" applyNumberFormat="1"/></cellXfs></styleSheet>`,
  };
  names.forEach((name, i) => {
    const rows = sheets[name]
      .map(
        (row, r) =>
          `<row r="${r + 1}">${row
            .map((cell, c) => {
              const ref = `${String.fromCharCode(65 + c)}${r + 1}`;
              if (typeof cell === "number") return `<c r="${ref}"><v>${cell}</v></c>`;
              if (typeof cell === "object") return `<c r="${ref}" s="1"><v>${cell.date}</v></c>`;
              shared.push(cell);
              return `<c r="${ref}" t="s"><v>${shared.length - 1}</v></c>`;
            })
            .join("")}</row>`,
      )
      .join("");
    parts[`xl/worksheets/sheet${i + 1}.xml`] = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${S}"><sheetData>${rows}</sheetData></worksheet>`;
  });
  parts["xl/sharedStrings.xml"] = `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="${S}">${shared.map((text) => `<si><t>${text}</t></si>`).join("")}</sst>`;
  return zip(parts);
}

/** Any ZIP, with these files in it: not a Word document, workbook or presentation unless it holds their parts. */
export const aZip = (parts: Record<string, string>) => zip(parts);

const P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const xmlText = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const box = (x: number, y: number, cx: number, cy: number, tag = "a:xfrm") => `<${tag}><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></${tag}>`;
const relations = (list: [id: string, type: string, target: string, external?: boolean][]) =>
  `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${PR}">${list
    .map(
      ([id, type, target, external]) =>
        `<Relationship Id="${id}" Type="${REL}/${type}" Target="${xmlText(target)}"${external ? ' TargetMode="External"' : ""}/>`,
    )
    .join("")}</Relationships>`;
const textBox = (id: number, text: string, at: string, run = `<a:r><a:rPr lang="id-ID"/><a:t>${xmlText(text)}</a:t></a:r>`) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Teks ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr>${at}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square"/><a:lstStyle/><a:p>${run}</a:p></p:txBody></p:sp>`;

/** One slide of `aPptx`: what's on it, each only when given. */
export interface PptxSlide {
  /** In the title placeholder, which takes its place from the layout. */
  title?: string;
  /** In the body placeholder, whose bullets come from the master. */
  bullets?: string[];
  /** A text box; with a link, its text is a link there (any address, to see which are kept). */
  note?: { text: string; link?: string };
  /** Pictures, side by side: their bytes, under a name with this extension. */
  pictures?: { bytes: Uint8Array; ext: string }[];
  table?: string[][];
  /** Two text boxes in a group, moved and shrunk to half on the slide. */
  group?: [string, string];
  /** Shapes of its own, as the slide's XML (prefixes p: and a:). */
  shapes?: string[];
  hidden?: boolean;
}

/**
 * A presentation (16:9) of these slides, in this order, with one master and
 * layout behind them and a theme. The slides' own files are numbered the
 * other way round, as the order is the presentation's list, not their names.
 */
export function aPptx(slides: PptxSlide[]): Promise<Uint8Array> {
  const parts: Record<string, string | Uint8Array> = {
    "[Content_Types].xml": contentTypes("ppt/presentation.xml", "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"),
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${PR}"><Relationship Id="rId1" Type="${OFFICE_DOCUMENT}" Target="ppt/presentation.xml"/></Relationships>`,
    "ppt/presentation.xml": `<?xml version="1.0" encoding="UTF-8"?><p:presentation xmlns:a="${A}" xmlns:r="${R}" xmlns:p="${P}"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rIdMaster"/></p:sldMasterIdLst><p:sldIdLst>${slides
      .map((_, i) => `<p:sldId id="${256 + i}" r:id="rIdSlide${i}"/>`)
      .join(
        "",
      )}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:defaultTextStyle></p:presentation>`,
    "ppt/_rels/presentation.xml.rels": relations([
      ["rIdMaster", "slideMaster", "slideMasters/slideMaster1.xml"],
      ["rIdTheme", "theme", "theme/theme1.xml"],
      ...slides.map((_, i): [string, string, string] => [`rIdSlide${i}`, "slide", `slides/slide${slides.length - i}.xml`]),
    ]),
    "ppt/theme/theme1.xml": `<?xml version="1.0" encoding="UTF-8"?><a:theme xmlns:a="${A}" name="Tema"><a:themeElements><a:clrScheme name="Tema"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F2A44"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2><a:accent1><a:srgbClr val="4472C4"/></a:accent1><a:accent2><a:srgbClr val="ED7D31"/></a:accent2><a:accent3><a:srgbClr val="A5A5A5"/></a:accent3><a:accent4><a:srgbClr val="FFC000"/></a:accent4><a:accent5><a:srgbClr val="5B9BD5"/></a:accent5><a:accent6><a:srgbClr val="70AD47"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="Tema"><a:majorFont><a:latin typeface="Calibri Light"/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/></a:minorFont></a:fontScheme><a:fmtScheme name="Tema"><a:lnStyleLst><a:ln w="6350"/><a:ln w="12700"/><a:ln w="19050"/></a:lnStyleLst></a:fmtScheme></a:themeElements></a:theme>`,
    // The master: where the title and body sit by default, the title's style and the body's bullets.
    "ppt/slideMasters/slideMaster1.xml": `<?xml version="1.0" encoding="UTF-8"?><p:sldMaster xmlns:a="${A}" xmlns:r="${R}" xmlns:p="${P}"><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:sp><p:nvSpPr><p:cNvPr id="2" name="Judul"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr>${box(838200, 365125, 10500000, 1325563)}</p:spPr><p:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:r><a:t>Judul</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Isi"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr>${box(838200, 1825625, 10500000, 4351338)}</p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Isi</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rIdLayout"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle><a:lvl1pPr algn="l"><a:buNone/><a:defRPr sz="4400"><a:solidFill><a:schemeClr val="tx2"/></a:solidFill><a:latin typeface="+mj-lt"/></a:defRPr></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr marL="228600" indent="-228600"><a:spcBef><a:spcPts val="1000"/></a:spcBef><a:buFont typeface="Arial"/><a:buChar char="•"/><a:defRPr sz="2800"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/></a:defRPr></a:lvl1pPr><a:lvl2pPr marL="685800" indent="-228600"><a:buFont typeface="Arial"/><a:buChar char="–"/><a:defRPr sz="2400"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill></a:defRPr></a:lvl2pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill></a:defRPr></a:lvl1pPr></p:otherStyle></p:txStyles></p:sldMaster>`,
    "ppt/slideMasters/_rels/slideMaster1.xml.rels": relations([
      ["rIdLayout", "slideLayout", "../slideLayouts/slideLayout1.xml"],
      ["rIdTheme", "theme", "../theme/theme1.xml"],
    ]),
    // The layout moves the title down and narrows it, and leaves the body where the master has it.
    "ppt/slideLayouts/slideLayout1.xml": `<?xml version="1.0" encoding="UTF-8"?><p:sldLayout xmlns:a="${A}" xmlns:r="${R}" xmlns:p="${P}" type="obj"><p:cSld name="Judul dan Isi"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:sp><p:nvSpPr><p:cNvPr id="2" name="Judul"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr>${box(1524000, 457200, 9144000, 1143000)}</p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Judul</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Isi"/><p:cNvSpPr/><p:nvPr><p:ph idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Isi</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`,
    "ppt/slideLayouts/_rels/slideLayout1.xml.rels": relations([["rIdMaster", "slideMaster", "../slideMasters/slideMaster1.xml"]]),
  };
  slides.forEach((slide, i) => {
    const n = slides.length - i;
    const rels: [string, string, string, boolean?][] = [["rIdLayout", "slideLayout", "../slideLayouts/slideLayout1.xml"]];
    const shapes: string[] = [];
    if (slide.title !== undefined)
      shapes.push(
        `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Judul"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="id-ID"/><a:t>${xmlText(slide.title)}</a:t></a:r></a:p></p:txBody></p:sp>`,
      );
    if (slide.bullets)
      shapes.push(
        `<p:sp><p:nvSpPr><p:cNvPr id="3" name="Isi"/><p:cNvSpPr/><p:nvPr><p:ph idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>${slide.bullets
          .map((text) => {
            // A bullet starting with two spaces is one level in.
            const level = text.startsWith("  ") ? '<a:pPr lvl="1"/>' : "";
            return `<a:p>${level}<a:r><a:rPr lang="id-ID"/><a:t>${xmlText(text.trim())}</a:t></a:r></a:p>`;
          })
          .join("")}</p:txBody></p:sp>`,
      );
    if (slide.note) {
      const { text, link } = slide.note;
      if (link) rels.push(["rIdLink", "hyperlink", link, true]);
      const run = `<a:r><a:rPr lang="id-ID">${link ? '<a:hlinkClick r:id="rIdLink"/>' : ""}</a:rPr><a:t>${xmlText(text)}</a:t></a:r>`;
      shapes.push(textBox(4, text, box(838200, 6000000, 6000000, 400000), run));
    }
    slide.pictures?.forEach(({ bytes, ext }, p) => {
      const name = `image${n}-${p + 1}.${ext}`;
      parts[`ppt/media/${name}`] = bytes;
      rels.push([`rIdPicture${p}`, "image", `../media/${name}`]);
      shapes.push(
        `<p:pic><p:nvPicPr><p:cNvPr id="${10 + p}" name="Gambar ${p + 1}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rIdPicture${p}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>${box(838200 + p * 3000000, 2000000, 2743200, 2057400)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`,
      );
    });
    if (slide.table) {
      const columns = Math.max(...slide.table.map((row) => row.length));
      shapes.push(
        `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="20" name="Tabel"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>${box(838200, 2000000, 8000000, 1500000, "p:xfrm")}<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr firstRow="1"/><a:tblGrid>${'<a:gridCol w="2000000"/>'.repeat(
          columns,
        )}</a:tblGrid>${slide.table
          .map(
            (row) =>
              `<a:tr h="370840">${row.map((cell) => `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="id-ID" sz="1400"/><a:t>${xmlText(cell)}</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>`).join("")}</a:tr>`,
          )
          .join("")}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`,
      );
    }
    if (slide.group)
      // The group's children are laid out in a space twice its size on the slide, from (1000000, 1000000).
      shapes.push(
        `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="30" name="Grup"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="6000000" y="3000000"/><a:ext cx="2000000" cy="1000000"/><a:chOff x="1000000" y="1000000"/><a:chExt cx="4000000" cy="2000000"/></a:xfrm></p:grpSpPr>${textBox(31, slide.group[0], box(1000000, 1000000, 2000000, 2000000))}${textBox(32, slide.group[1], box(3000000, 1000000, 2000000, 2000000))}</p:grpSp>`,
      );
    shapes.push(...(slide.shapes ?? []));
    parts[`ppt/slides/slide${n}.xml`] =
      `<?xml version="1.0" encoding="UTF-8"?><p:sld xmlns:a="${A}" xmlns:r="${R}" xmlns:p="${P}"${slide.hidden ? ' show="0"' : ""}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${shapes.join("")}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
    parts[`ppt/slides/_rels/slide${n}.xml.rels`] = relations(rels);
  });
  return zip(parts);
}
