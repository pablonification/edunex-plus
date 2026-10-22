// A small box for writing formatted text (a Task's answer): bold, italic,
// lists, a link, a quote, undo and redo, and pasting that keeps simple
// formatting. TipTap (ProseMirror) underneath; the screen that needs it loads
// it lazily, so the rest of the app never carries it. It holds only what
// Edunex's own editor writes for an answer: no pictures, tables or embeds.
import { ArrowUUpLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowUUpLeft";
import { ArrowUUpRightIcon } from "@phosphor-icons/react/dist/csr/ArrowUUpRight";
import { ListBulletsIcon } from "@phosphor-icons/react/dist/csr/ListBullets";
import { ListNumbersIcon } from "@phosphor-icons/react/dist/csr/ListNumbers";
import { QuotesIcon } from "@phosphor-icons/react/dist/csr/Quotes";
import { TextBIcon } from "@phosphor-icons/react/dist/csr/TextB";
import { TextItalicIcon } from "@phosphor-icons/react/dist/csr/TextItalic";
import { Placeholder } from "@tiptap/extensions";
import { closeHistory } from "@tiptap/pm/history";
import { type Editor, EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { type KeyboardEvent, type ReactNode, type Ref, useEffect, useId, useImperativeHandle, useRef, useState } from "react";
import { useT } from "../i18n";
import { Button, IconButton } from "./controls";
import { cx } from "./cx";
import { Icons, icon } from "./icons";
import { Tooltip } from "./overlays";

// The toolbar's icons load with the box, not with the rest of the app.
const Glyph = {
  Bold: icon(TextBIcon),
  Italic: icon(TextItalicIcon),
  ListBullets: icon(ListBulletsIcon),
  ListNumbers: icon(ListNumbersIcon),
  Quote: icon(QuotesIcon),
  Undo: icon(ArrowUUpLeftIcon),
  Redo: icon(ArrowUUpRightIcon),
};

/** What the screen holding the box can ask of it. */
export interface RichEditorHandle {
  /** Puts `html` in the box with the cursor at its end, as one step Undo takes back. */
  reset: (html: string) => void;
}

export interface RichEditorProps {
  /** The HTML to start from. */
  initial: string;
  /** The text as HTML after every change; "" when it's empty. */
  onChange: (html: string) => void;
  /** What the box is for, for screen readers. */
  label: string;
  placeholder: string;
  /** An element saying more about it (a hint under the box). */
  describedBy?: string;
  ref?: Ref<RichEditorHandle>;
}

const LINK = /^(https?:\/\/|mailto:)/i;

export default function RichEditor({ initial, onChange, label, placeholder, describedBy, ref }: RichEditorProps) {
  const [linking, setLinking] = useState(false);
  // The editor is made once; its change handler always reaches the latest onChange.
  const changed = useRef(onChange);
  changed.current = onChange;
  const hint = useRef(placeholder);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        horizontalRule: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          isAllowedUri: (url) => LINK.test(url),
          HTMLAttributes: { target: null, rel: null },
        },
      }),
      Placeholder.configure({ placeholder: () => hint.current }),
    ],
    content: initial,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": label,
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
        class: cx(
          "max-h-[360px] min-h-[132px] overflow-y-auto px-3 py-2.5 text-body leading-relaxed outline-none",
          "[&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5",
          "[&_li_p]:my-0 [&_blockquote]:my-1.5 [&_blockquote]:border-l-2 [&_blockquote]:border-track [&_blockquote]:pl-3 [&_blockquote]:text-muted",
          "[&_a]:text-accent-fg [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-3 [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:font-semibold [&_h4]:mt-3 [&_h4]:font-semibold",
          "[&_code]:rounded [&_code]:bg-fill [&_code]:px-1 [&_code]:font-mono [&_code]:text-small [&_pre]:my-1.5 [&_pre]:rounded-lg [&_pre]:bg-fill [&_pre]:p-3",
        ),
      },
      // ⌘K / Ctrl+K adds a link, as in most editors; here it never also opens the app's search.
      handleKeyDown: (_view, event) => {
        if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey)) return false;
        event.preventDefault();
        event.stopPropagation();
        setLinking(true);
        return true;
      },
    },
    onUpdate: ({ editor }) => changed.current(editor.isEmpty ? "" : editor.getHTML()),
  });
  // A placeholder in a newly chosen language shows at once, with the text and its history kept.
  useEffect(() => {
    hint.current = placeholder;
    editor.view.updateState(editor.state);
  }, [editor, placeholder]);
  useImperativeHandle(
    ref,
    () => ({
      reset: (html) =>
        editor
          .chain()
          .command(({ tr }) => Boolean(closeHistory(tr)))
          .setContent(html)
          .focus("end")
          .run(),
    }),
    [editor],
  );

  return (
    <div className="rounded-lg border border-field-edge bg-surface transition-colors duration-150 has-[.ProseMirror:focus-visible]:border-(--focus) has-[.ProseMirror:focus-visible]:outline-2 has-[.ProseMirror:focus-visible]:outline-offset-1 has-[.ProseMirror:focus-visible]:outline-(--focus)">
      <Toolbar editor={editor} linking={linking} onLink={() => setLinking((open) => !open)} />
      {linking && <LinkRow editor={editor} onDone={() => setLinking(false)} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor, linking, onLink }: { editor: Editor; linking: boolean; onLink: () => void }) {
  const t = useT();
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      bullets: editor.isActive("bulletList"),
      numbers: editor.isActive("orderedList"),
      quote: editor.isActive("blockquote"),
      link: editor.isActive("link"),
      undo: editor.can().undo(),
      redo: editor.can().redo(),
    }),
  });
  const run = (command: (chain: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) => command(editor.chain().focus()).run();
  // Left and right move between the buttons, as in any toolbar; Tab still reaches each one.
  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    event.preventDefault();
    buttons[(at + (event.key === "ArrowRight" ? 1 : buttons.length - 1)) % buttons.length].focus();
  };
  return (
    <div role="toolbar" aria-label={t("editor.toolbar")} onKeyDown={move} className="flex flex-wrap items-center gap-0.5 border-b border-line px-1.5 py-1">
      <Tool label={t("editor.bold")} active={state.bold} onClick={() => run((c) => c.toggleBold())}>
        <Glyph.Bold className="size-4" weight="bold" />
      </Tool>
      <Tool label={t("editor.italic")} active={state.italic} onClick={() => run((c) => c.toggleItalic())}>
        <Glyph.Italic className="size-4" />
      </Tool>
      <span aria-hidden className="mx-1 h-4 w-px bg-line" />
      <Tool label={t("editor.bullets")} active={state.bullets} onClick={() => run((c) => c.toggleBulletList())}>
        <Glyph.ListBullets className="size-4" />
      </Tool>
      <Tool label={t("editor.numbers")} active={state.numbers} onClick={() => run((c) => c.toggleOrderedList())}>
        <Glyph.ListNumbers className="size-4" />
      </Tool>
      <Tool label={t("editor.quote")} active={state.quote} onClick={() => run((c) => c.toggleBlockquote())}>
        <Glyph.Quote className="size-4" />
      </Tool>
      <Tool label={t("editor.link")} active={state.link || linking} onClick={onLink}>
        <Icons.Link className="size-4" />
      </Tool>
      <span aria-hidden className="mx-1 h-4 w-px bg-line" />
      <Tool label={t("editor.undo")} disabled={!state.undo} onClick={() => run((c) => c.undo())}>
        <Glyph.Undo className="size-4" />
      </Tool>
      <Tool label={t("editor.redo")} disabled={!state.redo} onClick={() => run((c) => c.redo())}>
        <Glyph.Redo className="size-4" />
      </Tool>
    </div>
  );
}

function Tool({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip content={label}>
      <IconButton
        size="sm"
        label={label}
        aria-pressed={active}
        disabled={disabled}
        // Keeps the text's selection while the button is pressed.
        onMouseDown={(event) => event.preventDefault()}
        onClick={onClick}
        className={cx(active && "bg-selected text-fg hover:bg-selected")}
      >
        {children}
      </IconButton>
    </Tooltip>
  );
}

/** The address of a link on the selected words (or, with none selected, the address itself as the link's words). */
function LinkRow({ editor, onDone }: { editor: Editor; onDone: () => void }) {
  const t = useT();
  const id = useId();
  const current = editor.getAttributes("link").href as string | undefined;
  const [href, setHref] = useState(current ?? "");
  const input = useRef<HTMLInputElement>(null);
  const address = href.trim() && !/^[a-z][a-z0-9+.-]*:/i.test(href.trim()) ? `https://${href.trim()}` : href.trim();
  const valid = LINK.test(address);
  const apply = () => {
    if (!valid) return;
    const chain = editor.chain().focus().extendMarkRange("link");
    if (editor.state.selection.empty && !current)
      chain.insertContent({ type: "text", text: address, marks: [{ type: "link", attrs: { href: address } }] }).run();
    else chain.setLink({ href: address }).run();
    onDone();
  };
  const remove = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    onDone();
  };
  const keys = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      apply();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      editor.commands.focus();
      onDone();
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line px-2.5 py-2">
      <label htmlFor={id} className="sr-only">
        {t("editor.linkAddress")}
      </label>
      <input
        id={id}
        ref={input}
        // biome-ignore lint/a11y/noAutofocus: the row opens because the Student asked to type an address
        autoFocus
        type="url"
        inputMode="url"
        value={href}
        onChange={(event) => setHref(event.target.value)}
        onKeyDown={keys}
        placeholder="https://"
        className="focus-ring h-8 min-w-0 flex-1 rounded-md border border-field-edge bg-canvas px-2.5 text-small"
      />
      <Button size="sm" variant="primary" disabled={!valid} onClick={apply}>
        {t("editor.linkApply")}
      </Button>
      {current && (
        <Button size="sm" variant="ghost" onClick={remove}>
          {t("editor.linkRemove")}
        </Button>
      )}
    </div>
  );
}
