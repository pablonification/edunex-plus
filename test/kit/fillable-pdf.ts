// A tiny made-up form as a PDF, built byte by byte: one A4 page with a text
// field (Nama), a check box (Setuju), two radio buttons (Kelas: K01, K02) and
// a drop-down (Prodi). Enough for real pdf.js to show and fill every kind of
// field the viewer handles, with nothing real in it. `fields: false` gives the
// same page with no form at all (a PDF the Student can only add text to).

const page = { width: 595, height: 842 };

/** A field's widget on the page: [left, bottom, right, top] in PDF points. */
const rect = (left: number, top: number, width: number, height: number) => [left, page.height - top - height, left + width, page.height - top];
const pdfRect = (r: number[]) => `[${r.join(" ")}]`;

export function fillablePdf({ fields = true }: { fields?: boolean } = {}): Uint8Array {
  const objects: string[] = [];
  const add = (body: string) => objects.push(body);
  const stream = (dict: string, content: string) => `<< ${dict} /Length ${content.length} >>\nstream\n${content}\nendstream`;

  const labels = [
    "BT /F1 18 Tf 72 780 Td (Formulir contoh) Tj ET",
    "BT /F1 11 Tf 72 730 Td (Nama) Tj ET",
    "BT /F1 11 Tf 72 690 Td (Setuju) Tj ET",
    "BT /F1 11 Tf 72 650 Td (Kelas) Tj ET",
    "BT /F1 11 Tf 72 610 Td (Prodi) Tj ET",
  ].join("\n");

  // 1 catalog, 2 pages, 3 page, 4 content, 5 font
  add(`<< /Type /Catalog /Pages 2 0 R${fields ? " /AcroForm 6 0 R" : ""} >>`);
  add("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  add(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R${fields ? " /Annots [7 0 R 8 0 R 10 0 R 11 0 R 12 0 R]" : ""} >>`,
  );
  add(stream("", labels));
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  if (fields) {
    // 6 form, 7 Nama, 8 Setuju, 9 Kelas (parent), 10 K01, 11 K02, 12 Prodi, 13 an empty look for "on"/"off"
    add("<< /Fields [7 0 R 8 0 R 9 0 R 12 0 R] /DA (/Helv 0 Tf 0 g) /DR << /Font << /Helv 5 0 R >> >> /NeedAppearances true >>");
    add(`<< /Type /Annot /Subtype /Widget /FT /Tx /T (Nama) /V () /DA (/Helv 11 Tf 0 g) /Rect ${pdfRect(rect(140, 98, 240, 20))} /F 4 /P 3 0 R >>`);
    add(
      `<< /Type /Annot /Subtype /Widget /FT /Btn /T (Setuju) /V /Off /AS /Off /MK << /CA (4) >> /AP << /N << /Yes 13 0 R /Off 13 0 R >> >> /Rect ${pdfRect(rect(140, 138, 14, 14))} /F 4 /P 3 0 R >>`,
    );
    add("<< /FT /Btn /Ff 49152 /T (Kelas) /V /Off /Kids [10 0 R 11 0 R] >>");
    for (const [left, value] of [
      [140, "K01"],
      [200, "K02"],
    ] as const)
      add(
        `<< /Type /Annot /Subtype /Widget /Parent 9 0 R /AS /Off /MK << /CA (l) >> /AP << /N << /${value} 13 0 R /Off 13 0 R >> >> /Rect ${pdfRect(rect(left, 178, 14, 14))} /F 4 /P 3 0 R >>`,
      );
    add(
      `<< /Type /Annot /Subtype /Widget /FT /Ch /Ff 131072 /T (Prodi) /Opt [(Teknik Sipil) (Arsitektur) (Planologi)] /V (Teknik Sipil) /DA (/Helv 11 Tf 0 g) /Rect ${pdfRect(rect(140, 218, 160, 20))} /F 4 /P 3 0 R >>`,
    );
    add(stream("/Type /XObject /Subtype /Form /BBox [0 0 14 14]", ""));
  }

  let out = "%PDF-1.7\n";
  const offsets: number[] = [];
  for (const [index, body] of objects.entries()) {
    offsets.push(out.length);
    out += `${index + 1} 0 obj\n${body}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) out += `${String(offset).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}
