// @vitest-environment jsdom
// Whether a draft written on Edunex's website opens in the app's writing box:
// only when saving it again can't lose anything the lecturer sees in it.
import { describe, expect, it } from "vitest";
import { editableInApp } from "../../src/app/answer-html";

describe("a draft from Edunex's website in the writing box", () => {
  it("opens for editing when it holds only the plain formatting the box keeps", () => {
    for (const html of [
      "<p>Jawaban.</p>",
      "<h2>Judul</h2><p><strong>tebal</strong> <i>miring</i> <u>garis</u> <s>coret</s><br>baris</p><ul><li>satu</li></ul><ol><li>dua</li></ol><blockquote><p>kutip</p></blockquote>",
      '<p><a href="https://drive.google.com/x" target="_blank" rel="noopener noreferrer">tautan</a></p>',
      '<pre><code class="language-plaintext">kode</code></pre>',
      // What pasting from a document leaves on Edunex: it shows nothing.
      '<p><span style="background-color:transparent;color:#000000;">Dari dokumen</span></p>',
    ])
      expect(editableInApp(html), html).toBe(true);
  });

  it("stays as it is when the box would drop what shows: colours, sizes, highlights, centring, indents, embeds", () => {
    for (const html of [
      '<p style="text-align:center">Judul</p>',
      '<p style="margin-left:40px">Menjorok</p>',
      '<p>Kata <span style="color:#e74c3c">merah</span></p>',
      '<p><span class="text-big">besar</span></p>',
      '<p><span style="background-color:hsl(60,75%,60%)">stabilo</span></p>',
      '<p><mark class="marker-yellow">stabilo</mark></p>',
      '<div class="raw-html-embed"><p>HTML</p></div>',
      "<h1>Judul</h1>",
      "<p>Atas</p><hr><p>Bawah</p>",
      '<ol start="3"><li>tiga</li></ol>',
      '<p><a href="halaman.html">tautan relatif</a></p>',
      // Black in a link isn't the colour the link gets back.
      '<p><a href="https://x.id"><span style="color:#000000">tautan hitam</span></a></p>',
      '<p>Lihat <img src="https://a/b.png"></p>',
      "<p>H<sub>2</sub>O</p>",
    ])
      expect(editableInApp(html), html).toBe(false);
  });
});
