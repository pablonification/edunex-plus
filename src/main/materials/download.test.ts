import { describe, expect, it, vi } from "vitest";
import { downloadMaterialFile, sanitizeFileName } from "./download";

function okFileResponse(bytes: number[] = [1, 2, 3]) {
  return new Response(new Uint8Array(bytes), { status: 200 });
}

function baseDeps(overrides: Record<string, unknown> = {}) {
  return {
    baseUrl: "https://api-edunex.cognisia.id",
    getToken: () => "tok-123",
    userAgent: "EdunexPlus/0.0.1",
    showSaveDialog: vi.fn(async () => ({ canceled: false, filePath: "/tmp/Slide-01.pdf" })),
    writeFile: vi.fn(async () => undefined),
    fetchImpl: vi.fn(async () => okFileResponse()),
    ...overrides,
  };
}

describe("material download (explicit user action)", () => {
  it("fetches with the bearer token + User-Agent and saves to the chosen path", async () => {
    const deps = baseDeps();
    const result = await downloadMaterialFile(
      { fileUrl: "/blob-storage/materials/1/file.pdf", fileName: "Slide-01.pdf" },
      deps,
    );

    expect(result).toEqual({ ok: true, filePath: "/tmp/Slide-01.pdf" });
    expect(deps.showSaveDialog).toHaveBeenCalledWith({ defaultPath: "Slide-01.pdf" });
    const [url, init] = (deps.fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://api-edunex.cognisia.id/blob-storage/materials/1/file.pdf");
    expect(init.headers.get("Authorization")).toBe("Bearer tok-123");
    expect(init.headers.get("User-Agent")).toBe("EdunexPlus/0.0.1");
    expect(deps.writeFile).toHaveBeenCalledTimes(1);
    const [savedPath, bytes] = (deps.writeFile as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(savedPath).toBe("/tmp/Slide-01.pdf");
    expect((bytes as Uint8Array).byteLength).toBe(3);
  });

  it("passes absolute file URLs through without prefixing the API base", async () => {
    const deps = baseDeps();
    await downloadMaterialFile(
      { fileUrl: "https://cdn.example.id/files/slide.pdf", fileName: "slide.pdf" },
      deps,
    );

    const [url] = (deps.fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://cdn.example.id/files/slide.pdf");
  });

  it("treats a cancelled save dialog as a quiet cancel without fetching", async () => {
    const deps = baseDeps({ showSaveDialog: vi.fn(async () => ({ canceled: true })) });
    const result = await downloadMaterialFile(
      { fileUrl: "/files/a.pdf", fileName: "a.pdf" },
      deps,
    );

    expect(result).toEqual({ ok: false, error: "Download cancelled.", cancelled: true });
    expect(deps.fetchImpl).not.toHaveBeenCalled();
    expect(deps.writeFile).not.toHaveBeenCalled();
  });

  it("rejects a material with no file URL without touching disk or network", async () => {
    const deps = baseDeps();
    const result = await downloadMaterialFile({ fileUrl: "  ", fileName: "a.pdf" }, deps);

    expect(result.ok).toBe(false);
    expect(deps.fetchImpl).not.toHaveBeenCalled();
    expect(deps.writeFile).not.toHaveBeenCalled();
  });

  it("reports a missing token as session-expired and signals re-login", async () => {
    const onUnauthorized = vi.fn();
    const deps = baseDeps({ getToken: () => null, onUnauthorized });
    const result = await downloadMaterialFile(
      { fileUrl: "/files/a.pdf", fileName: "a.pdf" },
      deps,
    );

    expect(result).toEqual({ ok: false, error: "Session expired — please sign in again." });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(deps.fetchImpl).not.toHaveBeenCalled();
  });

  it("surfaces network failures with a clear retry message", async () => {
    const deps = baseDeps({
      fetchImpl: vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    });
    const result = await downloadMaterialFile(
      { fileUrl: "/files/a.pdf", fileName: "a.pdf" },
      deps,
    );

    expect(result).toEqual({
      ok: false,
      error: "Download failed — check your connection and try again.",
    });
    expect(deps.writeFile).not.toHaveBeenCalled();
  });

  it("pauses into re-login on a 401 from the file fetch", async () => {
    const onUnauthorized = vi.fn();
    const deps = baseDeps({
      fetchImpl: vi.fn(async () => new Response("", { status: 401 })),
      onUnauthorized,
    });
    const result = await downloadMaterialFile(
      { fileUrl: "/files/a.pdf", fileName: "a.pdf" },
      deps,
    );

    expect(result).toEqual({ ok: false, error: "Session expired — please sign in again." });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(deps.writeFile).not.toHaveBeenCalled();
  });

  it("reports other server errors with the status and never writes", async () => {
    const deps = baseDeps({
      fetchImpl: vi.fn(async () => new Response("", { status: 500 })),
    });
    const result = await downloadMaterialFile(
      { fileUrl: "/files/a.pdf", fileName: "a.pdf" },
      deps,
    );

    expect(result).toEqual({ ok: false, error: "Download failed (server returned 500)." });
    expect(deps.writeFile).not.toHaveBeenCalled();
  });

  it("reports an unwritable destination with a clear message", async () => {
    const deps = baseDeps({
      writeFile: vi.fn(async () => {
        throw new Error("EPERM");
      }),
    });
    const result = await downloadMaterialFile(
      { fileUrl: "/files/a.pdf", fileName: "a.pdf" },
      deps,
    );

    expect(result).toEqual({
      ok: false,
      error: "Could not save the file — check the destination and try again.",
    });
  });

  it("sanitizes file names so dialog defaults stay a plain file name", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("  ")).toBe("material");
    expect(sanitizeFileName(null)).toBe("material");
  });
});
