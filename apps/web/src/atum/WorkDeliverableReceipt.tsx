import { useGT } from "gt-react";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import type { WorkDeliverableIdentity } from "~/components/chat/workSubmitAccess";

export function WorkDeliverableReceipt({ identity }: { identity: WorkDeliverableIdentity }) {
  const gt = useGT();
  const [openFailed, setOpenFailed] = useState(false);
  const bridge = window.atumWork;
  const { threadId, runId, artifactId } = identity;
  const [receipt, setReceipt] = useState<{ state: string; name?: string } | null>(null);
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
  if (receipt?.state !== "saved" && receipt?.state !== "syncing") return null;
  const open = async () => {
    const opened = await bridge?.openDeliverable?.(identity).catch(() => false);
    setOpenFailed(opened !== true);
  };
  return (
    <div className="chat-content-lane flex items-center gap-2 py-2 text-sm" role="status">
      <span>
        {receipt.state === "saved" ? gt("Saved to Atum Drive") : gt("Syncing to Atum Drive")}
        {receipt.name ? ` · ${receipt.name}` : ""}
      </span>
      {receipt.state === "saved" && bridge?.openDeliverable ? (
        <Button variant="outline" size="sm" onClick={() => void open()}>
          {gt("Open in Drive")}
        </Button>
      ) : null}
      {openFailed ? <span>{gt("Couldn’t open the file in Drive.")}</span> : null}
    </div>
  );
}
