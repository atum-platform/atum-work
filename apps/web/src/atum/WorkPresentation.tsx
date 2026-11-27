import type {
  ProviderApprovalDecision,
  ProviderApprovalOption,
  RunId,
  RuntimeRequestId,
} from "@t3tools/contracts";
import { useGT } from "gt-react";
import {
  FileTextIcon,
  ImageIcon,
  FileIcon,
  FileSpreadsheetIcon,
  ChevronRightIcon,
} from "lucide-react";
import { memo, useState } from "react";

import { cn } from "~/lib/utils";
import type { PendingApproval } from "../session-logic";
import type { TurnDiffFileChange } from "../types";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { workFileKind, workApprovalChoices, type WorkFileKind } from "./WorkPresentation.logic";

/**
 * The assistant at work: a thin orbit, nucleus and one travelling electron in currentColor
 * (the Atum Kit atom). Only while a model works; an app wait stays a spinner.
 */
export function AtumAtom({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      data-atum-atom=""
      className={cn("relative inline-block size-4 shrink-0 text-foreground", className)}
    >
      <svg className="absolute inset-0 size-full" fill="none" viewBox="0 0 24 24">
        <circle
          cx="12"
          cy="12"
          r="10.5"
          stroke="currentColor"
          strokeOpacity={0.45}
          strokeWidth={1.25}
        />
      </svg>
      <i className="absolute top-1/2 left-1/2 size-[30%] -translate-1/2 rounded-full bg-current" />
      {/* The environment theme turns this track (Kit motion, still under Reduce Motion). */}
      <span className="absolute inset-0" data-atum-atom-track="">
        <i className="absolute top-[2%] left-1/2 size-[22%] -translate-x-1/2 rounded-full bg-current" />
      </span>
    </span>
  );
}

const FILE_ICON: Record<WorkFileKind, typeof FileIcon> = {
  document: FileTextIcon,
  image: ImageIcon,
  sheet: FileSpreadsheetIcon,
  file: FileIcon,
};

/** Work mode's changed files: one card per file, Open shows it in the right panel. */
export const WorkFileCards = memo(function WorkFileCards(props: {
  runId: RunId;
  files: ReadonlyArray<TurnDiffFileChange>;
  totalCount: number;
  onOpen: (runId: RunId, filePath?: string) => void;
}) {
  const gt = useGT();
  const kindLabel: Record<WorkFileKind, string> = {
    document: gt("Document"),
    image: gt("Image"),
    sheet: gt("Spreadsheet"),
    file: gt("File"),
  };
  const hidden = props.totalCount - props.files.length;
  return (
    <div className="mt-4 flex flex-col gap-2" data-changed-files-state="cards">
      {props.files.map((file) => {
        const kind = workFileKind(file.path);
        const Icon = FILE_ICON[kind];
        const name = file.path.split(/[/\\]/).at(-1) ?? file.path;
        return (
          <div
            key={file.path}
            data-atum-file-card=""
            className="flex max-w-105 items-center gap-3 rounded-3xl px-3 py-2.5 ring-1 ring-border ring-inset"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-foreground/80">
              <Icon aria-hidden className="size-5" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">{name}</span>
              <span className="text-xs text-muted-foreground">
                {gt("{kind} · changed", { kind: kindLabel[kind] })}
              </span>
            </span>
            <Button
              type="button"
              size="sm-pill"
              variant="ghost"
              onClick={() => props.onOpen(props.runId, file.path)}
            >
              {gt("Open")}
            </Button>
          </div>
        );
      })}
      {hidden > 0 ? (
        <span className="ps-3 text-xs text-muted-foreground">
          {gt("{count, plural, one {and # more file} other {and # more files}}", { count: hidden })}
        </span>
      ) : null}
    </div>
  );
});

/** Work mode's approval: one plain question, Allow / Not now, the raw detail behind Details. */
export const WorkApprovalRow = memo(function WorkApprovalRow(props: {
  approval: PendingApproval;
  disabled: boolean;
  isResponding: boolean;
  onRespond:
    | ((requestId: RuntimeRequestId, decision: ProviderApprovalDecision) => Promise<unknown>)
    | undefined;
  fallbackActions: React.ReactNode;
}) {
  const gt = useGT();
  const [open, setOpen] = useState(false);
  const { approval } = props;
  const question = {
    command: gt("Allow a step on this Mac?"),
    "file-change": gt("Allow changes to files?"),
    "file-read": gt("Allow reading a file?"),
    permission: approval.appName
      ? gt("Allow {app} to do this?", { app: approval.appName })
      : gt("Allow this?"),
    "mcp-elicitation": approval.appName
      ? gt("Let {app} use your account?", { app: approval.appName })
      : gt("Allow app access?"),
  }[approval.requestKind];
  const choices = workApprovalChoices(
    approval.options as ReadonlyArray<ProviderApprovalOption> | undefined,
  );
  const live = approval.responseCapability === "live" && props.onRespond !== undefined;
  return (
    <div
      role="group"
      aria-label={question}
      data-v2-item-type="approval_request"
      data-atum-ask=""
      className="my-1 grid max-w-130 grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 rounded-3xl bg-secondary px-4 py-3.5 ring-1 ring-border ring-inset"
    >
      <span className="font-medium">{question}</span>
      <span className="col-start-2 row-span-2 flex gap-1">
        {live && choices ? (
          <>
            <Button
              type="button"
              size="sm-pill"
              variant="ghost"
              disabled={props.disabled || props.isResponding}
              onClick={() => void props.onRespond?.(approval.requestId, choices.decline)}
            >
              {gt("Not now")}
            </Button>
            <Button
              type="button"
              size="sm-pill"
              disabled={props.disabled || props.isResponding}
              onClick={() => void props.onRespond?.(approval.requestId, choices.allow)}
            >
              {gt("Allow")}
            </Button>
          </>
        ) : live ? (
          props.fallbackActions
        ) : null}
      </span>
      {approval.detail ? (
        <span className="row-start-2 flex min-w-0 flex-col gap-1">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground"
          >
            <ChevronRightIcon aria-hidden className={cn("size-3", open && "rotate-90")} />
            {gt("Details")}
          </button>
          {open ? (
            <code className="block max-h-40 overflow-auto font-mono text-xs leading-5 whitespace-pre-wrap wrap-anywhere select-text">
              {approval.detail}
            </code>
          ) : null}
        </span>
      ) : null}
      {live ? null : (
        <span className="col-span-2 text-xs text-muted-foreground">
          {gt("This step stopped. Start it again to answer.")}
        </span>
      )}
    </div>
  );
});

/** Work mode's thread loading: three quiet lines, never a spinner over the transcript. */
export function WorkThreadSkeleton() {
  return (
    <div
      className="mx-auto flex w-full max-w-(--chat-content-max-width) flex-col gap-3 px-6 pt-10"
      data-atum-thread-skeleton=""
    >
      <Skeleton shape="pill" className="h-3 w-2/3" />
      <Skeleton shape="pill" className="h-3 w-5/6" />
      <Skeleton shape="pill" className="h-3 w-1/2" />
    </div>
  );
}

/** The Atum mark: a navy squircle with the crescent. */
export function AtumMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      data-atum-mark=""
      className={cn(
        "grid size-12 place-items-center rounded-2xl bg-foreground text-background",
        className,
      )}
    >
      {/* The theme draws the crescent in the Atum colors; elsewhere a plain disc. */}
      <span className="size-5 rounded-full border-2 border-current" data-atum-mark-moon="" />
    </span>
  );
}

export function WorkDraftHero(props: { project: React.ReactNode | null }) {
  const gt = useGT();
  return (
    <div
      className="mx-auto flex w-full max-w-5xl flex-col items-center gap-2 text-center"
      data-atum-work-hero=""
    >
      <AtumMark className="mb-2" />
      <h1 className="text-2xl font-semibold tracking-tight text-foreground" data-atum-display="">
        {gt("What should we work on?")}
      </h1>
      {props.project ? (
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          {gt("Files in")} <span className="inline-flex min-w-0">{props.project}</span>{" "}
          {gt("are in reach.")}
        </p>
      ) : null}
    </div>
  );
}
