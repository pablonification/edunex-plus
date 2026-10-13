// What lecturers write, as the app shows it (notes, Task instructions), and the
// Student's own answer as Edunex keeps it (written on its website, it can hold
// links and pictures too): the kit's safe RichText, with links opening in the
// browser and pictures on Edunex's storage read in through the main process
// (the window's content policy never lets it load anything remote) and shown
// from memory.
import { useEffect, useState } from "react";
import type { FileProblem } from "../core/actions/files";
import { isStorageFile } from "../core/links";
import type { Bridge } from "./bridge";
import { useOpenLink } from "./hooks";
import { useT } from "./i18n";
import { useBridge } from "./store";
import { cx } from "./ui/cx";
import { Skeleton } from "./ui/display";
import { Icons } from "./ui/icons";
import { RichText } from "./ui/rich-text";

export function LecturerHtml({
  html,
  pictureAlt,
  className,
}: {
  html: string;
  /** What a picture with no description of its own is called; the lecturer's by default. */
  pictureAlt?: string;
  className?: string;
}) {
  const openLink = useOpenLink();
  return (
    <RichText
      html={html}
      onOpenLink={openLink}
      renderImage={({ src, alt }) => (isStorageFile(src) ? <RemoteImage src={src} alt={alt || pictureAlt || ""} /> : null)}
      pictureAlt={pictureAlt}
      className={className}
    />
  );
}

type Picture = { state: "loading" } | { state: "ready"; src: string } | { state: "failed"; problem: FileProblem };

/** Pictures already read in, newest last; the oldest go (and free their memory) past this many. */
const KEEP = 40;
/** Per window (its bridge): a new window starts with none. */
const read = new WeakMap<Bridge, Map<string, Promise<Picture>>>();

function readPicture(bridge: Bridge, url: string): Promise<Picture> {
  let pictures = read.get(bridge);
  if (!pictures) read.set(bridge, (pictures = new Map()));
  const known = pictures.get(url);
  if (known) {
    pictures.delete(url);
    pictures.set(url, known);
    return known;
  }
  const reading = bridge.invoke("files.read", { url, as: "image" }).then(
    (result): Picture =>
      "problem" in result
        ? { state: "failed", problem: result.problem }
        : { state: "ready", src: URL.createObjectURL(new Blob([result.bytes as Uint8Array<ArrayBuffer>], { type: result.type })) },
    (): Picture => ({ state: "failed", problem: "unreachable" }),
  );
  pictures.set(url, reading);
  // A failure isn't kept: the next look tries again.
  void reading.then((picture) => {
    if (picture.state === "failed") pictures.delete(url);
  });
  for (const [oldest, picture] of pictures) {
    if (pictures.size <= KEEP) break;
    pictures.delete(oldest);
    void picture.then((p) => p.state === "ready" && URL.revokeObjectURL(p.src));
  }
  return reading;
}

/** A picture on Edunex's storage: a placeholder in its place while it loads, and why when it can't show. */
export function RemoteImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const t = useT();
  const bridge = useBridge();
  const [picture, setPicture] = useState<Picture>({ state: "loading" });
  useEffect(() => {
    let live = true;
    setPicture({ state: "loading" });
    void readPicture(bridge, src).then((next) => live && setPicture(next));
    return () => {
      live = false;
    };
  }, [bridge, src]);

  if (picture.state === "loading")
    return (
      <span role="img" aria-label={t("image.loading")} className="block">
        <Skeleton className={cx("aspect-[16/9] w-full max-w-md rounded-lg", className)} />
      </span>
    );
  if (picture.state === "failed")
    return (
      <span className={cx("flex max-w-md items-center gap-2.5 rounded-lg bg-sunken px-3 py-2.5 text-small text-muted", className)}>
        <Icons.ImageBroken className="size-4 shrink-0" />
        {t(`file.problem.${picture.problem}`)}
      </span>
    );
  // A tall picture (a scanned page) stays within a screenful; its shape is kept.
  return <img src={picture.src} alt={alt || t("image.alt")} decoding="async" className={cx("h-auto max-h-[28rem] w-auto max-w-full rounded-lg", className)} />;
}
