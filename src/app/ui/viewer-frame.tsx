// What the two viewers share (PDFs in ./pdf-viewer.tsx, other files in
// ./file-viewer.tsx): the bar with the file's name, its buttons and Close, and
// what stands in for the file while it's read in or when it can't be shown.
import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { useT } from "../i18n";
import { IconButton } from "./controls";
import { Skeleton } from "./display";
import { Icons } from "./icons";

export function Toolbar({ name, actions, children }: { name: string; actions?: ReactNode; children?: ReactNode }) {
  const t = useT();
  return (
    <div className="flex h-12 shrink-0 items-center gap-1 border-b border-line pr-2 pl-4">
      <Icons.FileText className="mr-1.5 size-4 shrink-0 text-muted" />
      <DialogPrimitive.Title className="min-w-0 flex-1 truncate text-body font-semibold" title={name}>
        {name}
      </DialogPrimitive.Title>
      {children}
      {actions}
      <DialogPrimitive.Close asChild>
        <IconButton label={t("action.close")} size="sm">
          <Icons.X className="size-4" />
        </IconButton>
      </DialogPrimitive.Close>
    </div>
  );
}

/** A page-shaped placeholder while the file is read in. */
export function Loading({ label }: { label: string }) {
  return (
    <div role="status" className="flex w-full flex-col items-center gap-3">
      <Skeleton className="aspect-[1/1.414] w-full max-w-[520px] rounded-sm" />
      <span className="text-small text-muted">{label}</span>
    </div>
  );
}

/** Why the file isn't shown, and the way forward (`children`: Try again, Download, Open in Edunex). */
export function Failed({ title, detail, children }: { title: string; detail: string; children?: ReactNode }) {
  return (
    <div role="alert" className="flex max-w-[44ch] flex-col items-center gap-3 text-center">
      <span className="grid size-10 place-items-center rounded-full bg-surface text-muted shadow-card">
        <Icons.FileText className="size-5" />
      </span>
      <div>
        <p className="text-body font-semibold">{title}</p>
        <p className="mt-1 text-small text-muted">{detail}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">{children}</div>
    </div>
  );
}
