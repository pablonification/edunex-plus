// Settings → Tentang → Lisensi sumber terbuka: the open-source software Edunex
// Plus is built with, how many, and a search; one row each (name, version,
// licence, a link to its source) whose licence text opens under it. The page
// and its list load when the Student opens it, never with the window.
//
// Each row opens and closes on its own. Opening one never closes another: a
// long text closing above the row the Student clicked would pull that row,
// and the text they asked for, far out of view.
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { isWebLink, linkHost } from "../../core/links";
import { useOpenLink } from "../hooks";
import { useT } from "../i18n";
import { findLicences, type Licence, licenceParagraphs, loadLicences } from "../licences";
import { Button, IconButton } from "../ui/controls";
import { cx } from "../ui/cx";
import { Skeleton } from "../ui/display";
import { Icons } from "../ui/icons";
import { factsLabel, List, Notice } from "../ui/layout";
import { DisclosurePanel, disclosureTrigger } from "../ui/motion/disclosure";
import { Tooltip } from "../ui/overlays";

type Loaded = { list: readonly Licence[] } | "loading" | "failed";

const keyOf = (entry: Licence) => `${entry.name}@${entry.version ?? ""}`;

/** The rows that are open, with `key` opened, or closed if it was open. */
function toggled(open: ReadonlySet<string>, key: string): ReadonlySet<string> {
  const next = new Set(open);
  if (!next.delete(key)) next.add(key);
  return next;
}

export default function Licences() {
  const t = useT();
  const [loaded, setLoaded] = useState<Loaded>("loading");
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const search = useRef<HTMLInputElement>(null);
  // The button that led here has gone with Settings' page: the search takes its focus.
  useEffect(() => search.current?.focus(), []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt is "Coba lagi"; it changing is what reads the list again
  useEffect(() => {
    let current = true;
    setLoaded("loading");
    loadLicences().then(
      (list) => current && setLoaded({ list }),
      () => current && setLoaded("failed"),
    );
    return () => {
      current = false;
    };
  }, [attempt]);

  const list = typeof loaded === "object" ? loaded.list : null;
  const shown = useMemo(() => (list ? findLicences(list, query) : []), [list, query]);
  const searching = query.trim() !== "";

  return (
    <div aria-busy={loaded === "loading" || undefined}>
      {list ? <p className="text-body text-pretty text-muted">{t("licences.intro", { count: list.length })}</p> : <Skeleton className="h-5 w-4/5" />}
      {/* The search stays in view over the rows scrolling under it. */}
      <div className="sticky -top-5 z-10 -mx-5 bg-raised px-5 py-3">
        {/* The box shows the focus ring: the input itself is borderless inside it. */}
        <label className="flex h-9 items-center gap-2 rounded-lg bg-fill px-3 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-focus">
          <Icons.Search className="size-4 shrink-0 text-faint" />
          <input
            ref={search}
            value={query}
            aria-label={t("licences.search")}
            placeholder={t("licences.search")}
            spellCheck={false}
            onChange={(event) => setQuery(event.target.value)}
            className="h-full min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-faint"
          />
          <span aria-live="polite" className="shrink-0 text-small text-muted tabular-nums">
            {searching && list ? t("search.count", { count: shown.length }) : ""}
          </span>
        </label>
      </div>
      {loaded === "failed" ? (
        // Said where the Student is, also to a screen reader: the list they asked for didn't come.
        <div role="status">
          <Notice
            tone="warning"
            title={t("licences.failed")}
            action={
              <Button size="sm" onClick={() => setAttempt((n) => n + 1)}>
                {t("action.tryAgain")}
              </Button>
            }
          />
        </div>
      ) : !list ? (
        <Loading />
      ) : shown.length > 0 ? (
        // A row reached with Shift+Tab scrolls in at the top edge: its buttons keep the pinned search's height (60 px) clear, or it would sit under it.
        <List label={t("licences.title")} className="[&_button]:scroll-mt-16">
          {shown.map((entry) => {
            const key = keyOf(entry);
            return <LicenceRow key={key} entry={entry} open={open.has(key)} onToggle={() => setOpen((was) => toggled(was, key))} />;
          })}
        </List>
      ) : (
        <p className="px-3 py-8 text-center text-body text-muted">{t("search.noResults", { query: query.trim() })}</p>
      )}
    </div>
  );
}

/** One piece of software: the row opens its licence text under it; the arrow beside it opens its source in the browser. */
function LicenceRow({ entry, open, onToggle }: { entry: Licence; open: boolean; onToggle: () => void }) {
  const t = useT();
  const openLink = useOpenLink();
  const id = useId();
  const source = entry.source && isWebLink(entry.source) ? entry.source : null;
  return (
    <li>
      {/* As a kit Row with actions: the hover and the focus ring belong to the whole line, the link beside the button included. */}
      <div
        className={cx(
          "group/row flex items-center hover:bg-hover has-[>button:active]:bg-selected",
          "has-[>button:focus-visible]:outline-2 has-[>button:focus-visible]:outline-offset-[-2px] has-[>button:focus-visible]:outline-focus has-[>button:focus-visible]:outline-solid",
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          // Read as "zod · 4.6.5 · MIT": the parts on screen have no spaces between them.
          aria-label={factsLabel(entry.name, entry.version, entry.licence)}
          {...disclosureTrigger(open, id)}
          className="flex min-w-0 flex-1 items-center gap-2.5 py-2.5 pr-1 pl-3.5 text-left focus-visible:outline-none"
        >
          <Icons.ChevronRight className={cx("size-3.5 shrink-0 text-faint transition-transform duration-150", open && "rotate-90")} />
          <span className="min-w-0 truncate text-body font-medium" title={entry.name}>
            {entry.name}
          </span>
          {entry.version && <span className="shrink-0 text-small text-muted tabular-nums">{entry.version}</span>}
          <span className="ml-auto max-w-[45%] shrink-0 truncate pl-3 text-small text-muted" title={entry.licence}>
            {entry.licence}
          </span>
        </button>
        <div className="flex shrink-0 items-center pr-2 [&_button]:text-faint group-focus-within/row:[&_button]:text-fg [@media(hover:hover)]:group-hover/row:[&_button]:text-fg">
          {source ? (
            <Tooltip content={t("link.opensIn", { host: linkHost(source) ?? source })}>
              <IconButton size="sm" label={t("licences.source", { name: entry.name })} onClick={() => openLink(source)}>
                <Icons.ArrowUpRight className="size-3.5" />
              </IconButton>
            </Tooltip>
          ) : (
            <span className="size-7" />
          )}
        </div>
      </div>
      <DisclosurePanel open={open} id={id}>
        <div className="border-t border-line bg-sunken px-4 py-3">
          {entry.text !== undefined ? (
            <LicenceText text={entry.text} />
          ) : (
            <p className="text-small text-muted">{t("licences.chromium", { file: entry.file ?? "" })}</p>
          )}
        </div>
      </DisclosurePanel>
    </li>
  );
}

/** A licence's own words, in paragraphs that fit the column; a rule between the licences of one entry's files. */
function LicenceText({ text }: { text: string }) {
  const paragraphs = useMemo(() => licenceParagraphs(text), [text]);
  return (
    <div className="max-w-[72ch] space-y-2 text-caption text-pretty break-words text-muted">
      {paragraphs.map((paragraph, i) =>
        paragraph === "---" ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: the paragraphs of one text, in their order; they have nothing else to be told apart by
          <hr key={i} className="border-line" />
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: the paragraphs of one text, in their order; they have nothing else to be told apart by
          <p key={i} className="whitespace-pre-line">
            {paragraph}
          </p>
        ),
      )}
    </div>
  );
}

/** Rows in the shape of the list while it loads. */
function Loading() {
  return (
    <div aria-hidden className="overflow-hidden rounded-xl border border-edge bg-surface shadow-card">
      {["w-40", "w-28", "w-52", "w-36", "w-44", "w-32"].map((width) => (
        <div key={width} className="flex items-center gap-3 border-line px-4 py-3 not-first:border-t">
          <Skeleton className={cx("h-4", width)} />
          <Skeleton className="ml-auto h-4 w-12" />
        </div>
      ))}
    </div>
  );
}
