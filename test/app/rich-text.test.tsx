// @vitest-environment jsdom
// Lecturers' HTML, drawn safely and the way Edunex draws it: plain formatting
// kept, everything that could run or restyle the page dropped, empty spacer
// paragraphs removed, links to any web page opening through the app, and
// pictures handed to the caller (or shown as a link to where they are).
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { I18nProvider } from "../../src/app/i18n";
import { TooltipProvider } from "../../src/app/ui/overlays";
import { RichText, type RichTextImage } from "../../src/app/ui/rich-text";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
});

function draw(html: string, options: { renderImage?: (image: RichTextImage) => ReactNode | null; pictureAlt?: string } = {}) {
  const opened: string[] = [];
  const container = document.body.appendChild(document.createElement("div"));
  root = createRoot(container);
  act(() =>
    root!.render(
      <I18nProvider lang="id">
        <TooltipProvider>
          <RichText html={html} onOpenLink={(url) => opened.push(url)} renderImage={options.renderImage} pictureAlt={options.pictureAlt} />
        </TooltipProvider>
      </I18nProvider>,
    ),
  );
  return { container, opened };
}

describe("lecturers' formatted text", () => {
  it("keeps plain formatting and drops scripts, styles, handlers and forms", () => {
    const { container } = draw(
      '<p style="color:red" onclick="alert(1)"><strong>Pertemuan 02:</strong> <em>Jumat</em></p><script>alert(1)</script><style>p{}</style><form><input value="x"></form><ul><li>Satu</li><li>Dua</li></ul>',
    );
    expect(container.querySelector("strong")?.textContent).toBe("Pertemuan 02:");
    expect(container.querySelector("em")?.textContent).toBe("Jumat");
    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(container.querySelector("[style], [onclick], script, style, form, input")).toBeNull();
    expect(container.textContent).not.toContain("alert");
  });

  it("removes CKEditor's empty spacer paragraphs, as Edunex does", () => {
    const { container } = draw("<p>Satu</p><p>&nbsp;</p><p><br></p><li>&nbsp;</li><p>Dua</p>");
    expect([...container.querySelectorAll("p")].map((p) => p.textContent)).toEqual(["Satu", "Dua"]);
  });

  it("makes links of web pages only, http too, and opens them through the app", () => {
    const { container, opened } = draw(
      '<p><a href="https://docs.google.com/x">Topik</a> <a href="http://example.org/">Lama</a> <a href="javascript:alert(1)">Jahat</a> <a href="mailto:a@example.com">Surel</a> <a href="https://u:p@evil.example.com/">Samaran</a></p>',
    );
    const links = [...container.querySelectorAll("a")];
    expect(links.map((a) => a.textContent)).toEqual(["Topik", "Lama"]);
    act(() => links[0].click());
    act(() => links[1].click());
    expect(opened).toEqual(["https://docs.google.com/x", "http://example.org/"]);
    expect(container.textContent).toContain("Jahat");
  });

  it("hands pictures to the caller, shows inline ones as they are, and names any it can't draw by where they are", () => {
    const asked: RichTextImage[] = [];
    const { container } = draw(
      '<figure class="image"><img src="https://edunexfixture.blob.core.windows.net/edunex/fixture-2" alt="Token"><figcaption>Kode kelas</figcaption></figure><img src="data:image/png;base64,iVBORw0KGgo="><img src="data:image/svg+xml;base64,PHN2Zz4="><img src="https://imgur.example/x.png">',
      {
        renderImage: (image) => {
          asked.push(image);
          return image.src.includes("blob.core.windows.net") ? <span data-drawn={image.src} /> : null;
        },
      },
    );
    expect(asked.map((image) => image.alt)).toEqual(["Token", ""]);
    expect(container.querySelector("[data-drawn]")).not.toBeNull();
    expect(container.querySelector("figcaption")?.textContent).toBe("Kode kelas");
    // Only picture formats that never run anything are drawn from the HTML itself.
    expect([...container.querySelectorAll("img")].map((img) => img.getAttribute("src"))).toEqual(["data:image/png;base64,iVBORw0KGgo="]);
    expect([...container.querySelectorAll("a")].map((a) => a.textContent)).toEqual(["Gambar dari imgur.example"]);
  });

  it("an embedded video or page becomes its link instead of vanishing", () => {
    const { container } = draw(
      '<figure class="media"><oembed url="https://www.youtube.com/watch?v=fixture"></oembed></figure><iframe src="https://example.org/embed"></iframe>',
    );
    expect([...container.querySelectorAll("a")].map((a) => a.getAttribute("href"))).toEqual([
      "https://www.youtube.com/watch?v=fixture",
      "https://example.org/embed",
    ]);
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("a linked picture or video is one link: one click opens one page", () => {
    const { container, opened } = draw(
      '<p><a href="https://forms.example/daftar"><img src="https://imgur.example/poster.png"></a></p><p><a href="https://example.org/kelas"><oembed url="https://www.youtube.com/watch?v=fixture"></oembed></a></p>',
    );
    const links = [...container.querySelectorAll("a")];
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["https://forms.example/daftar", "https://example.org/kelas"]);
    expect(links[0].textContent).toBe("Gambar dari imgur.example");
    expect(container.querySelector("a a")).toBeNull();
    act(() => links[0].click());
    expect(opened).toEqual(["https://forms.example/daftar"]);
  });

  it("keeps a table's merged cells, so every later cell stays under its heading", () => {
    const { container } = draw(
      '<table><tr><th colspan="2">Minggu 1</th><th>Minggu 2</th></tr><tr><td>Senin</td><td>Kamis</td><td rowspan="1" colspan="999">Senin</td></tr></table>',
    );
    const cells = [...container.querySelectorAll("th, td")];
    expect(cells.map((cell) => cell.getAttribute("colspan"))).toEqual(["2", null, null, null, null]);
  });

  it("describes a picture written into the HTML without a description of its own", () => {
    const { container } = draw('<img src="data:image/png;base64,iVBORw0KGgo="><img src="data:image/png;base64,iVBORw0KGgo=" alt="Denah ruang">');
    expect([...container.querySelectorAll("img")].map((img) => img.getAttribute("alt"))).toEqual(["Gambar dari dosen", "Denah ruang"]);
  });

  it("names such a picture as the caller says when it isn't the lecturer's (the Student's own answer)", () => {
    const { container } = draw('<img src="data:image/png;base64,iVBORw0KGgo=">', { pictureAlt: "Gambar dalam jawabanmu" });
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("Gambar dalam jawabanmu");
  });
});
