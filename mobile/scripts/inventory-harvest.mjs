// Reads what one part of the desktop window shows, in the page (Playwright's
// page.evaluate runs it there, so it uses nothing from outside itself). It
// returns every piece of text a Student can read, with what it sits in: the row
// it belongs to (a list item or table row), the heading over it, and whether it's
// a heading, a button's caption, or a name the screen gives a title to. The
// inventory (./inventory.mjs) turns the pieces into entries.

/**
 * @param {{ root: string, exclude?: string, max?: number }} options
 *   `root`: the part to read (the last match, so the open dialog); `exclude`: parts left out;
 *   `max`: loose text (not in a row) is grouped by the largest box that holds no more than this many pieces.
 */
export function harvest({ root: rootSelector, exclude, max = 8 }) {
  const root = [...document.querySelectorAll(rootSelector)].at(-1);
  if (!root) return null;
  const ROW = "li, tr, [role=row], [role=listitem], [role=option], [role=treeitem], [role=gridcell] > button";
  const BLOCK =
    "section, header, article, [role=dialog], [role=tabpanel], [role=region], [role=alert], [role=status], [role=note], figure, dl, fieldset, form, nav, aside";
  const SKIP = [
    "svg",
    "script",
    "style",
    "template",
    "kbd",
    "[aria-hidden='true']",
    "[data-sep]",
    "[hidden]",
    "[role=tablist]",
    "[role=tooltip]",
    "[role=progressbar]",
    exclude,
  ]
    .filter(Boolean)
    .join(", ");
  const CONTROL = "button, a, [role=button], [role=menuitem], [role=radio], [role=checkbox], [role=switch], [role=tab], summary, label";
  const HEADING = "h1, h2, h3, h4, h5, h6, [role=heading], legend, th, caption, dt";
  const inside = (el, selector) => {
    const hit = el.closest(selector);
    return hit && root.contains(hit) ? hit : null;
  };
  const text = (el) => (el.innerText ?? el.textContent ?? "").replace(/\s+/g, " ").trim();
  const visible = (el) => (el.checkVisibility ? el.checkVisibility({ visibilityProperty: true }) : true);

  // Text nodes, joined per element (a title broken by <wbr> is one piece).
  const byElement = new Map();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node.parentElement;
    if (!el || !node.textContent.trim()) continue;
    if (el.closest(SKIP) && root.contains(el.closest(SKIP))) continue;
    if (!visible(el)) continue;
    // Radio buttons: only the one picked says something (a grade estimate, a view), and only inside a row.
    const radio = inside(el, "[role=radio]");
    if (radio && (radio.getAttribute("aria-checked") !== "true" || !inside(radio, ROW))) continue;
    // A heading reads as one piece, even when it's drawn a word at a time.
    const heading = inside(el, "h1, h2, h3, h4, h5, h6");
    if (heading) byElement.set(heading, text(heading));
    else byElement.set(el, (byElement.get(el) ?? "") + node.textContent);
  }
  // What the Student typed or picked: a score in a calculator, a choice in a select.
  for (const field of root.querySelectorAll("input, select, textarea")) {
    if (field.closest(SKIP) || !visible(field)) continue;
    if (field.matches("input[type=checkbox], input[type=radio], input[type=hidden], input[type=search], input[type=file]")) continue;
    const value = field.matches("select") ? field.selectedOptions[0]?.textContent : field.value;
    if (value?.trim()) byElement.set(field, value);
  }

  const headings = [...root.querySelectorAll("h1, h2, h3, h4, [role=heading]")].filter((h) => !h.closest(SKIP) && visible(h));
  const headingBefore = (el) => {
    let found = null;
    for (const h of headings) {
      if (h === el || h.contains(el)) continue;
      if (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) found = h;
      else break;
    }
    return found ? text(found) : null;
  };
  const label = (el) => {
    const labelled = inside(el, "[aria-labelledby]");
    const by = labelled && document.getElementById(labelled.getAttribute("aria-labelledby").split(" ")[0]);
    if (by && !by.matches("[role=tab]")) return text(by);
    const named = inside(el, "ul[aria-label], ol[aria-label], section[aria-label], table[aria-label], nav[aria-label], [role=list][aria-label]");
    return named?.getAttribute("aria-label") ?? headingBefore(el);
  };

  const rows = [];
  const rowIndex = new Map();
  const rowOf = (el) => {
    const row = inside(el, ROW);
    if (!row) return null;
    if (!rowIndex.has(row)) {
      const ids = [row, ...row.querySelectorAll("[id]")].map((e) => e.id).filter((id) => id && !/^_?r_|^radix-|:r/.test(id));
      rowIndex.set(row, rows.length);
      rows.push({ id: ids[0] ?? null, context: label(row), parent: null, _el: row });
    }
    return rowIndex.get(row);
  };

  // Loose text is grouped by the largest box under its block that holds at most `max` pieces.
  const loose = new Map();
  for (const el of byElement.keys()) {
    if (inside(el, ROW)) continue;
    for (let at = el; at && at !== root.parentElement; at = at.parentElement) loose.set(at, (loose.get(at) ?? 0) + 1);
  }
  const boxes = new Map();
  const boxOf = (el) => {
    const block = inside(el, BLOCK) ?? root;
    const chain = [];
    for (let at = el; at && at !== block; at = at.parentElement) chain.unshift(at);
    const box = [block, ...chain].find((at) => (loose.get(at) ?? 0) <= max) ?? el;
    if (!boxes.has(box)) boxes.set(box, { index: boxes.size, context: box.matches?.(HEADING) ? null : label(box) });
    return boxes.get(box);
  };

  const pieces = [];
  for (const [el, raw] of byElement) {
    const piece = { text: raw.replace(/\s+/g, " ").trim() };
    if (!piece.text) continue;
    const row = rowOf(el);
    if (row !== null) piece.row = row;
    else {
      const box = boxOf(el);
      piece.box = box.index;
      piece.context = box.context;
    }
    if (inside(el, HEADING)) piece.heading = true;
    const control = inside(el, CONTROL);
    if (control && text(control) === piece.text) piece.caption = true;
    const titled = inside(el, "[title]");
    if (titled && titled.getAttribute("title").replace(/\s+/g, " ").trim() === piece.text) piece.titled = true;
    if (inside(el, "[role=alert], [role=status]")) piece.banner = true;
    if (el.matches("input, select, textarea")) piece.field = true;
    pieces.push(piece);
  }
  for (const row of rows) {
    const up = row._el.parentElement && inside(row._el.parentElement, ROW);
    row.parent = up ? (rowIndex.get(up) ?? null) : null;
    delete row._el;
  }
  return { pieces, rows };
}
