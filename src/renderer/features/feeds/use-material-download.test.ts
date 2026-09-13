/* @vitest-environment jsdom */

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toMaterialItems } from "./feed-data";
import { MaterialsList } from "./feed-panels";

let cleanup: (() => void) | undefined;

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  vi.restoreAllMocks();
  // @ts-expect-error — test-only cleanup of the bridge mock.
  delete window.edunex;
});

const fixture = [
  {
    id: 9001,
    name: "Week 05 — Slides",
    course_code: "II4091",
    course_name: "Final Project Proposal",
    file_name: "Week-05-Slides.pdf",
    file_url: "/blob-storage/materials/9001/Week-05-Slides.pdf",
    size: 245760,
  },
];

function installBridge(downloadMaterial: (...args: unknown[]) => Promise<unknown>) {
  window.edunex = {
    downloadMaterial,
  } as unknown as Window["edunex"];
}

async function renderList() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  cleanup = () => {
    root.unmount();
    container.remove();
  };
  await act(async () => {
    root.render(createElement(MaterialsList, { items: toMaterialItems(fixture) }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return container;
}

describe("materials download action (explicit user action)", () => {
  it("sends the cached file URL + name through main and shows the saved path", async () => {
    const downloadMaterial = vi.fn(async () => ({
      ok: true as const,
      filePath: "/tmp/Week-05-Slides.pdf",
    }));
    installBridge(downloadMaterial);
    const container = await renderList();

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Download Week 05 — Slides"]')!
        .click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(downloadMaterial).toHaveBeenCalledWith({
      fileUrl: "/blob-storage/materials/9001/Week-05-Slides.pdf",
      fileName: "Week-05-Slides.pdf",
    });
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "Saved to /tmp/Week-05-Slides.pdf",
    );
  });

  it("surfaces a download failure inline with a clear error", async () => {
    const downloadMaterial = vi.fn(async () => ({
      ok: false as const,
      error: "Download failed — check your connection and try again.",
    }));
    installBridge(downloadMaterial);
    const container = await renderList();

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Download Week 05 — Slides"]')!
        .click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Download failed — check your connection and try again.",
    );
  });

  it("stays quiet when the save dialog is cancelled", async () => {
    const downloadMaterial = vi.fn(async () => ({
      ok: false as const,
      error: "Download cancelled.",
      cancelled: true,
    }));
    installBridge(downloadMaterial);
    const container = await renderList();

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Download Week 05 — Slides"]')!
        .click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelector('[role="status"]')).toBeNull();
  });
});
