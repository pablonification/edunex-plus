// A check every screen test runs (through the harness): no fact line shows an
// empty fact, and no text begins or ends with a "·" (the Student saw rows end
// in "II4091 ·"). jsdom can't see where a line wraps; `Meta` takes care of that,
// and this catches what layout can't fix: a separator next to a missing fact.

/** Throws with the offending text when something on the page breaks the rule. */
export function assertTidyFacts(root: ParentNode = document.body): void {
  for (const fact of root.querySelectorAll("[data-fact]")) {
    const content = [...fact.children].find((child) => !child.hasAttribute("data-sep"));
    if (!content?.textContent?.trim() && !content?.querySelector("svg, img"))
      throw new Error(`An empty fact in the line "${clip(fact.parentElement?.textContent)}"`);
  }
  for (const element of root.querySelectorAll("*")) {
    const own = [...element.childNodes]
      .filter((node) => node.nodeType === 3)
      .map((node) => node.textContent)
      .join("")
      .trim();
    if (!own.includes("·")) continue;
    // Meta's own dot: decorative, alone in its box.
    if (own === "·" && element.getAttribute("aria-hidden") === "true") continue;
    if (own.startsWith("·") || own.endsWith("·")) throw new Error(`A dangling "·" in "${clip(element.textContent)}"`);
  }
}

const clip = (text: string | null | undefined) => (text ?? "").slice(0, 200);
