// The Student's written answer as it goes to Edunex: only the formatting
// Edunex's own editor writes, nothing that could run or hide in the page.
import { describe, expect, it } from "vitest";
import { answerWords, cleanAnswer } from "../../src/engine/sources/edunex/answer-html";

describe("an answer's text before it goes to Edunex", () => {
  it("keeps plain formatting as Edunex's editor writes it", () => {
    expect(cleanAnswer("<p>Berikut <strong>Bab II</strong>, <em>lihat</em> <u>lampiran</u> <s>lama</s>.</p><blockquote><p>Kutipan</p></blockquote>")).toBe(
      "<p>Berikut <strong>Bab II</strong>, <em>lihat</em> <u>lampiran</u> <s>lama</s>.</p><blockquote><p>Kutipan</p></blockquote>",
    );
    // TipTap's lists hold a paragraph per item; CKEditor writes the item's text alone.
    expect(cleanAnswer("<ul><li><p>satu</p></li><li><p>dua</p></li></ul><ol><li><p>a</p><p>b</p></li></ol>")).toBe(
      "<ul><li>satu</li><li>dua</li></ul><ol><li><p>a</p><p>b</p></li></ol>",
    );
    expect(cleanAnswer("<p><b>tebal</b> <i>miring</i></p><h1>Judul</h1>")).toBe("<p><strong>tebal</strong> <em>miring</em></p><h2>Judul</h2>");
  });

  it("drops what could run or hide, and every attribute but a link's address", () => {
    expect(
      cleanAnswer(
        '<p onclick="x()" style="color:red" class="a">Teks<script>alert(1)</script><img src="https://a/b.png" onerror="x()"><iframe src="https://evil"></iframe></p>',
      ),
    ).toBe("<p>Teks</p>");
    expect(cleanAnswer('<p><a href="https://drive.google.com/x" target="_blank" rel="noopener">tautan</a> <a href="javascript:alert(1)">jahat</a></p>')).toBe(
      '<p><a href="https://drive.google.com/x">tautan</a> jahat</p>',
    );
    expect(cleanAnswer('<div><span style="font-size:20px">Dari Word</span></div><table><tr><td>sel</td></tr></table>')).toBe("<p>Dari Word</p><p>sel</p>");
  });

  it("empty paragraphs are only spacing", () => {
    expect(cleanAnswer("<p></p><p>Isi</p><p>&nbsp;</p><p><br></p>")).toBe("<p>Isi</p>");
    expect(cleanAnswer("<p></p>")).toBe("");
  });

  it("the words, to tell an answer with text from an empty one", () => {
    expect(answerWords("<p>&nbsp;</p><p><br></p>")).toBe("");
    expect(answerWords("<p>Lihat <strong>lampiran</strong></p>")).toBe("Lihat lampiran");
  });
});
