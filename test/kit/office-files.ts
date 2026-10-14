// Tiny made-up Word documents and Excel workbooks for tests, built here with
// JSZip: only the parts a reader needs, in the real shape. No real course
// content.
import JSZip from "jszip";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const S = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PR = "http://schemas.openxmlformats.org/package/2006/relationships";
const OFFICE_DOCUMENT = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument";

const zip = async (parts: Record<string, string>) => {
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

/** Any ZIP, with these files in it: not a Word document or a workbook unless it holds their parts. */
export const aZip = (parts: Record<string, string>) => zip(parts);
