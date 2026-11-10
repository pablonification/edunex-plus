// The QA restore link and the Mac's answer, read (./restore.ts); test/mobile/qa-restore.test.ts.

/** The link's port and key, or null when it isn't one. */
export function restoreParams(link: string): { port: number; key: string } | null {
  if (!/^(edunexplus:\/\/|\/)?qa\/restore\?/.test(link)) return null;
  const query = link.slice(link.indexOf("?") + 1);
  const params = new Map(
    query.split("&").map((pair) => {
      const at = pair.indexOf("=");
      return at < 0 ? [pair, ""] : [pair.slice(0, at), pair.slice(at + 1)];
    }),
  );
  const port = Number(params.get("port"));
  const key = params.get("key") ?? "";
  if (!Number.isInteger(port) || port < 1 || port > 65_535 || !/^[0-9a-f]{8,256}$/i.test(key)) return null;
  return { port, key };
}

/** What the Mac answered, kept only when it reads as each system's session. */
export function sessionsOf(body: unknown): { edunex: string | null; six: string | null } {
  const value = (body ?? {}) as { edunex?: unknown; six?: unknown };
  const edunex = typeof value.edunex === "string" && /^[\w-]+\.[\w-]+\.[\w-]+$/.test(value.edunex) ? value.edunex : null;
  const six = typeof value.six === "string" && /^[A-Za-z0-9_-]+=[\w%+/=.-]+$/.test(value.six) ? value.six : null;
  return { edunex, six };
}
