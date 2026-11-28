import { useGT } from "gt-react";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import type {
  WorkDeliverableIdentity,
  WorkSubmitAccessBridge,
} from "~/components/chat/workSubmitAccess";

type Receipt = Awaited<ReturnType<NonNullable<WorkSubmitAccessBridge["getDeliverable"]>>>;

export function WorkDeliverableReceipt({ identity }: { identity: WorkDeliverableIdentity }) {
  const gt = useGT();
  const [openFailed, setOpenFailed] = useState(false);
  const bridge = window.atumWork;
  const { threadId, runId, artifactId } = identity;
  const [receipt, setReceipt] = useState<Receipt>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Desktop owns the receipt and observes Drive sync outside the renderer.
  useEffect(() => {
    if (!bridge?.getDeliverable) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pendingReads = 0;
    const refresh = async () => {
      const status = await bridge
        .getDeliverable?.({ threadId, runId, artifactId })
        .catch(() => null);
      if (!active) return;
      setReceipt(status ?? null);
      if (status?.state === "syncing" || (!status && ++pendingReads < 10)) {
        timer = setTimeout(() => void refresh(), 2_000);
      }
    };
    void refresh();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [bridge, threadId, runId, artifactId]);
  if (receipt?.state === "invalid") {
    return (
      <div className="chat-content-lane py-2 text-sm" role="status">
        {gt("This file couldn’t be saved to Atum Drive.")}
      </div>
    );
  }
  if (receipt?.state !== "saved" && receipt?.state !== "syncing") return null;
  const open = async (asset?: "preview") => {
    const target = asset ? { ...identity, asset } : identity;
    const opened = await bridge?.openDeliverable?.(target).catch(() => false);
    setOpenFailed(opened !== true);
  };
  const saved = receipt.state === "saved";
  const thumbnail =
    saved && receipt.previewName && receipt.previewDataUrl?.startsWith("data:image/png;base64,") ? (
      <img
        className="max-h-36 max-w-full rounded border object-contain"
        src={receipt.previewDataUrl}
        alt={receipt.previewName}
      />
    ) : null;
  return (
    <div className="chat-content-lane py-2 text-sm">
      {thumbnail && bridge?.openDeliverable ? (
        <button
          className="mb-2 block max-w-full rounded"
          type="button"
          onClick={() => void open("preview")}
        >
          {thumbnail}
        </button>
      ) : (
        thumbnail
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span role="status">
          {saved ? gt("Saved to Atum Drive") : gt("Syncing to Atum Drive")}
          {receipt.name ? ` · ${receipt.name}` : ""}
        </span>
        {saved && bridge?.openDeliverable ? (
          <Button variant="outline" size="sm" onClick={() => void open()}>
            {gt("Open in Drive")}
          </Button>
        ) : null}
        {openFailed ? <span role="status">{gt("Couldn’t open the file in Drive.")}</span> : null}
      </div>
    </div>
  );
}
